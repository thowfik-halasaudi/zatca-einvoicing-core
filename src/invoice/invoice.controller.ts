import {
  Controller,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
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
}
