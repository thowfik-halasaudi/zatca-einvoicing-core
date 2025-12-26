import { Injectable, Logger } from "@nestjs/common";
import { SignInvoiceDto } from "../invoice/dto/sign-invoice.dto";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SequenceService {
  private readonly logger = new Logger(SequenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next sequential invoice serial number and retrieves the previous hash.
   * Format: [HOTEL]-[PREFIX]-[YY]-[00000001]
   */
  async generateNextSerialNumber(
    dto: SignInvoiceDto
  ): Promise<{ serialNumber: string; counter: number; previousHash: string }> {
    const { egs, invoice, customer } = dto;
    const commonName = egs.commonName;
    const hotelCode = commonName.toUpperCase();
    const year = new Date().getFullYear().toString().slice(-2);

    // 1. Get the latest invoice for this EGS to find the last hash
    // 1. Get the latest invoice for this EGS to find the last hash
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { commonName },
      orderBy: { invoiceNumber: "desc" },
      include: { hash: true },
    });

    const DEFAULT_FIRST_HASH =
      "NWZlY2ViOTZmOTk1YTRiMGNjM2YwOTUwZGYzMmM2YjQ5ZGEyN2IyOA==";
    const previousHash =
      lastInvoice?.hash?.currentInvoiceHash || DEFAULT_FIRST_HASH;

    // 2. Determine Prefix
    // SI (Simplified), SD (Standard), RE (Refund/Credit), AD (Adjustment/Debit)
    let prefix = "SI";
    if (invoice.invoiceTypeCode === "381") {
      prefix = "RE";
    } else if (invoice.invoiceTypeCode === "383") {
      prefix = "AD";
    } else {
      const isStandard =
        invoice.invoiceTypeCodeName?.startsWith("01") ||
        customer?.type === "B2B";
      prefix = isStandard ? "SD" : "SI";
    }

    // 3. Sequence Key: Using commonName to ensure ONE sequence per certificate (ZATCA requirement)
    const seriesKey = commonName;

    // Get current counter WITHOUT incrementing (increment only after successful save)
    const counterRecord = await this.prisma.invoiceCounter.findUnique({
      where: { seriesKey },
    });

    // Calculate next number (will be current + 1, or 1 if new)
    const nextCount = counterRecord ? counterRecord.lastNumber + 1 : 1;

    // Pad to 8 digits
    const paddedSeq = nextCount.toString().padStart(8, "0");

    // We still use the prefix in the serialNumber string for readability
    const serialNumber = `${hotelCode}-${prefix}-${year}-${paddedSeq}`;

    return { serialNumber, counter: nextCount, previousHash };
  }

  /**
   * Commits the counter increment after successful invoice creation.
   * This ensures we only increment if the invoice was successfully saved.
   */
  async commitCounterIncrement(commonName: string): Promise<void> {
    const seriesKey = commonName;

    await this.prisma.invoiceCounter.upsert({
      where: { seriesKey },
      update: {
        lastNumber: { increment: 1 },
      },
      create: {
        seriesKey,
        lastNumber: 1,
      },
    });

    this.logger.log(`Counter incremented for ${commonName}`);
  }
}
