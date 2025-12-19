import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice.controller";
import { InvoiceService } from "./invoice.service";
import { XmlTemplateService } from "./xml-template.service";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [CommonModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, XmlTemplateService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
