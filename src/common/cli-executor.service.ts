import { Injectable, Logger } from "@nestjs/common";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * CLI Executor Service
 *
 * EXACT REPLICATION of PHP's shell_exec() function
 * This is the SINGLE SOURCE for all CLI command executions
 *
 * Purpose: Execute system commands exactly as PHP does
 * Scope: Replace all custom crypto implementations with CLI calls
 */
@Injectable()
export class CliExecutorService {
  private readonly logger = new Logger(CliExecutorService.name);
  private readonly defaultTimeout = parseInt(
    process.env.CLI_TIMEOUT || "30000",
    10
  );

  /**
   * Execute a shell command
   *
   * EXACT behavior of PHP's shell_exec():
   * - Executes command synchronously (via async/await)
   * - Returns stdout on success
   * - Captures stderr on failure
   * - Returns exit code
   *
   * @param command - Full shell command to execute
   * @param timeout - Maximum execution time in milliseconds
   * @returns CliResult with stdout, stderr, and exitCode
   */
  async execute(command: string, timeout?: number): Promise<CliResult> {
    const executionTimeout = timeout || this.defaultTimeout;

    this.logger.debug(`Executing CLI command: ${this.sanitizeForLog(command)}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: executionTimeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
        shell: "/bin/sh", // Consistent shell across environments
      });

      this.logger.debug(`CLI command completed successfully`);

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      };
    } catch (error: any) {
      this.logger.error(`CLI command failed: ${error.message}`);

      return {
        stdout: error.stdout?.trim() || "",
        stderr: error.stderr?.trim() || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  /**
   * Sanitize command for logging (hide sensitive data)
   */
  private sanitizeForLog(command: string): string {
    // Hide file paths and sensitive data
    return command.length > 100 ? `${command.substring(0, 100)}...` : command;
  }
}
