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
import { ZatcaClientService } from "../zatca/zatca-client.service";
import { FileManagerService } from "../common/file-manager.service";

/**
 * Compliance Service
 *
 * Orchestrates CSR generation using Fatoora SDK CLI
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
   * Onboard EGS Unit - Generate Keys & CSR using Fatoora CLI
   */
  /**
   * Step 1: Onboard EGS Unit - Generate Keys & CSR locally
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
   * Step 2: Issue CSID using an existing CSR file from disk
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
   * Common logic to call ZATCA API and save results
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
   * Step 4: Check Invoice Compliance
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

    // 3. Extract UUID and Hash from XML using more specific Regex
    console.log("🔍 [EXTRACTION] Parsing signed XML for UUID and Hash...");

    // Main UUID is usually near the top, after cbc:ID
    const uuidMatch = signedXml.match(/<cbc:UUID>([a-f0-9-]{36})<\/cbc:UUID>/i);

    // The Invoice Hash is the DigestValue inside the ds:Reference that has an empty URI (URI="")
    const referenceMatch = signedXml.match(
      /<ds:Reference [^>]*?URI=""[^>]*?>[\s\S]*?<ds:DigestValue>([^<]+)<\/ds:DigestValue>/
    );
    let invoiceHash = "";

    if (referenceMatch) {
      invoiceHash = referenceMatch[1].trim();
      console.log(
        '✅ [EXTRACTION] Found Invoice Hash in <ds:Reference URI="">'
      );
    } else {
      console.log(
        "⚠️ [EXTRACTION] Primary Reference not found. Trying fallback..."
      );
      const fallback = signedXml.match(
        /<ds:DigestValue>([^<]{44})<\/ds:DigestValue>/
      );
      if (fallback) invoiceHash = fallback[1];
    }

    if (!uuidMatch || !invoiceHash) {
      console.log("❌ Extraction Failed:");
      console.log(`- UUID Match: ${uuidMatch ? "Yes" : "No"}`);
      console.log(`- Hash Found: ${invoiceHash ? "Yes" : "No"}`);
      throw new BadRequestException(
        "Could not extract a valid 36-char UUID or SHA-256 Hash from the signed XML document."
      );
    }

    const uuid = uuidMatch[1];

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
}
