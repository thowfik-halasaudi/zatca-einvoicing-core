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
import { PrismaService } from "../prisma/prisma.service";
import * as path from "path";
import { Prisma } from "@prisma/client";

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
    private readonly fileManager: FileManagerService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * onboardEgs
   *
   * Triggers the Step 1 of Onboarding: Local Key and CSR Generation.
   * It uses the CryptoCliService to talk to the Fatoora Java SDK.
   * The generated data are saved directly to PostgreSQL.
   */
  async onboardEgs(dto: OnboardEgsDto) {
    console.log("==================================================");
    console.log("🚀 STARTING KEY & CSR GENERATION (STEP 1 ONLY)");
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`👤 Target: ${dto.commonName}`);
    console.log("==================================================");

    /**
     * ==================================================
     * 1️⃣ HARD VALIDATION (DO NOT SKIP)
     * ==================================================
     */
    if (!dto.commonName?.trim()) {
      throw new BadRequestException("commonName is required");
    }

    if (!dto.serialNumber?.trim()) {
      throw new BadRequestException("serialNumber is required");
    }

    if (!dto.organizationIdentifier?.trim()) {
      throw new BadRequestException("organizationIdentifier is required");
    }

    if (!dto.organizationName?.trim()) {
      throw new BadRequestException("organizationName is required");
    }

    /**
     * ==================================================
     * 1️⃣b CHECK IF ALREADY EXISTS (RESTRICTION)
     * ==================================================
     */
    const existingUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName: dto.commonName },
    });

    if (existingUnit) {
      this.logger.warn(
        `Attempt to re-onboard existing unit: ${dto.commonName}`
      );
      throw new BadRequestException(
        `Unit with Common Name "${dto.commonName}" already exists. To re-onboard, please delete the existing record first or use a different name.`
      );
    }

    /**
     * ==================================================
     * 2️⃣ BUILD CSR CONFIG
     * ==================================================
     */
    console.log("🛠️ [STEP 1.1] Building CSR configuration...");
    const csrConfig = this.cryptoCli.buildCSRConfig({
      ...dto,
      production: Boolean(dto.production),
    });

    /**
     * ==================================================
     * 3️⃣ GENERATE CSR + PRIVATE KEY (FATOORA CLI)
     * ==================================================
     */
    console.log("🛠️ [STEP 1.2] Generating Keys and CSR using Fatoora CLI...");
    const { privateKey, csr } = await this.cryptoCli.generateOnboardingData(
      dto.commonName,
      csrConfig
    );

    /**
     * ==================================================
     * 4️⃣ PREPARE PRISMA INPUTS (STRICT)
     * ==================================================
     */

    const createData: Prisma.EgsUnitCreateInput = {
      commonName: dto.commonName,
      serialNumber: dto.serialNumber,

      organizationIdentifier: dto.organizationIdentifier, // ✅ REQUIRED

      organizationUnitName: dto.organizationUnitName,
      organizationName: dto.organizationName,
      countryName: dto.countryName,
      invoiceType: String(dto.invoiceType),
      locationAddress: dto.locationAddress,
      industryBusinessCategory: dto.industryBusinessCategory,
      production: Boolean(dto.production),

      csr,
      privateKey,
      onboardingConfig: JSON.stringify(csrConfig),
    };

    /**
     * ==================================================
     * 5️⃣ STORE IN DATABASE
     * ==================================================
     */
    console.log("--------------------------------------------------");
    console.log("📂 [DB AUDIT] SAVING NEW EGS UNIT");
    console.log(`🆔 Common Name: ${dto.commonName}`);
    console.log("--------------------------------------------------");

    try {
      await this.prisma.egsUnit.create({
        data: createData,
      });

      console.log("✅ [DB AUDIT] CREATE SUCCESSFUL");
    } catch (e) {
      console.error("❌ [DB AUDIT] UPSERT FAILED");
      console.error(e.message);
      throw e;
    }

    /**
     * ==================================================
     * 6️⃣ FINAL RESPONSE
     * ==================================================
     */
    console.log("\n✅ STEP 1 COMPLETE: Keys and CSR generated & stored");

    return {
      csr,
      privateKey,
      commonName: dto.commonName,
      serialNumber: dto.serialNumber,
      message:
        "Step 1 complete. CSR & private key generated and stored successfully. Proceed to issue CSID.",
    };
  }

  /**
   * issueCsid
   *
   * Triggers Step 2 of Onboarding: Requesting the Certificate.
   * It reads the CSR generated in Step 1 from database and sends it along with the OTP
   * to ZATCA. The resulting CSID is what allows the system to sign and report invoices.
   */
  async issueCsid(dto: IssueCsidDto) {
    console.log("\n[STEP 2 ONLY] 🚀 STARTING INDEPENDENT CSID ISSUANCE...");
    console.log(`👤 Targeted Common Name: ${dto.commonName}`);
    console.log(`🔑 Provided OTP: ${dto.otp}`);

    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName: dto.commonName },
    });

    if (!egsUnit || !egsUnit.csr) {
      console.log("❌ ERROR: CSR data not found in database.");
      throw new NotFoundException(
        `Onboarding data (CSR) not found for ${dto.commonName} in database. Please run Step 1 (onboard) first.`
      );
    }

    console.log("✅ CSR record found in DB. Loading content...");
    const csr = egsUnit.csr;
    const privateKey = egsUnit.privateKey;
    console.log("✅ CSR and Private Key loaded successfully from database.");

    // We don't have the private key string here easily if it's only on disk,
    // but we return what we get from the API
    console.log("🚀 [STEP 2.2] Calling ZATCA to issue certificate...");
    return this.finishOnboarding(
      dto.commonName,
      csr,
      dto.otp,
      !!dto.production,
      privateKey
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

    // Persist the certificate and secret to DB
    console.log("--------------------------------------------------");
    console.log("📂 [DB AUDIT] UPDATING SECURITY TOKENS");
    console.log(`🆔 Target Common Name: ${commonName}`);
    console.log("--------------------------------------------------");

    try {
      await this.prisma.egsUnit.update({
        where: { commonName },
        data: {
          binarySecurityToken: issuedData.binarySecurityToken,
          secret: issuedData.secret,
          requestId: issuedData.requestID?.toString(),
        },
      });
      console.log("✅ [DB AUDIT] UPDATE SUCCESSFUL.");
    } catch (e) {
      console.log("❌ [DB AUDIT] UPDATE FAILED!");
      console.log(`❗ Error Detail: ${e.message}`);
      throw e;
    }

    console.log(
      "✅ [STORAGE] Certificate and Secret saved to database successfully."
    );

    console.log("\n==================================================");
    console.log("🎉 SUCCESS: ONBOARDING PROCESS FINISHED");
    console.log("💾 Data stored securely in PostgreSQL.");
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

    // 1. Load Security Tokens from DB
    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName },
    });

    if (!egsUnit || !egsUnit.binarySecurityToken || !egsUnit.secret) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName} in database. Please run Step 2 (issue-csid) first.`
      );
    }

    console.log("📂 [STEP 4.1] Loading security tokens from database...");
    const certificate = egsUnit.binarySecurityToken.trim();
    const secret = egsUnit.secret.trim();

    console.log(`✅ Certificate Loaded (Length: ${certificate.length})`);
    console.log(`✅ Secret Loaded (Length: ${secret.length})`);

    // 2. Load Signed XML
    const tempDir = await this.fileManager.getTempDir(commonName);

    // Robustness: Strip _signed suffix if the user provided it (preventing double suffix)
    const cleanSerialNumber = invoiceSerialNumber.replace(/_signed$/i, "");

    const signedPath = path.join(tempDir, `${cleanSerialNumber}_signed.xml`);

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

    // 1. Load Security Tokens from DB
    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName },
    });

    if (!egsUnit || !egsUnit.binarySecurityToken || !egsUnit.secret) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName} in database.`
      );
    }

    const certificate = egsUnit.binarySecurityToken.trim();
    const secret = egsUnit.secret.trim();

    // 2. Load Signed XML
    const tempDir = await this.fileManager.getTempDir(commonName);
    const cleanSerialNumber = invoiceSerialNumber.replace(/_signed$/i, "");
    const signedPath = path.join(tempDir, `${cleanSerialNumber}_signed.xml`);

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
  async listOnboardedEgs() {
    this.logger.log("Listing all onboarded EGS units from database...");

    const units = await this.prisma.egsUnit.findMany({
      orderBy: { commonName: "asc" },
      select: {
        commonName: true,
        organizationName: true,
        organizationIdentifier: true,
        binarySecurityToken: true,
        countryName: true,
        production: true,
      },
    });

    return units.map((u) => ({
      slug: u.commonName,
      organizationName: u.organizationName,
      vatNumber: u.organizationIdentifier, // ✅ ACTUAL VAT NUMBER
      status: u.binarySecurityToken ? "Onboarded" : "Pending",
      country: u.countryName,
      production: u.production,
    }));
  }
}
