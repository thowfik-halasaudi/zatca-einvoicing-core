import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * File Manager Service
 *
 * EXACT REPLICATION of PHP's file operations (fopen, fwrite, unlink)
 * Manages temporary files for CLI operations
 *
 * PHP Reference: EGS.php lines 45-66
 */
@Injectable()
export class FileManagerService implements OnModuleInit {
  private readonly logger = new Logger(FileManagerService.name);
  private readonly tmpDir = path.join(process.cwd(), "tmp");
  private readonly onboardingDir = path.join(process.cwd(), "onboarding_data");

  async onModuleInit() {
    await this.ensureDir(this.tmpDir);
    await this.ensureDir(this.onboardingDir);
  }

  /**
   * Ensure a directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o775 });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        this.logger.warn(
          `Could not create directory ${dirPath}: ${error.message}`
        );
      }
    }
  }

  /**
   * Write content to a temporary file
   *
   * EXACT replication of PHP:
   * $file = fopen($filename, 'w');
   * fwrite($file, $content);
   *
   * @param content - File content to write
   * @param filename - Name of the file (will be created in tmp/)
   * @returns Absolute path to the created file
   */
  async writeTemp(content: string, filename: string): Promise<string> {
    await this.ensureDir(this.tmpDir);

    const filePath = path.join(this.tmpDir, filename);

    try {
      await fs.writeFile(filePath, content, "utf-8");

      return filePath;
    } catch (error: any) {
      this.logger.error(
        `Failed to write temp file ${filename}: ${error.message}`
      );
      throw new Error(`File write failed: ${error.message}`);
    }
  }

  /**
   * Generic write file method
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await this.ensureDir(dir);
      await fs.writeFile(filePath, content, "utf-8");
    } catch (error: any) {
      this.logger.error(`Failed to write file ${filePath}: ${error.message}`);
      throw new Error(`File write failed: ${error.message}`);
    }
  }

  /**
   * Read content from a file
   *
   * @param filePath - Absolute or relative path to file
   * @returns File content as string
   */
  async readFile(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error: any) {
      this.logger.error(`Failed to read file ${filePath}: ${error.message}`);
      throw new Error(`File read failed: ${error.message}`);
    }
  }

  /**
   * Delete a temporary file
   *
   * EXACT replication of PHP:
   * unlink($filename);
   *
   * @param filePath - Absolute path to file to delete
   */
  async deleteTemp(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      // Don't throw - file might not exist, which is acceptable
      if (error.code !== "ENOENT") {
        this.logger.warn(
          `Could not delete temp file ${filePath}: ${error.message}`
        );
      }
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the absolute path for an onboarding directory
   */
  async getOnboardingDir(commonName: string): Promise<string> {
    const dirPath = path.join(
      this.onboardingDir,
      commonName.toLowerCase().replace(/\s+/g, "_")
    );
    await this.ensureDir(dirPath);
    return dirPath;
  }

  /**
   * Write content to a file in an onboarding directory
   */
  async writeOnboardingFile(
    commonName: string,
    filename: string,
    content: string
  ): Promise<string> {
    const dirPath = await this.getOnboardingDir(commonName);
    const filePath = path.join(dirPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  }

  /**
   * Get path for a file in onboarding directory (does not write)
   */
  getOnboardingFilePath(commonName: string, filename: string): string {
    const dirPath = path.join(
      this.onboardingDir,
      commonName.toLowerCase().replace(/\s+/g, "_")
    );
    return path.join(dirPath, filename);
  }

  /**
   * Get the absolute path for a temporary directory grouped by commonName
   */
  async getTempDir(commonName: string): Promise<string> {
    const dirPath = path.join(
      this.tmpDir,
      commonName.toLowerCase().replace(/\s+/g, "_")
    );
    await this.ensureDir(dirPath);
    return dirPath;
  }

  /**
   * Write a temporary file grouped by commonName
   */
  async writeTempFile(
    commonName: string,
    filename: string,
    content: string
  ): Promise<string> {
    const dirPath = await this.getTempDir(commonName);
    const filePath = path.join(dirPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
    return filePath;
  }
  /**
   * List all directories in the onboarding_data folder
   */
  async listOnboardingDirectories(): Promise<string[]> {
    try {
      const items = await fs.readdir(this.onboardingDir);
      const dirs: string[] = [];
      for (const item of items) {
        const fullPath = path.join(this.onboardingDir, item);
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
          dirs.push(item);
        }
      }
      return dirs;
    } catch (error: any) {
      this.logger.error(
        `Failed to list onboarding directories: ${error.message}`
      );
      return [];
    }
  }
  /**
   * Read and parse properties file from onboarding directory
   */
  async readOnboardingConfig(dirName: string): Promise<Record<string, string>> {
    const filePath = path.join(
      this.onboardingDir,
      dirName,
      "onboarding-config.properties"
    );
    try {
      if (!(await this.exists(filePath))) return {};
      const content = await this.readFile(filePath);
      const config: Record<string, string> = {};
      content.split("\n").forEach((line) => {
        const [key, ...values] = line.split("=");
        if (key && values.length > 0) {
          config[key.trim()] = values.join("=").trim();
        }
      });
      return config;
    } catch (error: any) {
      this.logger.error(
        `Failed to read config for ${dirName}: ${error.message}`
      );
      return {};
    }
  }
}
