/**
 * Compliance Service
 *
 * The "Brain" of the ZATCA integration.
 * Orchestrates high-level onboarding flows, CSR generation, and submission logic.
 * Delegates database operations to ComplianceRepository.
 */
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
import { ComplianceRepository } from "./compliance.repository"; // Repository
import { InvoiceRepository } from "../invoice/invoice.repository"; // Repository
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
    private readonly complianceRepo: ComplianceRepository, // Injected Repo
    private readonly invoiceRepo: InvoiceRepository // Injected Repo
  ) {}

  /**
   * onboardEgs
   *
   * Triggers the Step 1 of Onboarding: Local Key and CSR Generation.
   * It uses the CryptoCliService to talk to the Fatoora Java SDK.
   * The generated data are saved directly to PostgreSQL.
   */
  async onboardEgs(dto: OnboardEgsDto) {
    /* HARD VALIDATION (DO NOT SKIP) */
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

    /* CHECK IF ALREADY EXISTS (RESTRICTION) */
    const existingUnit = await this.complianceRepo.findByCommonName(
      dto.commonName
    );

    if (existingUnit) {
      throw new BadRequestException(
        `Unit with Common Name "${dto.commonName}" already exists. To re-onboard, please delete the existing record first or use a different name.`
      );
    }

    /* BUILD CSR CONFIG */

    const csrConfig = this.cryptoCli.buildCSRConfig({
      ...dto,
      production: Boolean(dto.production),
    });

    /* GENERATE CSR + PRIVATE KEY (FATOORA CLI) */

    const { privateKey, csr } = await this.cryptoCli.generateOnboardingData(
      dto.commonName,
      csrConfig
    );

    /* PREPARE PRISMA INPUTS (STRICT) */

    const createData: Prisma.EgsUnitCreateInput = {
      commonName: dto.commonName,
      serialNumber: dto.serialNumber,

      organizationIdentifier: dto.organizationIdentifier, // REQUIRED

      organizationUnitName: dto.organizationUnitName,
      organizationName: dto.organizationName,
      countryName: dto.countryName,
      invoiceType: String(dto.invoiceType),
      // Address fields - Map from DTO with defaults
      street: dto.street || "Unknown",
      buildingNumber: dto.buildingNumber || "0000",
      city: dto.city || "Riyadh",
      district: dto.district || "District",
      postalCode: dto.postalCode || "00000",
      countryCode: "SA", // Default to SA as implicit in this context
      industryBusinessCategory: dto.industryBusinessCategory,
      production: Boolean(dto.production),
      propertyId: dto.propertyId,

      csr,
      privateKey,
      onboardingConfig: JSON.stringify(csrConfig),
    };

    /* 5️⃣ STORE IN DATABASE */

    try {
      await this.complianceRepo.createEgsUnit(createData);
    } catch (e) {
      throw e;
    }

    /* FINAL RESPONSE */

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
    const egsUnit = await this.complianceRepo.findByCommonName(dto.commonName);

    if (!egsUnit || !egsUnit.csr) {
      throw new NotFoundException(
        `Onboarding data (CSR) not found for ${dto.commonName} in database. Please run Step 1 (onboard) first.`
      );
    }

    const csr = egsUnit.csr;
    const privateKey = egsUnit.privateKey;

    // We don't have the private key string here easily if it's only on disk,
    // but we return what we get from the API
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
    const issuedData = await this.zatcaClient.issueComplianceCertificate(
      csr,
      otp,
      production
    );

    try {
      // Step 3: Persist COMPLIANCE Credentials
      await this.complianceRepo.updateEgsUnit(commonName, {
        complianceBinarySecurityToken: issuedData.binarySecurityToken,
        complianceSecret: issuedData.secret,
        complianceRequestId: issuedData.requestID?.toString(),

        // Legacy/Fallback: Also update main fields so step 3+4 works before Production CSID
        binarySecurityToken: issuedData.binarySecurityToken,
        secret: issuedData.secret,
        requestId: issuedData.requestID?.toString(),
      });
    } catch (e) {
      throw e;
    }

    return {
      privateKey,
      certificate: issuedData.binarySecurityToken,
      secret: issuedData.secret,
      requestId: issuedData.requestID,
      message: `Compliance CSID issued and stored for ${commonName}. You can now run Compliance Checks.`,
    };
  }

  /**
   * issueProductionCsid
   *
   * Triggers Step 5 of Onboarding: Requesting the Final Production CSID.
   * This MUST be called after 'checkCompliance' has successfully cleared/reported checks.
   */
  async issueProductionCsid(dto: { commonName: string; production?: boolean }) {
    const { commonName, production } = dto;

    // 1. Get EgsUnit
    const egsUnit = await this.complianceRepo.findByCommonName(commonName);

    if (!egsUnit) {
      throw new NotFoundException(`EGS Unit ${commonName} not found.`);
    }

    // 2. Validate Compliance Credentials existence
    if (
      !egsUnit.complianceBinarySecurityToken ||
      !egsUnit.complianceSecret ||
      !egsUnit.complianceRequestId
    ) {
      // Fallback to legacy fields if migration happened halfway
      if (egsUnit.binarySecurityToken && egsUnit.secret && egsUnit.requestId) {
        // Use legacy fields as compliance fields
      } else {
        throw new BadRequestException(
          `Compliance CSID credentials missing. Please run 'issue-csid' (Step 2) first.`
        );
      }
    }

    const compCert =
      egsUnit.complianceBinarySecurityToken || egsUnit.binarySecurityToken!;
    const compSecret = egsUnit.complianceSecret || egsUnit.secret!;
    const compReqId =
      egsUnit.complianceRequestId || egsUnit.requestId!.toString();

    // 3. Call ZATCA Production CSID API
    const result = await this.zatcaClient.issueProductionCertificate(
      compReqId,
      compCert,
      compSecret,
      production || egsUnit.production
    );

    // 4. Persist Production Credentials
    // At this point, the EGS is FULLY ONBOARDED.
    // We update the "Active" fields (binarySecurityToken/secret) to use the Production ones.
    await this.complianceRepo.updateEgsUnit(commonName, {
      productionBinarySecurityToken: result.binarySecurityToken,
      productionSecret: result.secret,
      productionRequestId: result.requestID?.toString(),

      // OVERWRITE Active Credentials with Production ones
      binarySecurityToken: result.binarySecurityToken,
      secret: result.secret,
      requestId: result.requestID?.toString(),
    });

    return {
      commonName,
      productionCsid: result.binarySecurityToken,
      message: "Production CSID acquired successfully. EGS is now Live.",
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

    // 1. Load Invoice from Repository
    const invoice =
      await this.invoiceRepo.findByInvoiceNumber(invoiceSerialNumber);

    if (!invoice) {
      throw new NotFoundException(
        `Invoice ${invoiceSerialNumber} not found in database.`
      );
    }

    if (!invoice.signedXml) {
      throw new BadRequestException(
        `Invoice ${invoiceSerialNumber} does not have signed XML stored.`
      );
    }

    // 2. Load Security Tokens
    const egsUnit = await this.complianceRepo.findByCommonName(commonName);

    if (!egsUnit || !egsUnit.binarySecurityToken || !egsUnit.secret) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName}. Run Issue CSID first.`
      );
    }

    const certificate = egsUnit.binarySecurityToken.trim();
    const secret = egsUnit.secret.trim();

    // 3. Prepare Data
    // we use invoice.hash which is retrieved by findByInvoiceNumber via include
    const uuid = invoice.uuid;
    const invoiceHash = invoice.hash?.currentInvoiceHash;

    if (!invoiceHash) {
      throw new BadRequestException(
        "Invoice hash missing from database record."
      );
    }

    // 4. Call ZATCA API
    const signedXmlBase64 = Buffer.from(invoice.signedXml).toString("base64");

    const result = await this.zatcaClient.checkCompliance(
      invoiceHash,
      uuid,
      signedXmlBase64,
      certificate,
      secret,
      false // Check is usually sandbox
    );

    // 5. Update Status in Database (PERSISTENCE FIX)
    const isStandard = invoice.invoiceTypeCodeName.startsWith("01");
    const submissionType = isStandard ? "CLEARANCE" : "REPORTING";
    const overallStatus = await this.updateSubmissionStatus(
      invoice.id,
      result,
      submissionType,
      isStandard
    );

    return {
      ...result,
      overallStatus,
      message: "Compliance check pass completed successfully.",
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

    console.log("\n========================================");
    console.log("[SUBMIT_TO_ZATCA] Starting submission...");
    console.log("[SUBMIT_TO_ZATCA] Common Name:", commonName);
    console.log("[SUBMIT_TO_ZATCA] Invoice Serial:", invoiceSerialNumber);
    console.log("[SUBMIT_TO_ZATCA] Production Mode:", isProduction);

    // 1. Load Invoice
    const invoice =
      await this.invoiceRepo.findByInvoiceNumber(invoiceSerialNumber);

    if (!invoice || !invoice.signedXml || !invoice.hash?.currentInvoiceHash) {
      console.error("[SUBMIT_TO_ZATCA] Invoice not found or missing data");
      throw new NotFoundException(
        `Invoice ${invoiceSerialNumber} not found or missing signed XML/hash.`
      );
    }

    console.log("[SUBMIT_TO_ZATCA] Invoice loaded successfully");
    console.log("[SUBMIT_TO_ZATCA] Invoice UUID:", invoice.uuid);
    console.log(
      "[SUBMIT_TO_ZATCA] Invoice Type Code Name:",
      invoice.invoiceTypeCodeName
    );
    console.log(
      "[SUBMIT_TO_ZATCA] Invoice Hash:",
      invoice.hash.currentInvoiceHash
    );

    // 2. Load Tokens
    const egsUnit = await this.complianceRepo.findByCommonName(commonName);

    if (!egsUnit || !egsUnit.binarySecurityToken || !egsUnit.secret) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName}.`
      );
    }

    const certificate = egsUnit.binarySecurityToken.trim();
    const secret = egsUnit.secret.trim();

    // 3. Strategy
    // Determine type from Invoice Table metadata
    // ZATCA Rule: 01xxxx is Standard (Clearance), 02xxxx is Simplified (Reporting)
    const isStandard = invoice.invoiceTypeCodeName.startsWith("01");
    const submissionType = isStandard ? "CLEARANCE" : "REPORTING";

    console.log(
      "[SUBMIT_TO_ZATCA] Invoice Type:",
      isStandard ? "STANDARD (B2B)" : "SIMPLIFIED (B2C)"
    );
    console.log("[SUBMIT_TO_ZATCA] Submission Type:", submissionType);
    console.log(
      "[SUBMIT_TO_ZATCA] ZATCA Endpoint:",
      isStandard ? "CLEARANCE" : "REPORTING"
    );

    const signedXmlBase64 = Buffer.from(invoice.signedXml).toString("base64");

    // 4. Execute
    console.log("[SUBMIT_TO_ZATCA] Calling ZATCA API...");
    let result;
    if (isStandard) {
      console.log("[SUBMIT_TO_ZATCA] Calling clearInvoice...");
      result = await this.zatcaClient.clearInvoice(
        invoice.hash.currentInvoiceHash,
        invoice.uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    } else {
      console.log("[SUBMIT_TO_ZATCA] Calling reportInvoice...");
      result = await this.zatcaClient.reportInvoice(
        invoice.hash.currentInvoiceHash,
        invoice.uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    }

    console.log("[SUBMIT_TO_ZATCA] ZATCA API Response received");
    console.log(
      "[SUBMIT_TO_ZATCA] Reporting Status:",
      result.reportingStatus || "N/A"
    );
    console.log(
      "[SUBMIT_TO_ZATCA] Clearance Status:",
      result.clearanceStatus || "N/A"
    );
    console.log(
      "[SUBMIT_TO_ZATCA] Validation Status:",
      result.validationResults?.status || "N/A"
    );
    console.log(
      "[SUBMIT_TO_ZATCA] Error Count:",
      result.validationResults?.errorMessages?.length || 0
    );
    console.log(
      "[SUBMIT_TO_ZATCA] Warning Count:",
      result.validationResults?.warningMessages?.length || 0
    );

    // 5. Update Persistence using shared logic (via Repo)
    const overallStatus = await this.updateSubmissionStatus(
      invoice.id,
      result,
      submissionType,
      isStandard
    );

    return {
      ...result,
      submissionType,
      message: `Invoice successfully ${isStandard ? "cleared" : "reported"} by ZATCA.`,
      overallStatus,
    };
  }

  private async updateSubmissionStatus(
    invoiceId: string,
    result: any,
    submissionType: string,
    isStandard: boolean
  ) {
    const reportingStatus = result.reportingStatus || null;
    const clearanceStatus = result.clearanceStatus || null;

    // Determine overall status mapping
    // ZATCA Success Criteria:
    // 1. reportingStatus is "REPORTED" (B2C)
    // 2. validationResults.status is "PASS" (Standard B2B Clearance often returns "PASS" without explicitly setting clearanceStatus in some SDK versions)
    // 3. clearanceStatus is "CLEARED"
    let overallStatus = "FAILED";
    if (
      reportingStatus === "REPORTED" ||
      clearanceStatus === "CLEARED" ||
      result.validationResults?.status === "PASS"
    ) {
      overallStatus = isStandard ? "CLEARED" : "REPORTED";
    }

    // Call Repository to handle logic
    await this.complianceRepo.updateSubmissionStatus(
      invoiceId,
      submissionType,
      overallStatus,
      reportingStatus,
      clearanceStatus,
      result as any
    );

    return overallStatus;
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
  async listOnboardedEgs(commonName?: string) {
    const whereClause = commonName ? { commonName } : {};

    // Use Repository
    const units = await this.complianceRepo.findAllEgsUnits(whereClause);

    return units.map((u) => {
      // Determine Status
      let status = "Not Started";
      if (u.productionBinarySecurityToken) status = "Production Live";
      else if (u.complianceBinarySecurityToken) status = "Compliance Checks";
      else if (u.binarySecurityToken) status = "Onboarded (Legacy)";
      else status = "Draft";

      return {
        slug: u.commonName,
        organizationName: u.organizationName,
        vatNumber: u.organizationIdentifier,
        status: status,
        country: u.countryName,
        production: u.production,
      };
    });
  }

  /**
   * renewEgs
   *
   * Renews the certificate. In ZATCA Phase 2, this typically means:
   * 1. Generating a new CSR (Step 1)
   * 2. Getting a new Compliance CSID (Step 2)
   * 3. (Optional) Running Checks
   * 4. Getting a new Production CSID (Step 5)
   *
   * This is effectively a "Re-Onboard" but keeping the EGS record.
   */
  async renewEgs(commonName: string) {
    // For MVP, we can treat this as "Go to Step 1".
    // The existing Onboard logic checks for existence.
    // We might need to allow overwriting in 'onboardEgs' if it's a specific 'renew' flag.
    throw new BadRequestException(
      "To renew, please restart the Onboarding Process (Step 1) with the same Common Name."
    );
  }

  /**
   * revokeEgs
   *
   * Revocation is usually handled via the Fatoora Portal manually or via specific APIs if enabled.
   */
  async revokeEgs(commonName: string) {
    // Implementation depends on ZATCA Revocation API availability.
    // Often, you just delete the keys locally.
    await this.complianceRepo.updateEgsUnit(commonName, {
      binarySecurityToken: null,
      secret: null,
      productionBinarySecurityToken: null,
      productionSecret: null,
      complianceBinarySecurityToken: null,
      complianceSecret: null,
    });
    return {
      message:
        "EGS Credentials revoked locally. Please also revoke in Fatoora Portal.",
    };
  }
}
