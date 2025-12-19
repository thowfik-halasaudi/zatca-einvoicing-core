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

      // Read the private key (it respects the filename)
      const privateKeyPath = this.fileManager.getOnboardingFilePath(
        commonName.toLowerCase(),
        privateKeyName
      );

      if (!(await this.fileManager.exists(privateKeyPath))) {
        throw new Error(`Private key file was not created: ${privateKeyPath}`);
      }
      const privateKey = await this.fileManager.readFile(privateKeyPath);

      // Find the CSR file (it ignores the filename and uses generated-csr-<timestamp>.csr)
      const dirContents = await fs.readdir(onboardingDir);
      const generatedCsrFile = dirContents.find(
        (f) => f.startsWith("generated-csr-") && f.endsWith(".csr")
      );

      if (!generatedCsrFile) {
        throw new Error(
          `Could not find generated CSR file in ${onboardingDir}`
        );
      }

      const csrPathOriginal = path.join(onboardingDir, generatedCsrFile);
      const csrPathTarget = path.join(onboardingDir, csrName);

      console.log(
        `🔍 Found generated CSR file: ${generatedCsrFile}. Renaming to ${csrName}...`
      );
      await fs.rename(csrPathOriginal, csrPathTarget);

      const csr = await this.fileManager.readFile(csrPathTarget);

      console.log(`✅ Step 3: Files read successfully from disk.`);
      console.log("--------------------------------------------------");

      return {
        privateKey: privateKey.trim(),
        csr: csr.trim(),
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
