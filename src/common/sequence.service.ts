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
    console.log(`\n[CHAIN] ⛓️  Retrieving last hash for EGS: "${commonName}"`);
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { commonName },
      orderBy: { invoiceNumber: "desc" },
      include: { hash: true },
    });

    if (lastInvoice) {
      console.log(
        `[CHAIN] 🔎 Found last invoice: ${lastInvoice.invoiceNumber}`
      );
      console.log(
        `[CHAIN] 🔑 Last Hash in DB: ${lastInvoice.hash?.currentInvoiceHash?.substring(0, 10)}...`
      );
    } else {
      console.log(`[CHAIN] 📭 No previous invoice found for "${commonName}".`);
    }

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
    this.logger.log(`🏷️  Loading counter for ${seriesKey} from PostgreSQL...`);

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

    // We still use the prefix in the serialNumber string for readability
    const serialNumber = `${hotelCode}-${prefix}-${year}-${paddedSeq}`;

    console.log(`✅ [SEQUENCE] Generated: ${serialNumber} (ICV: ${nextCount})`);
    console.log(`✅ [SEQUENCE] Prev Hash: ${previousHash.substring(0, 20)}...`);

    return { serialNumber, counter: nextCount, previousHash };
  }
}
