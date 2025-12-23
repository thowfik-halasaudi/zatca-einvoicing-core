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
    console.log("--------------------------------------------------");
    console.log("🛠️  FATOORA CLI: STARTING CSR GENERATION (TEMP)");
    console.log(`📍 Common Name: ${commonName}`);

    this.logger.debug(
      `Generating CSR and Private Key for [${commonName}] via Fatoora CLI (Temp Folder)`
    );

    // Use absolute temp directory to avoid path confusion between backend/core
    const tempOnboardingDir = await this.fileManager.getTempDir(
      `onboarding_${Date.now()}`
    );

    // Use descriptive filenames
    const propsFileName = `onboarding-config.properties`;
    const privateKeyName = `egs-signing-key.pem`;
    const csrName = `egs-registration.csr`;

    const propsPath = path.join(tempOnboardingDir, propsFileName);

    console.log(
      `🔹 Step 1: Writing properties file [${propsFileName}] to temp folder...`
    );
    await fs.writeFile(propsPath, csrConfigProps, "utf-8");

    console.log(`✅ Step 1: Configuration saved at ${propsPath}`);

    try {
      // Execute command inside the target directory
      const command = `cd "${tempOnboardingDir}" && fatoora -csr -csrConfig "${propsFileName}" -privateKey "${privateKeyName}" -generatedCsr "${csrName}" -pem`;

      console.log(`🔹 Step 2: Executing Fatoora CLI command...`);
      console.log(`💻 Command: ${command}`);

      const result = await this.cliExecutor.execute(command);

      if (result.stdout) {
        console.log(`📝 CLI Output:\n${result.stdout.trim()}`);
      }

      const hasErrorInOutput =
        result.stdout && result.stdout.includes("[ERROR]");

      if (result.exitCode !== 0 || hasErrorInOutput) {
        console.log(`❌ Step 2 Failed`);
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

      console.log(`✅ Step 2: CLI execution successful.`);

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
        console.log("✂️ Stripping PEM headers from Private Key...");
        privateKey = privateKey
          .replace(/-----BEGIN[^-]+-----/g, "")
          .replace(/-----END[^-]+-----/g, "")
          .replace(/\s+/g, "")
          .trim();
      }

      // Encode CSR to Base64 (ZATCA expects Base64 of PEM)
      const base64Csr = Buffer.from(csr).toString("base64");
      csr = base64Csr;

      console.log(`✅ Step 3: Files read and encoded successfully.`);

      // CLEANUP: Remove the entire temp onboarding directory
      console.log(`🧹 Cleaning up temp folder: ${tempOnboardingDir}`);
      await fs.rm(tempOnboardingDir, { recursive: true, force: true });

      console.log("--------------------------------------------------");

      return {
        privateKey: privateKey,
        csr: csr,
      };
    } catch (error) {
      console.log(`❌ Error during CSR generation: ${error.message}`);
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
    this.logger.debug(
      "Building CSR configuration (Properties format for Fatoora CLI)"
    );

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
