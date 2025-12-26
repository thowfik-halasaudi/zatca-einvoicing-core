/**
 * Compliance Repository
 *
 * Encapsulates all database interactions for EGS Units and Zatca Submissions.
 * Ensures the Service layer remains pure business logic without direct Prisma dependencies.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class ComplianceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCommonName(commonName: string) {
    return this.prisma.egsUnit.findUnique({
      where: { commonName },
    });
  }

  async createEgsUnit(data: Prisma.EgsUnitCreateInput) {
    return this.prisma.egsUnit.create({ data });
  }

  async updateEgsUnit(commonName: string, data: Prisma.EgsUnitUpdateInput) {
    return this.prisma.egsUnit.update({
      where: { commonName },
      data,
    });
  }

  async findAllEgsUnits(where?: Prisma.EgsUnitWhereInput) {
    return this.prisma.egsUnit.findMany({
      where,
      orderBy: { commonName: "asc" },
      select: {
        commonName: true,
        organizationName: true,
        organizationIdentifier: true,
        binarySecurityToken: true,
        countryName: true,
        production: true,
        complianceBinarySecurityToken: true,
        productionBinarySecurityToken: true,
      },
    });
  }

  async updateSubmissionStatus(
    invoiceId: string,
    submissionType: string,
    overallStatus: string,
    reportingStatus: string | null,
    clearanceStatus: string | null,
    zatcaResponse: any
  ) {
    return this.prisma.$transaction([
      this.prisma.zatcaSubmission.upsert({
        where: { invoiceId },
        create: {
          invoiceId,
          submissionType,
          zatcaStatus: overallStatus,
          reportingStatus,
          clearanceStatus,
          zatcaResponse,
          lastAttemptAt: new Date(),
          attemptCount: 1,
        },
        update: {
          zatcaStatus: overallStatus,
          reportingStatus,
          clearanceStatus,
          zatcaResponse,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: overallStatus },
      }),
    ]);
  }
}
