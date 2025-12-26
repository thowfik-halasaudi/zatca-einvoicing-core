/**
 * Invoice Repository
 *
 * Abstract database access for Invoices to decouple the service layer from Prisma.
 * Handles complex queries like case-insensitive lookups and deep relations.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.InvoiceCreateInput) {
    return this.prisma.invoice.create({ data });
  }

  async createItems(data: Prisma.InvoiceItemCreateManyInput[]) {
    return this.prisma.invoiceItem.createMany({ data });
  }

  async createHash(data: Prisma.InvoiceHashCreateInput) {
    return this.prisma.invoiceHash.create({ data });
  }

  async createSubmission(data: Prisma.ZatcaSubmissionCreateInput) {
    return this.prisma.zatcaSubmission.create({ data });
  }

  async findAllByCommonName(commonName: string) {
    return this.prisma.invoice.findMany({
      where: { commonName },
      orderBy: { issueDateTime: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        issueDateTime: true,
        invoiceCategory: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        submission: {
          select: {
            zatcaStatus: true,
            reportingStatus: true,
            clearanceStatus: true,
          },
        },
      },
    });
  }

  async findByInvoiceNumber(invoiceNumber: string) {
    return this.prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          equals: invoiceNumber,
          mode: "insensitive",
        },
      },
      include: {
        items: true,
        hash: true,
        submission: true,
      },
    });
  }

  async findSubmissionByInvoiceNumber(invoiceNumber: string) {
    return this.prisma.zatcaSubmission.findFirst({
      where: { invoice: { invoiceNumber } },
    });
  }
}
