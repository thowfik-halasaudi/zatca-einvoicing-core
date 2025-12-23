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
} from "@nestjs/common";
import { InvoiceService } from "./invoice.service";
import { SignInvoiceDto } from "./dto/sign-invoice.dto";

@Controller("invoice")
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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
}
