import { Injectable, Logger } from "@nestjs/common";
import { FileManagerService } from "./file-manager.service";
import { SignInvoiceDto } from "../invoice/dto/sign-invoice.dto";

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private readonly fileManager: FileManagerService) {}

  /**
   * Generates the next sequential invoice serial number based on the requested type.
   * Format: [HOTEL]-[PREFIX]-[YY]-[00000001]
   */
  async generateNextSerialNumber(
    dto: SignInvoiceDto
  ): Promise<{ serialNumber: string; counter: number }> {
    const { egs, invoice, customer } = dto;
    const commonName = egs.commonName;
    const hotelCode = commonName.toUpperCase();
    const year = new Date().getFullYear().toString().slice(-2);

    // Determine Prefix
    // SI (Simplified), SD (Standard), RE (Refund/Credit), AD (Adjustment/Debit)
    let prefix = "SI";
    if (invoice.invoiceTypeCode === "381") {
      prefix = "RE";
    } else if (invoice.invoiceTypeCode === "383") {
      prefix = "AD";
    } else {
      // It's a 388 Invoice. Check if B2B or B2C
      const isStandard =
        invoice.invoiceTypeCodeName?.startsWith("01") ||
        customer?.type === "B2B";
      prefix = isStandard ? "SD" : "SI";
    }

    const counterFile = this.fileManager.getOnboardingFilePath(
      commonName,
      "counters.json"
    );
    this.logger.log(
      `🏷️  Loading counters for ${commonName} from: ${counterFile}`
    );

    // Load or Initialize Counters
    let counters: Record<string, number> = {};
    if (await this.fileManager.exists(counterFile)) {
      try {
        const content = await this.fileManager.readFile(counterFile);
        counters = JSON.parse(content);
        this.logger.log(`📈 Current counts: ${JSON.stringify(counters)}`);
      } catch (e) {
        this.logger.error(
          `❌ Failed to parse counters.json for ${commonName}: ${e.message}`
        );
      }
    } else {
      this.logger.log(`🆕 No counters file found. Starting from zero.`);
    }

    // Increment counter for this specific prefix
    const currentCount = counters[prefix] || 0;
    const nextCount = currentCount + 1;
    counters[prefix] = nextCount;

    this.logger.log(
      `🔢 Incrementing ${prefix}: ${currentCount} -> ${nextCount}`
    );

    // Save updated counters
    await this.fileManager.writeFile(
      counterFile,
      JSON.stringify(counters, null, 2)
    );

    // Pad to 8 digits
    const paddedSeq = nextCount.toString().padStart(8, "0");

    const serialNumber = `${hotelCode}-${prefix}-${year}-${paddedSeq}`;

    console.log(`✅ [SEQUENCE] Generated: ${serialNumber} (ICV: ${nextCount})`);
    return { serialNumber, counter: nextCount };
  }
}
