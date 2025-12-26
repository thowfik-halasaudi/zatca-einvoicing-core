/**
 * Compliance Controller
 *
 * Handles ZATCA onboarding steps (CSR generation, CSID issuance, Compliance Checks).
 * Acts as the primary interface for users to onboard their EGS units.
 */
import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { Request } from "express";
import { ComplianceService } from "./compliance.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { OnboardEgsDto } from "./dto/onboard-egs.dto";
import { IssueCsidDto } from "./dto/issue-csid.dto";
import { CheckComplianceDto } from "./dto/check-compliance.dto";
import { SubmitZatcaDto } from "./dto/submit-zatca.dto";
import { apiResponse } from "src/common/utils/api-response";

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
  async listEgs(@Query("commonName") commonName: string, @Req() req: Request) {
    const result = await this.complianceService.listOnboardedEgs(commonName);
    return apiResponse({
      key: "compliance.egs_list_success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
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
  async onboard(@Body() dto: OnboardEgsDto, @Req() req: Request) {
    const result = await this.complianceService.onboardEgs(dto);
    return apiResponse({
      key: "compliance.onboard_success",
      request: req,
      status: "CREATED",
      data: result,
    });
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
  async issueCsid(@Body() dto: IssueCsidDto, @Req() req: Request) {
    const result = await this.complianceService.issueCsid(dto);
    return apiResponse({
      key: "compliance.csid_issued_success",
      request: req,
      status: "CREATED",
      data: result,
    });
  }

  /**
   * production
   *
   * Onboarding Final Step: Exchanges Compliance CSID for Production CSID.
   * Call this AFTER 'check' passes successfully.
   */
  @Post("production")
  @ApiOperation({ summary: "Issue Final Production CSID" })
  @ApiResponse({
    status: 201,
    description: "Production CSID issued and stored. EGS is now live.",
  })
  async issueProductionCsid(
    @Body() dto: { commonName: string; production?: boolean },
    @Req() req: Request
  ) {
    const result = await this.complianceService.issueProductionCsid(dto);
    return apiResponse({
      key: "compliance.production_csid_success",
      request: req,
      status: "CREATED",
      data: result,
    });
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
  async check(@Body() dto: CheckComplianceDto, @Req() req: Request) {
    const result = await this.complianceService.checkInvoiceCompliance(dto);
    return apiResponse({
      key: "compliance.check_success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
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
  async submit(@Body() dto: SubmitZatcaDto, @Req() req: Request) {
    const result = await this.complianceService.submitToZatca(dto);
    return apiResponse({
      key: "compliance.submission_success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
  }
}
