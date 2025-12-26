import { Module, forwardRef } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { CryptographyModule } from "../cryptography/cryptography.module";
import { ComplianceController } from "./compliance.controller";
import { ZatcaModule } from "../zatca/zatca.module";
import { CommonModule } from "../common/common.module";
import { ComplianceRepository } from "./compliance.repository";
import { InvoiceModule } from "../invoice/invoice.module"; // For InvoiceRepository

/**
 * Compliance Module
 *
 * Handles ZATCA compliance operations (onboarding)
 */
@Module({
  imports: [
    CryptographyModule,
    ZatcaModule,
    CommonModule,
    forwardRef(() => InvoiceModule),
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceRepository],
  exports: [ComplianceService],
})
export class ComplianceModule {}
