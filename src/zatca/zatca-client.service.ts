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
   * Request a Compliance Certificate (Step 2)
   *
   * As per ZATCA Developer Portal API:
   * POST /compliance
   */
  async issueComplianceCertificate(
    csr: string,
    otp: string,
    production: boolean = false
  ): Promise<ComplianceCertificateResponse> {
    const baseUrl = production ? this.productionUrl : this.sandboxUrl;
    const url = `${baseUrl}/compliance`;

    this.logger.debug(`Issuing compliance certificate via ZATCA API: ${url}`);

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

    console.log("--------------------------------------------------");
    console.log("🚀 SENDING REQUEST TO ZATCA");
    console.log(`📡 URL: ${url}`);
    console.log(`🔑 OTP: ${otp}`);
    console.log(
      `📦 Payload (CSR first 50 chars): ${payload.csr.substring(0, 50)}...`
    );
    console.log("--------------------------------------------------");

    try {
      const response = await lastValueFrom(
        this.httpService.post<ComplianceCertificateResponse>(url, payload, {
          headers,
        })
      );

      const data = response.data;
      console.log("✅ [ZATCA] Received Successful Response.");

      if (
        data.binarySecurityToken &&
        !data.binarySecurityToken.includes("-----BEGIN")
      ) {
        data.binarySecurityToken = `-----BEGIN CERTIFICATE-----\n${data.binarySecurityToken}\n-----END CERTIFICATE-----`;
      }

      this.logger.log(
        `Compliance certificate issued successfully. RequestID: ${data.requestID}`
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData: any = axiosError.response?.data;

      console.log("❌ [ZATCA] API Error Response:");
      console.log(`Status: ${axiosError.response?.status}`);
      console.log(`Body: ${JSON.stringify(errorData, null, 2)}`);

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
   * Check Invoice Compliance (Step 4)
   *
   * As per ZATCA Developer Portal API:
   * POST /compliance/invoices
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

    this.logger.debug(`Checking invoice compliance via ZATCA API: ${url}`);

    const strippedCert = certificate
      .replace(/-----(BEGIN|END) CERTIFICATE-----/gi, "")
      .replace(/[\r\n\s]/g, "");

    // Construct the Auth Header
    // ZATCA expects: Basic base64(binarySecurityToken + ":" + secret)
    // Since strippedCert (the binarySecurityToken) is already base64, we use it as-is.
    const authString = `${strippedCert}:${secret}`;
    const authHeader = `Basic ${Buffer.from(authString).toString("base64")}`;

    console.log("--------------------------------------------------");
    console.log("🛡️ [ZATCA CLIENT] PREPARING AUTH");
    console.log(
      `🔐 Token (Username) prefix: ${strippedCert.substring(0, 15)}...`
    );
    console.log(`� Secret (Password) prefix: ${secret.substring(0, 5)}...`);
    console.log(
      `📡 Final Auth Header prefix: ${authHeader.substring(0, 25)}...`
    );
    console.log("--------------------------------------------------");

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

    console.log("--------------------------------------------------");
    console.log("🚀 SENDING COMPLIANCE CHECK TO ZATCA");
    console.log(`📡 URL: ${url}`);
    console.log(`🆔 UUID: ${uuid}`);
    console.log(`#️⃣ Hash: ${invoiceHash}`);
    console.log("--------------------------------------------------");

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, { headers })
      );

      console.log("✅ [ZATCA] Compliance Check Response Received.");
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData: any = axiosError.response?.data;

      console.log("❌ [ZATCA] Compliance Check Failed!");
      console.log(`Status: ${axiosError.response?.status}`);
      console.log(`Body: ${JSON.stringify(errorData, null, 2)}`);

      let errorMsg = "Compliance Check Failed";

      // If ZATCA returned a validation report with errors, show the first one
      if (errorData?.validationResults?.errorMessages?.length > 0) {
        const firstErr = errorData.validationResults.errorMessages[0];
        errorMsg = `${firstErr.message} (${firstErr.code})`;
        console.log(`🚫 ZATCA Validation Error: ${errorMsg}`);
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
}
