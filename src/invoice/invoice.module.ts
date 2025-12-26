import { Module } from "@nestjs/common";
import { InvoiceController } from "./invoice.controller";
import { InvoiceService } from "./invoice.service";
import { XmlTemplateService } from "./xml-template.service";
import { PdfService } from "./pdf/pdf.service";
import { CommonModule } from "../common/common.module";
import { ComplianceModule } from "../compliance/compliance.module";

import { InvoiceRepository } from "./invoice.repository";

@Module({
  imports: [CommonModule, ComplianceModule],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    XmlTemplateService,
    PdfService,
    InvoiceRepository,
  ],
  exports: [InvoiceService, PdfService, InvoiceRepository],
})
export class InvoiceModule {}
