/**
 * Invoice Controller
 *
 * Manages invoice operations including listing, detailed view, PDF generation,
 * and ZATCA signing/reporting triggers. All responses are standardized via apiResponse.
 */
import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Get,
  Query,
  Param,
  BadRequestException,
  Res,
  Logger,
  Req,
} from "@nestjs/common";
import * as QRCode from "qrcode";
import { InvoiceService } from "./invoice.service";
import { PdfService } from "./pdf/pdf.service";
import { apiResponse } from "src/common/utils/api-response";
import { SignInvoiceDto } from "./dto/sign-invoice.dto";
import { Response } from "express";

@Controller("invoice")
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService
  ) {}

  @Post("sign")
  @UsePipes(new ValidationPipe({ transform: true }))
  async sign(@Body() dto: SignInvoiceDto, @Req() req: Request) {
    const result = await this.invoiceService.signInvoice(dto);
    return apiResponse({
      key: "invoice.signed_success",
      request: req,
      status: "CREATED",
      data: result,
    });
  }

  @Get()
  async list(@Query("commonName") commonName: string, @Req() req: Request) {
    if (!commonName) {
      throw new BadRequestException("commonName query param is required");
    }
    const result = await this.invoiceService.listInvoices(commonName);
    return apiResponse({
      key: "common.success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
  }

  @Get(":invoiceNumber")
  async getDetail(
    @Param("invoiceNumber") invoiceNumber: string,
    @Req() req: Request
  ) {
    const result = await this.invoiceService.getInvoiceByNumber(invoiceNumber);
    return apiResponse({
      key: "common.success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
  }

  @Get(":invoiceNumber/zatca-response")
  async getZatcaResponse(
    @Param("invoiceNumber") invoiceNumber: string,
    @Req() req: Request
  ) {
    const result = await this.invoiceService.getZatcaResponse(invoiceNumber);
    return apiResponse({
      key: "common.success",
      request: req,
      status: "SUCCESS",
      data: result,
    });
  }

  @Get(":invoiceNumber/pdf")
  async getPdf(
    @Param("invoiceNumber") invoiceNumber: string,
    @Res() res: Response
  ) {
    // Cast to any to avoid stale IDE type errors (schema was updated but IDE is caching old types)
    const invoice: any =
      await this.invoiceService.getInvoiceByNumber(invoiceNumber);

    // Generate QR Code Image from TLV Base64
    let qrCodeBase64 = null;
    if (invoice.qrCode) {
      try {
        this.logger.debug(`Generating QR for invoice: ${invoiceNumber}`);
        this.logger.debug(
          `QR TLV Data (first 50 chars): ${invoice.qrCode.substring(0, 50)}`
        );

        // Generate QR code with ZATCA-compliant settings
        qrCodeBase64 = await QRCode.toDataURL(invoice.qrCode, {
          errorCorrectionLevel: "M", // Medium error correction as per ZATCA
          type: "image/png",
          width: 300, // Higher resolution for better scanning
          margin: 1, // Minimal margin
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        this.logger.debug(
          `QR Code generated successfully, data URL length: ${qrCodeBase64.length}`
        );
      } catch (err) {
        this.logger.error(`Failed to generate QR image: ${err}`);
      }
    }

    // Prepare data for template
    const templateData = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: new Date(invoice.issueDateTime).toISOString().split("T")[0],
      issueTime: new Date(invoice.issueDateTime).toLocaleTimeString("en-US", {
        hour12: false,
      }),
      qrCode: qrCodeBase64,

      // Pass raw type info so PdfService can determine template & titles
      invoiceTypeCode: invoice.invoiceTypeCode,
      invoiceTypeCodeName: invoice.invoiceTypeCodeName,
      invoiceCategory: invoice.invoiceCategory,

      // Extra Fields for Credit/Debit/Advance
      billingReference: invoice.referenceInvoiceNumber,
      sellerName: invoice.sellerName,
      sellerVatNumber: invoice.sellerVatNumber,
      sellerAddress: {
        street: invoice.sellerStreet || "Unknown Street",
        buildingNumber: invoice.sellerBuildingNumber || "-",
        city: invoice.sellerCity || "Riyadh",
        district: invoice.sellerDistrict || "-",
        postalCode: invoice.sellerPostalCode || "-",
        countryCode: invoice.sellerCountryCode || "SA",
      },
      buyerName: invoice.buyerName || "N/A",
      buyerVatNumber: invoice.buyerVatNumber || "N/A",
      buyerAddress: {
        street: invoice.buyerStreet || "-",
        buildingNumber: invoice.buyerBuildingNumber || "-",
        city: invoice.buyerCity || "-",
        district: invoice.buyerDistrict || "-",
        postalCode: invoice.buyerPostalCode || "-",
        countryCode: invoice.buyerCountryCode || "-",
      },

      // Arabic versions (using English for now - TODO: Add proper translation)
      sellerNameAr: invoice.sellerName,
      sellerVatNumberAr: invoice.sellerVatNumber,
      sellerAddressAr: {
        street: invoice.sellerStreet || "Unknown Street",
        buildingNumber: invoice.sellerBuildingNumber || "-",
        city: invoice.sellerCity || "Riyadh",
        district: invoice.sellerDistrict || "-",
        postalCode: invoice.sellerPostalCode || "-",
        countryCode: invoice.sellerCountryCode || "SA",
      },
      buyerNameAr: invoice.buyerName || "N/A",
      buyerVatNumberAr: invoice.buyerVatNumber || "N/A",
      buyerAddressAr: {
        street: invoice.buyerStreet || "-",
        buildingNumber: invoice.buyerBuildingNumber || "-",
        city: invoice.buyerCity || "-",
        district: invoice.buyerDistrict || "-",
        postalCode: invoice.buyerPostalCode || "-",
        countryCode: invoice.buyerCountryCode || "-",
      },
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        vatRate: item.vatRate,
        vatAmount: item.vatAmount.toFixed(2),
        taxExclusiveAmount: (item.totalAmount - item.vatAmount).toFixed(2), // Calculated field for column 4
        totalAmount: item.totalAmount.toFixed(2),
      })),
      subTotal: invoice.subTotal.toFixed(2),
      vatAmount: invoice.vatAmount.toFixed(2),
      totalAmount: invoice.totalAmount.toFixed(2),
    };

    const pdfBuffer = await this.pdfService.generateInvoicePdf(templateData);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="inv-${invoiceNumber.toLowerCase()}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }
}
