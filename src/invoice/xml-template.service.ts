import { Injectable } from "@nestjs/common";
import { SignInvoiceDto } from "./dto/sign-invoice.dto";

@Injectable()
export class XmlTemplateService {
  /**
   * Generates a base UBL 2.1 XML for any ZATCA Invoice using the provided DTO.
   * Supports Standard/Simplified and Invoice/Credit/Debit scenarios.
   */
  generateInvoiceXml(dto: SignInvoiceDto): string {
    console.log("\n[XML GEN] 🏗️  Building Base UBL 2.1 XML from PMS Data...");

    const { egs, invoice, supplier, customer, lineItems, totals } = dto;

    // ZATCA Rule: For the first invoice (ICV 1), use the hash of '0'
    const DEFAULT_FIRST_HASH =
      "NWZlY2ViOTZmOTk1YTRiMGNjM2YwOTUwZGYzMmM2YjQ5ZGEyN2IyOA==";
    const finalPreviousHash = invoice.previousInvoiceHash || DEFAULT_FIRST_HASH;

    if (invoice.invoiceCounterNumber === 1 && !invoice.previousInvoiceHash) {
      console.log("ℹ️  ICV is 1. Automatically using Initial Invoice Hash.");
    }

    // Auto-Time calculation
    const now = new Date();
    const finalDate = invoice.issueDate || now.toISOString().split("T")[0];
    const finalTime = invoice.issueTime || now.toTimeString().split(" ")[0];

    // Determine Logic Flags
    const isStandard = invoice.invoiceTypeCodeName?.startsWith("01") || false;
    const isNote =
      invoice.invoiceTypeCode === "381" || invoice.invoiceTypeCode === "383";

    console.log(
      `📍 Type: ${isStandard ? "STANDARD" : "SIMPLIFIED"} | Code: ${invoice.invoiceTypeCode || "388"}`
    );
    console.log(`📍 Line Items to process: ${lineItems.length}`);

    const lineItemsXml = lineItems
      .map((item, index) => {
        return `
    <cac:InvoiceLine>
        <cbc:ID>${item.lineId}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${item.unitCode || "PCE"}">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency || "SAR"}">${item.taxExclusiveAmount.toFixed(2)}</cbc:LineExtensionAmount>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${invoice.currency || "SAR"}">${(item.taxExclusiveAmount + item.vatAmount).toFixed(2)}</cbc:RoundingAmount>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>${item.description}</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>${item.taxCategory || (item.vatPercent > 0 ? "S" : "O")}</cbc:ID>
                <cbc:Percent>${item.vatPercent.toFixed(2)}</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${invoice.currency || "SAR"}">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
      })
      .join("");

    // Billing Reference (For Credit/Debit Notes)
    const billingReferenceXml =
      isNote && invoice.billingReferenceId
        ? `
    <cac:BillingReference>
        <cac:InvoiceDocumentReference>
            <cbc:ID>${invoice.billingReferenceId}</cbc:ID>
        </cac:InvoiceDocumentReference>
    </cac:BillingReference>`
        : "";

    // Customer Party (Full details for Standard, Basic for Simplified)
    let customerPartyXml = "";
    if (isStandard && customer) {
      customerPartyXml = `
    <cac:AccountingCustomerParty>
        <cac:Party>
            ${
              customer.vatNumber
                ? `
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${customer.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
            </cac:PartyTaxScheme>`
                : ""
            }
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${customer.registrationName || customer.name || "Customer"}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
            <cac:PostalAddress>
                <cbc:StreetName>${customer.address?.street || "Street"}</cbc:StreetName>
                <cbc:BuildingNumber>${customer.address?.buildingNumber || "0000"}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${customer.address?.district || "District"}</cbc:CitySubdivisionName>
                <cbc:CityName>${customer.address?.city || "City"}</cbc:CityName>
                <cbc:PostalZone>${customer.address?.postalCode || "00000"}</cbc:PostalZone>
                <cac:Country><cbc:IdentificationCode>${customer.address?.country || "SA"}</cbc:IdentificationCode></cac:Country>
            </cac:PostalAddress>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    } else {
      customerPartyXml = `
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${customer?.name || "Walk-in Guest"}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>`;
    }

    // Base template
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
            <ext:ExtensionContent>
                <!-- ZATCA will inject Digital Signature here -->
            </ext:ExtensionContent>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
    <cbc:ID>${invoice.invoiceSerialNumber}</cbc:ID>
    <cbc:UUID>${invoice.uuid || "8e354912-7474-42b6-aa6d-519267bb6c22"}</cbc:UUID>
    <cbc:IssueDate>${finalDate}</cbc:IssueDate>
    <cbc:IssueTime>${finalTime}</cbc:IssueTime>
    <cbc:InvoiceTypeCode name="${invoice.invoiceTypeCodeName || (isStandard ? "0111010" : "0211010")}">${invoice.invoiceTypeCode || "388"}</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>${invoice.currency || "SAR"}</cbc:DocumentCurrencyCode>
    <cbc:TaxCurrencyCode>${invoice.currency || "SAR"}</cbc:TaxCurrencyCode>${billingReferenceXml}
    <cac:AdditionalDocumentReference>
        <cbc:ID>ICV</cbc:ID>
        <cbc:UUID>${invoice.invoiceCounterNumber}</cbc:UUID>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>PIH</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${finalPreviousHash}</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:AdditionalDocumentReference>
        <cbc:ID>QR</cbc:ID>
        <cac:Attachment>
            <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">SET_QR_CODE_DATA</cbc:EmbeddedDocumentBinaryObject>
        </cac:Attachment>
    </cac:AdditionalDocumentReference>
    <cac:Signature>
        <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
        <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${egs.crNumber || supplier.vatNumber}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${supplier.address.street || "Main St"}</cbc:StreetName>
                <cbc:BuildingNumber>${supplier.address.buildingNumber || "1234"}</cbc:BuildingNumber>
                <cbc:PlotIdentification>${supplier.address.district || "0000"}</cbc:PlotIdentification>
                <cbc:CitySubdivisionName>${supplier.address.district || "Sub Name"}</cbc:CitySubdivisionName>
                <cbc:CityName>${supplier.address.city || "Riyadh"}</cbc:CityName>
                <cbc:PostalZone>${supplier.address.postalCode || "12345"}</cbc:PostalZone>
                <cac:Country>
                    <cbc:IdentificationCode>${supplier.address.country || "SA"}</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>${supplier.vatNumber}</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName>${supplier.registrationName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>${customerPartyXml}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${totals.vatTotal.toFixed(2)}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${invoice.currency || "SAR"}">${totals.taxExclusiveTotal.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${totals.vatTotal.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${totals.vatTotal.toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${invoice.currency || "SAR"}">${totals.lineExtensionTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${invoice.currency || "SAR"}">${totals.taxExclusiveTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${invoice.currency || "SAR"}">${totals.taxInclusiveTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        <cbc:AllowanceTotalAmount currencyID="${invoice.currency || "SAR"}">0.00</cbc:AllowanceTotalAmount>
        <cbc:PayableAmount currencyID="${invoice.currency || "SAR"}">${totals.payableAmount.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${lineItemsXml}
</Invoice>`;

    console.log("✅ [XML GEN] Base XML structure assembled.");
    return xml;
  }
}
