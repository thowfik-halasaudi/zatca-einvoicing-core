import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import * as puppeteer from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as handlebars from "handlebars";

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async generateInvoicePdf(data: any): Promise<Buffer> {
    try {
      this.logger.log(`Generating PDF for invoice: ${data.invoiceNumber}`);

      // 1. Determine Template Type (Simplified vs Standard)
      // Check if it starts with '02' (Simplified) or use explicit flag if available
      const isSimplified =
        data.invoiceTypeCodeName?.startsWith("02") ||
        data.invoiceCategory === "SIMPLIFIED";
      const templateName = isSimplified
        ? "simplified-invoice.hbs"
        : "standard-invoice.hbs";

      this.logger.log(`Using template: ${templateName}`);

      // 2. Determine Dynamic Titles (Logic moved from Controller)
      const typeCode = data.invoiceTypeCode || "388";
      let titleEn = "Tax Invoice";
      let titleAr = "فاتورة ضريبية";

      if (typeCode === "381") {
        titleEn = "Credit Note";
        titleAr = "إشعار دائن";
      } else if (typeCode === "383") {
        titleEn = "Debit Note";
        titleAr = "إشعار مدين";
      } else if (typeCode === "386") {
        titleEn = "Advance Payment Invoice";
        titleAr = "فاتورة الدفع المقدم";
      }

      const prefixEn = isSimplified ? "Simplified " : "";
      const suffixAr = isSimplified ? " مبسطة" : "";

      // Add calculated titles to data
      const extendedData = {
        ...data,
        invoiceTitleEn: `${prefixEn}${titleEn}`,
        invoiceTitleAr: `${titleAr}${suffixAr}`,
      };

      // 3. Load HTML Template
      const templatePath = path.join(
        process.cwd(),
        `src/invoice/pdf/templates/${templateName}`
      );

      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const templateHtml = fs.readFileSync(templatePath, "utf8");

      // 4. Compile Template with Handlebars
      const template = handlebars.compile(templateHtml);
      const html = template(extendedData);

      // 5. Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Safe for containers
      });
      const page = await browser.newPage();

      // 6. Set Content & Options
      await page.setContent(html, { waitUntil: "networkidle0" });

      // 7. Generate PDF
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0px",
          right: "0px",
          bottom: "0px",
          left: "0px",
        },
      });

      await browser.close();
      this.logger.log("PDF generation successful");

      // Puppeteer returns Uint8Array in newer versions, cast to Buffer
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error(`PDF Generation failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException("Failed to generate PDF invoice");
    }
  }
}
