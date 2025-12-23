import { Injectable, Logger } from "@nestjs/common";
import { SignInvoiceDto } from "../invoice/dto/sign-invoice.dto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    // Sequence Key: [CommonName]-[Prefix]
    const seriesKey = `${commonName}-${prefix}`;
    this.logger.log(`🏷️  Loading counters for ${seriesKey} from PostgreSQL...`);

    // Get and Increment Counter in DB
    const counterRecord = await this.prisma.invoiceCounter.upsert({
      where: { seriesKey },
      update: {
        lastNumber: { increment: 1 },
      },
      create: {
        seriesKey,
        lastNumber: 1,
      },
    });

    const nextCount = counterRecord.lastNumber;

    this.logger.log(
      `🔢 Incrementing ${seriesKey}: ${nextCount - 1} -> ${nextCount}`
    );

    // Pad to 8 digits
    const paddedSeq = nextCount.toString().padStart(8, "0");

    const serialNumber = `${hotelCode}-${prefix}-${year}-${paddedSeq}`;

    console.log(`✅ [SEQUENCE] Generated: ${serialNumber} (ICV: ${nextCount})`);
    return { serialNumber, counter: nextCount };
  }
}
