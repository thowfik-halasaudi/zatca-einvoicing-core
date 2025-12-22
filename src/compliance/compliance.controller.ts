import { Body, Controller, Get, Post } from "@nestjs/common";
import { ComplianceService } from "./compliance.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { OnboardEgsDto } from "./dto/onboard-egs.dto";
import { IssueCsidDto } from "./dto/issue-csid.dto";
import { CheckComplianceDto } from "./dto/check-compliance.dto";
import { SubmitZatcaDto } from "./dto/submit-zatca.dto";

/**
 * ComplianceController
 *
 * This controller exposes the ZATCA compliance and submission workflows as REST endpoints.
 * It is primarily used by the frontend to:
 * - List registered EGS (Hotel) units.
 * - Perform the onboarding handshake (Step 1 & 2).
 * - Run pre-submission compliance checks (Step 4).
 * - Execute the final production submission (Step 5 - Clearance/Reporting).
 */
@ApiTags("Compliance")
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  /**
   * listEgs
   *
   * Retrieves a list of all EGS units (hotels/e-invoicing profiles) that have
   * started the onboarding process on this machine.
   */
  @Get("egs")
  @ApiOperation({ summary: "List all onboarded EGS units" })
  @ApiResponse({
    status: 200,
    description: "List of EGS units retrieved successfully",
  })
  async listEgs() {
    return this.complianceService.listOnboardedEgs();
  }

  /**
   * onboard
   *
   * Handshake Step 1: Generates keys and CSR locally.
   * This is usually the first step when setting up a new store/branch.
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
   * issueCsid
   *
   * Handshake Step 2: Exchanges a CSR + OTP for a ZATCA Certificate.
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
   * check
   *
   * Compliance Step 4: Dry-run check for a signed invoice.
   * This is used during development to verify compliance before final submission.
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

  /**
   * submit
   *
   * Final Step 5: Submits an invoice to ZATCA for Clearance or Reporting.
   * The logic automatically detects if it should clear (B2B) or report (B2C).
   */
  @Post("submit")
  @ApiOperation({ summary: "Submit a signed invoice to ZATCA Simulation API" })
  @ApiResponse({
    status: 200,
    description: "Invoice submitted successfully",
  })
  async submit(@Body() dto: SubmitZatcaDto) {
    return this.complianceService.submitToZatca(dto);
  }
}
