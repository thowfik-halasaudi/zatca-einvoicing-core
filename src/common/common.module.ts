import { Module } from "@nestjs/common";
import { CliExecutorService } from "./cli-executor.service";
import { FileManagerService } from "./file-manager.service";

/**
 * Common Module
 *
 * Provides shared utilities for CLI execution and file management
 * These services are the foundation for replicating PHP's shell_exec and file operations
 */
@Module({
  providers: [CliExecutorService, FileManagerService],
  exports: [CliExecutorService, FileManagerService],
})
export class CommonModule {}
