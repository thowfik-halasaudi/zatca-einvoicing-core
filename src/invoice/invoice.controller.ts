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
} from "@nestjs/common";
import * as QRCode from "qrcode";
import { InvoiceService } from "./invoice.service";
import { PdfService } from "./pdf/pdf.service";
import { SignInvoiceDto } from "./dto/sign-invoice.dto";
import { Response } from "express";

@Controller("invoice")
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly pdfService: PdfService
  ) {}

  @Post("sign")
  @UsePipes(new ValidationPipe({ transform: true }))
  async sign(@Body() dto: SignInvoiceDto) {
    return this.invoiceService.signInvoice(dto);
  }

  @Get()
  async list(@Query("commonName") commonName: string) {
    if (!commonName) {
      throw new BadRequestException("commonName query param is required");
    }
    return this.invoiceService.listInvoices(commonName);
  }

  @Get(":invoiceNumber")
  async getDetail(@Param("invoiceNumber") invoiceNumber: string) {
    return this.invoiceService.getInvoiceByNumber(invoiceNumber);
  }

  @Get(":invoiceNumber/zatca-response")
  async getZatcaResponse(@Param("invoiceNumber") invoiceNumber: string) {
    return this.invoiceService.getZatcaResponse(invoiceNumber);
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
        console.log("Generating QR for invoice:", invoiceNumber);
        console.log(
          "QR TLV Data (first 50 chars):",
          invoice.qrCode.substring(0, 50)
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

        console.log(
          "QR Code generated successfully, data URL length:",
          qrCodeBase64.length
        );
      } catch (err) {
        console.error("Failed to generate QR image:", err);
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
