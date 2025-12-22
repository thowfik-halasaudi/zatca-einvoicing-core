import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CryptoCliService } from "../cryptography/crypto-cli.service";
import { OnboardEgsDto } from "./dto/onboard-egs.dto";
import { IssueCsidDto } from "./dto/issue-csid.dto";
import { CheckComplianceDto } from "./dto/check-compliance.dto";
import { SubmitZatcaDto } from "./dto/submit-zatca.dto";
import { ZatcaClientService } from "../zatca/zatca-client.service";
import { FileManagerService } from "../common/file-manager.service";

/**
 * ComplianceService
 *
 * The "Brain" of the ZATCA integration.
 * This service orchestrates the high-level business flows:
 * 1. Generating Onboarding Data (Keys/CSR) via Fatoora SDK CLI.
 * 2. Communicating with ZATCA APIs for certificates and submissions.
 * 3. Managing the local storage of certificates and signed XMLs.
 * 4. Detecting invoice types (Standard B2B vs Simplified B2C) to route to the correct ZATCA endpoint.
 */
@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly cryptoCli: CryptoCliService,
    private readonly zatcaClient: ZatcaClientService,
    private readonly fileManager: FileManagerService
  ) {}

  /**
   * onboardEgs
   *
   * Triggers the Step 1 of Onboarding: Local Key and CSR Generation.
   * It uses the CryptoCliService to talk to the Fatoora Java SDK.
   * The generated files are saved in the `onboarding_data/` folder.
   */
  async onboardEgs(dto: OnboardEgsDto) {
    console.log("==================================================");
    console.log("🚀 STARTING KEY & CSR GENERATION (STEP 1 ONLY)");
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`👤 Target: ${dto.commonName}`);
    console.log("==================================================");

    // Step 1: Build CSR configuration
    console.log("🛠️ [STEP 1.1] Building CSR configuration...");
    const csrConfig = this.cryptoCli.buildCSRConfig({
      ...dto,
      production: !!dto.production,
    });

    // Step 1b: Generate CSR and Private Key locally
    console.log("🛠️ [STEP 1.2] Generating Keys and CSR using Fatoora CLI...");
    const { privateKey, csr } = await this.cryptoCli.generateOnboardingData(
      dto.commonName,
      csrConfig
    );

    console.log("\n✅ STEP 1 COMPLETE: Keys and CSR generated and stored.");
    console.log(
      `📁 Location: onboarding_data/${dto.commonName.toLowerCase().replace(/\s+/g, "_")}/`
    );

    return {
      privateKey,
      csr,
      message: `Step 1 complete for ${dto.commonName}. Please use Step 2 (issue-csid) with an OTP to get your certificate.`,
    };
  }

  /**
   * issueCsid
   *
   * Triggers Step 2 of Onboarding: Requesting the Certificate.
   * It reads the CSR generated in Step 1 from disk and sends it along with the OTP
   * to ZATCA. The resulting CSID is what allows the system to sign and report invoices.
   */
  async issueCsid(dto: IssueCsidDto) {
    console.log("\n[STEP 2 ONLY] 🚀 STARTING INDEPENDENT CSID ISSUANCE...");
    console.log(`👤 Targeted Common Name: ${dto.commonName}`);
    console.log(`🔑 Provided OTP: ${dto.otp}`);

    const csrPath = this.fileManager.getOnboardingFilePath(
      dto.commonName,
      "egs-registration.csr"
    );
    console.log(`🔍 Searching for CSR at: ${csrPath}`);

    if (!(await this.fileManager.exists(csrPath))) {
      console.log("❌ ERROR: CSR file not found on disk.");
      throw new NotFoundException(
        `CSR file not found for ${dto.commonName}. Please run Step 1 (onboard) first.`
      );
    }

    console.log("✅ CSR file located. Reading content...");
    const csr = await this.fileManager.readFile(csrPath);
    console.log("✅ CSR content loaded successfully.");

    // We don't have the private key string here easily if it's only on disk,
    // but we return what we get from the API
    console.log("🚀 [STEP 2.2] Calling ZATCA to issue certificate...");
    return this.finishOnboarding(
      dto.commonName,
      csr,
      dto.otp,
      !!dto.production
    );
  }

  /**
   * finishOnboarding
   *
   * A private utility that finalizes the onboarding by calling the ZATCA client
   * and ensuring that the issued Certificate and Secret are securely saved for later use.
   */
  private async finishOnboarding(
    commonName: string,
    csr: string,
    otp: string,
    production: boolean,
    privateKey?: string
  ) {
    console.log("\n[API CALL] 🚀 Triggering ZATCA Compliance API...");
    console.log(
      `🌐 Target Environment: ${production ? "PRODUCTION" : "SANDBOX"}`
    );

    const issuedData = await this.zatcaClient.issueComplianceCertificate(
      csr,
      otp,
      production
    );

    console.log("✅ [API CALL] Response received from ZATCA.");
    console.log(`🆔 RequestID: ${issuedData.requestID}`);

    // Persist the certificate and secret
    console.log("📂 [STORAGE] Saving security tokens to disk...");
    await this.fileManager.writeOnboardingFile(
      commonName,
      "ccsid-certificate.pem",
      issuedData.binarySecurityToken
    );
    await this.fileManager.writeOnboardingFile(
      commonName,
      "ccsid-secret.txt",
      issuedData.secret
    );
    console.log(
      "✅ [STORAGE] ccsid-certificate.pem and ccsid-secret.txt saved successfully."
    );

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: ONBOARDING PROCESS FINISHED");
    console.log(
      `📁 Workspace: onboarding_data/${commonName.toLowerCase().replace(/\s+/g, "_")}/`
    );
    console.log("==================================================\n");

    return {
      privateKey,
      certificate: issuedData.binarySecurityToken,
      secret: issuedData.secret,
      requestId: issuedData.requestID,
      message: `Compliance CSID issued and stored for ${commonName}.`,
    };
  }

  /**
   * checkInvoiceCompliance
   *
   * Corresponds to Step 4. It loads a signed XML from disk, extracts its hash/UUID,
   * and sends it to ZATCA's Compliance Check API to ensure it passes all validation rules.
   */
  async checkInvoiceCompliance(dto: CheckComplianceDto) {
    const { commonName, invoiceSerialNumber } = dto;
    console.log("\n[STEP 4] 🛡️ STARTING COMPLIANCE CHECK...");
    console.log(`👤 Profile: ${commonName}`);
    console.log(`🔢 Serial: ${invoiceSerialNumber}`);

    // 1. Load Security Tokens
    const certPath = this.fileManager.getOnboardingFilePath(
      commonName,
      "ccsid-certificate.pem"
    );
    const secretPath = this.fileManager.getOnboardingFilePath(
      commonName,
      "ccsid-secret.txt"
    );

    if (
      !(await this.fileManager.exists(certPath)) ||
      !(await this.fileManager.exists(secretPath))
    ) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName}. Please run Step 2 (issue-csid) first.`
      );
    }

    console.log("📂 [STEP 4.1] Loading security tokens...");
    const certificateRaw = await this.fileManager.readFile(certPath);
    const secretRaw = await this.fileManager.readFile(secretPath);

    const certificate = certificateRaw.trim();
    const secret = secretRaw.trim();

    console.log(`✅ Certificate Loaded (Length: ${certificate.length})`);
    console.log(`✅ Secret Loaded (Length: ${secret.length})`);

    // 2. Load Signed XML
    const tempDir = await this.fileManager.getTempDir(commonName);

    // Robustness: Strip _signed suffix if the user provided it (preventing double suffix)
    const cleanSerialNumber = invoiceSerialNumber.replace(/_signed$/i, "");

    const signedPath = require("path").join(
      tempDir,
      `${cleanSerialNumber}_signed.xml`
    );

    if (!(await this.fileManager.exists(signedPath))) {
      this.logger.error(`Signed XML not found at: ${signedPath}`);
      throw new NotFoundException(
        `Signed XML not found for ${cleanSerialNumber}. Check if commonName "${commonName}" matches the invoice prefix.`
      );
    }

    const signedXml = await this.fileManager.readFile(signedPath);

    const { uuid, invoiceHash } = this.extractInvoiceMetadata(signedXml);

    console.log("--------------------------------------------------");
    console.log("🔍 [STEP 4.3] EXTRACTION RESULTS");
    console.log(`🆔 Extracted UUID: ${uuid}`);
    console.log(`📦 Extracted Hash: ${invoiceHash}`);
    console.log(`📏 Hash Length: ${invoiceHash.length}`);
    console.log("--------------------------------------------------");

    // 4. Call ZATCA API
    const signedXmlBase64 = Buffer.from(signedXml).toString("base64");
    console.log(
      `🚀 [STEP 4.4] Routing to ZATCA Client... (XML Base64 length: ${signedXmlBase64.length})`
    );

    const result = await this.zatcaClient.checkCompliance(
      invoiceHash,
      uuid,
      signedXmlBase64,
      certificate,
      secret,
      false
    );

    // 5. Store the compliance result for record-keeping
    const reportPath = await this.fileManager.writeTempFile(
      commonName,
      `${invoiceSerialNumber}_compliance_report.json`,
      JSON.stringify(result, null, 2)
    );
    console.log(`✅ [STORAGE] Compliance report saved to: ${reportPath}`);

    return {
      ...result,
      reportPath,
      message: `Compliance check completed for ${invoiceSerialNumber}. Results saved to disk.`,
    };
  }

  /**
   * submitToZatca
   *
   * The final Step 5: Production/Simulation Submission.
   * This is the "Smart Router". It reads the signed XML, detects if it's a B2B
   * (Standard) or B2C (Simplified) invoice, and automatically calls either
   * 'Clearance' or 'Reporting' endpoints as required by Saudi law.
   */
  async submitToZatca(dto: SubmitZatcaDto) {
    const { commonName, invoiceSerialNumber, production } = dto;
    const isProduction = !!production;

    console.log("\n[SUBMISSION] 🚀 STARTING ZATCA SUBMISSION...");
    console.log(`👤 Profile: ${commonName}`);
    console.log(`🔢 Serial: ${invoiceSerialNumber}`);

    // 1. Load Security Tokens
    const certPath = this.fileManager.getOnboardingFilePath(
      commonName,
      "ccsid-certificate.pem"
    );
    const secretPath = this.fileManager.getOnboardingFilePath(
      commonName,
      "ccsid-secret.txt"
    );

    if (
      !(await this.fileManager.exists(certPath)) ||
      !(await this.fileManager.exists(secretPath))
    ) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName}.`
      );
    }

    const certificate = (await this.fileManager.readFile(certPath)).trim();
    const secret = (await this.fileManager.readFile(secretPath)).trim();

    // 2. Load Signed XML
    const tempDir = await this.fileManager.getTempDir(commonName);
    const cleanSerialNumber = invoiceSerialNumber.replace(/_signed$/i, "");
    const signedPath = require("path").join(
      tempDir,
      `${cleanSerialNumber}_signed.xml`
    );

    if (!(await this.fileManager.exists(signedPath))) {
      throw new NotFoundException(
        `Signed XML not found for ${cleanSerialNumber}.`
      );
    }

    const signedXml = await this.fileManager.readFile(signedPath);
    const signedXmlBase64 = Buffer.from(signedXml).toString("base64");

    // 3. Extract Metadata & Strategy (Clearance vs Reporting)
    const { uuid, invoiceHash, typeCode } =
      this.extractInvoiceMetadata(signedXml);

    // ZATCA Rule: 01xxxx is Standard (Clearance), 02xxxx is Simplified (Reporting)
    const isStandard = typeCode.startsWith("01");
    const submissionType = isStandard ? "CLEARANCE" : "REPORTING";

    console.log(
      `📍 Detected Type: ${isStandard ? "STANDARD (B2B)" : "SIMPLIFIED (B2C)"}`
    );
    console.log(`🛰️ Routing to ${submissionType} endpoint...`);

    // 4. API Execution
    let result;
    if (isStandard) {
      result = await this.zatcaClient.clearInvoice(
        invoiceHash,
        uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    } else {
      result = await this.zatcaClient.reportInvoice(
        invoiceHash,
        uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    }

    // 5. Save Evidence
    const resultPath = await this.fileManager.writeTempFile(
      commonName,
      `${invoiceSerialNumber}_zatca_result.json`,
      JSON.stringify(result, null, 2)
    );

    return {
      ...result,
      submissionType,
      resultPath,
      message: `Invoice successfully ${isStandard ? "cleared" : "reported"} by ZATCA.`,
    };
  }

  /**
   * extractInvoiceMetadata
   *
   * A helper that uses Regex to pull critical ZATCA fields (UUID, Hash, InvoiceTypeCode)
   * from the UBL XML. This avoids the overhead of a full XML parser for simple flags.
   */
  private extractInvoiceMetadata(xml: string) {
    const uuidMatch = xml.match(/<cbc:UUID>([a-f0-9-]{36})<\/cbc:UUID>/i);
    const typeCodeMatch = xml.match(
      /<cbc:InvoiceTypeCode[^>]*?name="([^"]+)"/i
    );

    const referenceMatch = xml.match(
      /<ds:Reference [^>]*?URI=""[^>]*?>[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/
    );

    let invoiceHash = "";
    if (referenceMatch) {
      invoiceHash = referenceMatch[1].trim();
    } else {
      const fallback = xml.match(
        /<ds:DigestValue>([^<]{44})<\/ds:DigestValue>/
      );
      if (fallback) invoiceHash = fallback[1];
    }

    if (!uuidMatch || !invoiceHash || !typeCodeMatch) {
      throw new BadRequestException(
        "Could not extract UUID, Hash, or TypeCode from XML."
      );
    }

    return {
      uuid: uuidMatch[1],
      invoiceHash: invoiceHash,
      typeCode: typeCodeMatch[1],
    };
  }
  /**
   * List all onboarded EGS units (hotels) with detailed info from properties
   */
  async listOnboardedEgs() {
    this.logger.log("Listing all onboarded EGS units with extended data...");
    const dirs = await this.fileManager.listOnboardingDirectories();
    const egsList = [];

    for (const dir of dirs) {
      const config = await this.fileManager.readOnboardingConfig(dir);
      if (config["csr.common.name"]) {
        egsList.push({
          slug: config["csr.common.name"],
          organizationName:
            config["csr.organization.name"] ||
            dir
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" "),
          vatNumber: config["csr.organization.identifier"] || "",
        });
      }
    }

    return egsList;
  }
}
