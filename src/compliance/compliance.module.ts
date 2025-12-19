import { Module } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { CryptographyModule } from "../cryptography/cryptography.module";
import { ComplianceController } from "./compliance.controller";
import { ZatcaModule } from "../zatca/zatca.module";
import { CommonModule } from "../common/common.module";

/**
 * Compliance Module
 *
 * Handles ZATCA compliance operations (onboarding)
 */
@Module({
  imports: [CryptographyModule, ZatcaModule, CommonModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
