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
    console.log("🛠️  FATOORA CLI: STARTING CSR GENERATION");
    console.log(`📍 Common Name: ${commonName}`);

    this.logger.debug(
      `Generating CSR and Private Key for [${commonName}] via Fatoora CLI`
    );

    // Use descriptive filenames for the onboarding process
    const propsFileName = `onboarding-config.properties`;
    const privateKeyName = `egs-signing-key.pem`;
    const csrName = `egs-registration.csr`;

    console.log(
      `🔹 Step 1: Writing properties file [${propsFileName}] to folder...`
    );
    const propsPath = await this.fileManager.writeOnboardingFile(
      commonName,
      propsFileName,
      csrConfigProps
    );

    const onboardingDir = await this.fileManager.getOnboardingDir(commonName);

    console.log(`✅ Step 1: Configuration saved at ${propsPath}`);

    try {
      // Execute command inside the target directory to ensure files land there
      // Command: cd <dir> && fatoora -csr -csrConfig <props> -privateKey <out_key> -generatedCsr <out_csr> -pem
      const command = `cd "${onboardingDir}" && fatoora -csr -csrConfig "${propsFileName}" -privateKey "${privateKeyName}" -generatedCsr "${csrName}" -pem`;

      console.log(`🔹 Step 2: Executing Fatoora CLI command...`);
      console.log(`💻 Command: ${command}`);

      const result = await this.cliExecutor.execute(command);

      if (result.stdout) {
        console.log(`📝 CLI Output:\n${result.stdout.trim()}`);
      }

      // CHECK FOR SILENT FAILURES: Fatoora CLI returns 0 even on [ERROR]
      const hasErrorInOutput =
        result.stdout && result.stdout.includes("[ERROR]");

      if (result.exitCode !== 0 || hasErrorInOutput) {
        console.log(
          `❌ Step 2 Failed (Exit Code ${result.exitCode}, Error in Output: ${hasErrorInOutput})`
        );

        // Extract the error message from stdout if possible
        let errorMsg = result.stderr || "Fatoora CLI failed to generate files.";
        if (hasErrorInOutput) {
          const lines = result.stdout.split("\n");
          const errorLine = lines.find((line) => line.includes("[ERROR]"));
          if (errorLine) {
            // Extract the part after " - " and remove any wrapping quotes
            const parts = errorLine.split(" - ");
            if (parts.length > 1) {
              errorMsg = parts[1].replace(/^"(.*)"$/, "$1").trim();
            } else {
              errorMsg = errorLine.split("] ").pop() || errorLine;
            }
          }
        }

        throw new BadRequestException(errorMsg);
      }

      console.log(
        `✅ Step 2: CLI execution successful. CSR and Key generated.`
      );

      console.log(`🔹 Step 3: Reading generated files...`);

      // List files for diagnostics
      const filesAfter = await fs.readdir(onboardingDir);
      console.log(`📂 Files in folder: ${filesAfter.join(", ")}`);

      // Read the private key
      const privateKeyPath = path.join(onboardingDir, privateKeyName);
      console.log(`🔍 Checking private key at: ${privateKeyPath}`);
      if (!(await this.fileManager.exists(privateKeyPath))) {
        throw new Error(
          `Private key file was not created: ${privateKeyPath}. Available: ${filesAfter.join(", ")}`
        );
      }
      let privateKey = await this.fileManager.readFile(privateKeyPath);

      // ALIGNMENT: If the user wants it like hiltongroup, we might need the raw key content without headers
      // Usually, ZATCA expects the EC private key. hiltongroup had: MIGNAgEAMBAG...
      // egs-signing-key.pem from CLI has: -----BEGIN EC PRIVATE KEY----- ...
      if (privateKey.includes("-----BEGIN")) {
        console.log(
          "✂️ Stripping PEM headers from Private Key to match hiltongroup format..."
        );
        privateKey = privateKey
          .replace(/-----BEGIN[^-]+-----/g, "")
          .replace(/-----END[^-]+-----/g, "")
          .replace(/\s+/g, "")
          .trim();
        // Overwrite the file with the raw version to match hiltongroup exactly
        await fs.writeFile(privateKeyPath, privateKey, "utf-8");
      }

      // Read the CSR file
      const csrPath = path.join(onboardingDir, csrName);
      console.log(`🔍 Checking CSR at: ${csrPath}`);
      if (!(await this.fileManager.exists(csrPath))) {
        throw new Error(
          `CSR file was not created: ${csrPath}. Available: ${filesAfter.join(", ")}`
        );
      }

      let csr = await this.fileManager.readFile(csrPath);

      // ALIGNMENT: hiltongroup had a Base64-only file.
      // The CLI output is usually PEM. If we see PEM headers, we convert to Base64 (single line).
      if (csr.includes("-----BEGIN")) {
        console.log(
          "🔄 Converting PEM CSR to Base64 to match hiltongroup format..."
        );
        csr = csr
          .replace(/-----BEGIN[^-]+-----/g, "")
          .replace(/-----END[^-]+-----/g, "")
          .replace(/\s+/g, "")
          .trim();
        // Overwrite the file with the Base64 version to match hiltongroup exactly
        await fs.writeFile(csrPath, csr, "utf-8");
      }

      console.log(`✅ Step 3: Files read and aligned successfully.`);
      console.log("--------------------------------------------------");

      return {
        privateKey: privateKey,
        csr: csr,
      };
    } catch (error) {
      console.log(`❌ Error during CSR generation: ${error.message}`);
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
