import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";
import { AxiosError } from "axios";

export interface ComplianceCertificateResponse {
  requestID: string | number;
  binarySecurityToken: string;
  secret: string;
  errors?: any[];
}

/**
 * ZatcaClientService
 *
 * This service is the low-level API client that communicates directly with ZATCA's external Gateway.
 * It handles raw HTTP requests, Basic Authentication (Base64 encoding of tokens),
 * header management (Accept-Version, OTP), and unified error parsing for all ZATCA endpoints.
 */
@Injectable()
export class ZatcaClientService {
  private readonly logger = new Logger(ZatcaClientService.name);

  private readonly sandboxUrl =
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";
  private readonly productionUrl =
    "https://gw-fatoora.zatca.gov.sa/e-invoicing/core"; // Typical for ZATCA, but check SDK for exact prod URL
  private readonly apiVersion = "V2";

  constructor(private readonly httpService: HttpService) {}

  /**
   * issueComplianceCertificate
   *
   * Corresponds to ZATCA Step 2: "Compliance CSID".
   * Takes a CSR and an OTP (from Fatoora Portal) and returns the Binary Security Token
   * and Secret needed for all subsequent authenticated API calls.
   */
  async issueComplianceCertificate(
    csr: string,
    otp: string,
    production: boolean = false
  ): Promise<ComplianceCertificateResponse> {
    const baseUrl = production ? this.productionUrl : this.sandboxUrl;
    const url = `${baseUrl}/compliance`;

    // ZATCA expects a clean base64 string in the 'csr' field.
    let base64Csr = csr.trim();
    if (base64Csr.startsWith("LS0tLS1")) {
      base64Csr = base64Csr.replace(/\s/g, "");
    } else {
      base64Csr = Buffer.from(base64Csr).toString("base64");
    }

    const payload = {
      csr: base64Csr,
    };

    const headers = {
      "Accept-Version": this.apiVersion,
      "Accept-Language": "en",
      "Content-Type": "application/json",
      OTP: otp,
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post<ComplianceCertificateResponse>(url, payload, {
          headers,
        })
      );

      const data = response.data;

      if (
        data.binarySecurityToken &&
        !data.binarySecurityToken.includes("-----BEGIN")
      ) {
        data.binarySecurityToken = `-----BEGIN CERTIFICATE-----\n${data.binarySecurityToken}\n-----END CERTIFICATE-----`;
      }

      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData: any = axiosError.response?.data;

      let errorMsg = "ZATCA API Error";
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorMsg = errorData.errors
          .map((e: any) => e.message || e.code)
          .join(", ");
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      }

      throw new BadRequestException(`Zatca API: ${errorMsg}`);
    }
  }

  /**
   * checkCompliance
   *
   * Corresponds to ZATCA Step 4: "Compliance Check".
   * This is a "dry-run" submission used during development/onboarding to verify
   * that your signed XML, QR code, and business logic are 100% compliant with ZATCA rules.
   */
  async checkCompliance(
    invoiceHash: string,
    uuid: string,
    signedXmlBase64: string,
    certificate: string,
    secret: string,
    production: boolean = false
  ): Promise<any> {
    const baseUrl = production ? this.productionUrl : this.sandboxUrl;
    const url = `${baseUrl}/compliance/invoices`;

    const strippedCert = certificate
      .replace(/-----(BEGIN|END) CERTIFICATE-----/gi, "")
      .replace(/[\r\n\s]/g, "");

    // Construct the Auth Header
    const authString = `${strippedCert}:${secret}`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    const headers = {
      "Accept-Version": this.apiVersion,
      "Accept-Language": "en",
      "Content-Type": "application/json",
      Authorization: authHeader,
    };

    const payload = {
      invoiceHash,
      uuid,
      invoice: signedXmlBase64,
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers })
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData: any = axiosError.response?.data;

      let errorMsg = "Compliance Check Failed";

      if (errorData?.validationResults?.errorMessages?.length > 0) {
        const firstErr = errorData.validationResults.errorMessages[0];
        errorMsg = `${firstErr.message} (${firstErr.code})`;
      } else if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorMsg = errorData.errors
          .map((e: any) => `${e.message} (${e.code})`)
          .join(", ");
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      }

      throw new BadRequestException(`ZATCA Compliance Check: ${errorMsg}`);
    }
  }

  /**
   * clearInvoice
   *
   * Corresponds to ZATCA Phase 2: "Clearance".
   * Used for Standard (B2B) invoices. This is a real-time call; the invoice is
   * not legally valid until ZATCA clears it and returns it with their own digital signature.
   */
  async clearInvoice(
    invoiceHash: string,
    uuid: string,
    signedXmlBase64: string,
    certificate: string,
    secret: string,
    production: boolean = false
  ): Promise<any> {
    const baseUrl = production
      ? this.productionUrl
      : "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation";
    const url = `${baseUrl}/invoices/clearance/single`;
    return this.validateInvoice(
      url,
      "CLEARANCE",
      invoiceHash,
      uuid,
      signedXmlBase64,
      certificate,
      secret
    );
  }

  /**
   * reportInvoice
   *
   * Corresponds to ZATCA Phase 2: "Reporting".
   * Used for Simplified (B2C) invoices. Can be called immediately or in batches
   * within 24 hours of issuance. It registers the sale with ZATCA for tax tracking.
   */
  async reportInvoice(
    invoiceHash: string,
    uuid: string,
    signedXmlBase64: string,
    certificate: string,
    secret: string,
    production: boolean = false
  ): Promise<any> {
    const baseUrl = production
      ? this.productionUrl
      : "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation";
    const url = `${baseUrl}/invoices/reporting/single`;
    return this.validateInvoice(
      url,
      "REPORTING",
      invoiceHash,
      uuid,
      signedXmlBase64,
      certificate,
      secret
    );
  }

  /**
   * validateInvoice
   *
   * A private internal helper that wraps the boiler-plate for Clearance and Reporting.
   * Both APIs share the same payload structure and Basic Auth requirements.
   */
  private async validateInvoice(
    url: string,
    type: "CLEARANCE" | "REPORTING",
    invoiceHash: string,
    uuid: string,
    signedXmlBase64: string,
    certificate: string,
    secret: string
  ): Promise<any> {
    const strippedCert = certificate
      .replace(/-----(BEGIN|END) CERTIFICATE-----/gi, "")
      .replace(/[\r\n\s]/g, "");

    const authString = `${strippedCert}:${secret}`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    const headers = {
      "Accept-Version": this.apiVersion,
      "Accept-Language": "en",
      "Content-Type": "application/json",
      Authorization: authHeader,
    };

    const payload = {
      invoiceHash,
      uuid,
      invoice: signedXmlBase64,
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers })
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData: any = axiosError.response?.data;

      let errorMsg = `${type} Submission Failed`;

      if (errorData?.validationResults?.errorMessages?.length > 0) {
        const firstErr = errorData.validationResults.errorMessages[0];
        errorMsg = `${firstErr.message} (${firstErr.code})`;
      } else if (errorData?.errors && Array.isArray(errorData.errors)) {
        errorMsg = errorData.errors
          .map((e: any) => `${e.message} (${e.code})`)
          .join(", ");
      } else if (errorData?.message) {
        errorMsg = errorData.message;
      }

      throw new BadRequestException(`ZATCA ${type}: ${errorMsg}`);
    }
  }
}
