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

      // 1. Load HTML Template
      const templatePath = path.join(
        process.cwd(),
        "src/invoice/pdf/templates/invoice.hbs"
      );
      const templateHtml = fs.readFileSync(templatePath, "utf8");

      // 2. Compile Template with Handlebars
      const template = handlebars.compile(templateHtml);
      const html = template(data);

      // 3. Launch Puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"], // Safe for containers
      });
      const page = await browser.newPage();

      // 4. Set Content & Options
      await page.setContent(html, { waitUntil: "networkidle0" });

      // 5. Generate PDF
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
