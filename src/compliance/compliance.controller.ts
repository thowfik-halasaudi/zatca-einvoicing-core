import { Body, Controller, Post } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { OnboardEgsDto } from "./dto/onboard-egs.dto";
import { IssueCsidDto } from "./dto/issue-csid.dto";
import { CheckComplianceDto } from "./dto/check-compliance.dto";

/**
 * Compliance Controller
 *
 * Handles ZATCA compliance API endpoints
 */
@ApiTags("Compliance")
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /**
   * Step 1 + 2: Full Onboard (Generate Keys & CSR then issue CSID)
   */
  @Post("onboard")
  @ApiOperation({ summary: "Generate keys/CSR and immediately issue CSID" })
  @ApiResponse({
    status: 201,
    description: "CSID issued successfully",
  })
  async onboard(@Body() dto: OnboardEgsDto) {
    return this.complianceService.onboardEgs(dto);
  }

  /**
   * Step 2 Only: Issue CSID using existing local CSR
   */
  @Post("issue-csid")
  @ApiOperation({ summary: "Issue CSID using an existing local CSR file" })
  @ApiResponse({
    status: 201,
    description: "CSID issued successfully using existing CSR",
  })
  async issueCsid(@Body() dto: IssueCsidDto) {
    return this.complianceService.issueCsid(dto);
  }

  /**
   * Step 4: Check Invoice Compliance
   */
  @Post("check")
  @ApiOperation({ summary: "Check a signed invoice for ZATCA compliance" })
  @ApiResponse({
    status: 200,
    description: "Compliance check results received",
  })
  async check(@Body() dto: CheckComplianceDto) {
    return this.complianceService.checkInvoiceCompliance(dto);
  }
}
