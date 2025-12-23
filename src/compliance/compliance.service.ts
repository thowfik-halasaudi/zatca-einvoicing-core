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
      throw new BadRequestException(
        `Unit with Common Name "${dto.commonName}" already exists. To re-onboard, please delete the existing record first or use a different name.`
      );
    }

    /**
     * ==================================================
     * 2️⃣ BUILD CSR CONFIG
     * ==================================================
     */

    const csrConfig = this.cryptoCli.buildCSRConfig({
      ...dto,
      production: Boolean(dto.production),
    });

    /**
     * ==================================================
     * 3️⃣ GENERATE CSR + PRIVATE KEY (FATOORA CLI)
     * ==================================================
     */

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

    try {
      await this.prisma.egsUnit.create({
        data: createData,
      });
    } catch (e) {
      throw e;
    }

    /**
     * ==================================================
     * 6️⃣ FINAL RESPONSE
     * ==================================================
     */

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
    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName: dto.commonName },
    });

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
      await this.prisma.egsUnit.update({
        where: { commonName },
        data: {
          binarySecurityToken: issuedData.binarySecurityToken,
          secret: issuedData.secret,
          requestId: issuedData.requestID?.toString(),
        },
      });
    } catch (e) {
      throw e;
    }

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

    // 1. Load Invoice from Database
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: invoiceSerialNumber },
      include: { hash: true },
    });

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
    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName },
    });

    if (!egsUnit || !egsUnit.binarySecurityToken || !egsUnit.secret) {
      throw new NotFoundException(
        `Security tokens not found for ${commonName}. Run Issue CSID first.`
      );
    }

    const certificate = egsUnit.binarySecurityToken.trim();
    const secret = egsUnit.secret.trim();

    // 3. Prepare Data
    // We trust our DB metadata, but we can also re-extract if needed.
    // Using DB metadata is faster and safer.
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

    // 1. Load Invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoiceNumber: invoiceSerialNumber },
      include: { hash: true },
    });

    if (!invoice || !invoice.signedXml || !invoice.hash?.currentInvoiceHash) {
      throw new NotFoundException(
        `Invoice ${invoiceSerialNumber} not found or missing signed XML/hash.`
      );
    }

    // 2. Load Tokens
    const egsUnit = await this.prisma.egsUnit.findUnique({
      where: { commonName },
    });

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

    const signedXmlBase64 = Buffer.from(invoice.signedXml).toString("base64");

    // 4. Execute
    let result;
    if (isStandard) {
      result = await this.zatcaClient.clearInvoice(
        invoice.hash.currentInvoiceHash,
        invoice.uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    } else {
      result = await this.zatcaClient.reportInvoice(
        invoice.hash.currentInvoiceHash,
        invoice.uuid,
        signedXmlBase64,
        certificate,
        secret,
        isProduction
      );
    }

    // 5. Update Persistence using shared logic
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

    await this.prisma.$transaction([
      this.prisma.zatcaSubmission.upsert({
        where: { invoiceId },
        create: {
          invoiceId,
          submissionType,
          zatcaStatus: overallStatus,
          reportingStatus,
          clearanceStatus,
          zatcaResponse: result as any,
          lastAttemptAt: new Date(),
          attemptCount: 1,
        },
        update: {
          zatcaStatus: overallStatus,
          reportingStatus,
          clearanceStatus,
          zatcaResponse: result as any,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: overallStatus },
      }),
    ]);

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
  async listOnboardedEgs() {
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
