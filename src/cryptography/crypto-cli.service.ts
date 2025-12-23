import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { CliExecutorService } from "../common/cli-executor.service";
import { FileManagerService } from "../common/file-manager.service";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs/promises";

/**
 * Crypto CLI Service
 *
 * EXACT REPLICATION of PHP's EGS.php cryptographic operations
 * Uses OpenSSL CLI commands instead of Node.js crypto module
 *
 * PHP Reference: zacta-phase2/ZATCA/EGS.php
 */
@Injectable()
export class CryptoCliService {
  private readonly logger = new Logger(CryptoCliService.name);

  constructor(
    private readonly cliExecutor: CliExecutorService,
    private readonly fileManager: FileManagerService
  ) {}

  /**
   * Generate CSR and Private Key using Fatoora CLI
   *
   * As per ZATCA SDK documentation:
   * fatoora -csr -csrConfig <properties_file>
   */
  async generateOnboardingData(
    commonName: string,
    csrConfigProps: string
  ): Promise<{ privateKey: string; csr: string }> {
    // Use absolute temp directory to avoid path confusion between backend/core
    const tempOnboardingDir = await this.fileManager.getTempDir(
      `onboarding_${Date.now()}`
    );

    // Use descriptive filenames
    const propsFileName = `onboarding-config.properties`;
    const privateKeyName = `egs-signing-key.pem`;
    const csrName = `egs-registration.csr`;

    const propsPath = path.join(tempOnboardingDir, propsFileName);

    await fs.writeFile(propsPath, csrConfigProps, "utf-8");

    try {
      // Execute command inside the target directory
      const command = `cd "${tempOnboardingDir}" && fatoora -csr -csrConfig "${propsFileName}" -privateKey "${privateKeyName}" -generatedCsr "${csrName}" -pem`;

      const result = await this.cliExecutor.execute(command);

      const hasErrorInOutput =
        result.stdout && result.stdout.includes("[ERROR]");

      if (result.exitCode !== 0 || hasErrorInOutput) {
        let errorMsg = result.stderr || "Fatoora CLI failed to generate files.";
        if (hasErrorInOutput) {
          const lines = result.stdout.split("\n");
          const errorLine = lines.find((line) => line.includes("[ERROR]"));
          if (errorLine) {
            const parts = errorLine.split(" - ");
            errorMsg =
              parts.length > 1
                ? parts[1].replace(/^"(.*)"$/, "$1").trim()
                : errorLine;
          }
        }
        throw new BadRequestException(errorMsg);
      }

      // Read the generated files
      const privateKeyPath = path.join(tempOnboardingDir, privateKeyName);
      const csrPath = path.join(tempOnboardingDir, csrName);

      if (
        !(await this.fileManager.exists(privateKeyPath)) ||
        !(await this.fileManager.exists(csrPath))
      ) {
        throw new Error(
          `CLI reported success but files were not found in ${tempOnboardingDir}`
        );
      }

      let privateKey = await fs.readFile(privateKeyPath, "utf-8");
      let csr = await fs.readFile(csrPath, "utf-8");

      // Strip PEM headers from Private Key to match format
      if (privateKey.includes("-----BEGIN")) {
        privateKey = privateKey
          .replace(/-----BEGIN[^-]+-----/g, "")
          .replace(/-----END[^-]+-----/g, "")
          .replace(/\s+/g, "")
          .trim();
      }

      // Encode CSR to Base64 (ZATCA expects Base64 of PEM)
      const base64Csr = Buffer.from(csr).toString("base64");
      csr = base64Csr;

      // CLEANUP: Remove the entire temp onboarding directory
      await fs.rm(tempOnboardingDir, { recursive: true, force: true });

      return {
        privateKey: privateKey,
        csr: csr,
      };
    } catch (error) {
      // Attempt cleanup even on failure
      try {
        await fs.rm(tempOnboardingDir, { recursive: true, force: true });
      } catch (e) {}
      throw error;
    }
  }

  buildCSRConfig(config: {
    commonName: string;
    serialNumber: string;
    organizationIdentifier: string;
    organizationUnitName: string;
    organizationName: string;
    countryName: string;
    invoiceType: string;
    locationAddress: string;
    industryBusinessCategory: string;
    production: boolean;
  }): string {
    // Fatoora CLI requires .properties format
    // Key names must exactly match ZATCA sample properties
    return [
      `csr.common.name=${config.commonName}`,
      `csr.serial.number=${config.serialNumber}`,
      `csr.organization.identifier=${config.organizationIdentifier}`,
      `csr.organization.unit.name=${config.organizationUnitName}`,
      `csr.organization.name=${config.organizationName}`,
      `csr.country.name=${config.countryName}`,
      `csr.invoice.type=${config.invoiceType}`,
      `csr.location.address=${config.locationAddress}`,
      `csr.industry.business.category=${config.industryBusinessCategory}`,
      `csr.template.name=${config.production ? "ZATCA-Code-Signing" : "TSTZATCA-Code-Signing"}`,
    ].join("\n");
  }
}
