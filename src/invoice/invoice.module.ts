import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice.controller";
import { InvoiceService } from "./invoice.service";
import { XmlTemplateService } from "./xml-template.service";
import { CommonModule } from "../common/common.module";
import { ComplianceModule } from "../compliance/compliance.module";

@Module({
  imports: [CommonModule, ComplianceModule],
  controllers: [InvoiceController],
  providers: [InvoiceService, XmlTemplateService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
