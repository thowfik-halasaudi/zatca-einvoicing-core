import { Injectable } from "@nestjs/common";
import { SignInvoiceDto } from "./dto/sign-invoice.dto";
import * as crypto from "crypto";
import { getZatcaDate, getZatcaTime } from "../common/utils/date.utils";

@Injectable()
export class XmlTemplateService {
  /**
   * Generates a base UBL 2.1 XML for any ZATCA Invoice using the provided DTO.
   * Supports Standard/Simplified and Invoice/Credit/Debit scenarios.
   */
  generateInvoiceXml(dto: SignInvoiceDto): string {
    const { egs, invoice, supplier, customer, lineItems, totals } = dto;

    // ZATCA Rule: For the first invoice (ICV 1), use the hash of '0'
    const DEFAULT_FIRST_HASH =
      "NWZlY2ViOTZmOTk1YTRiMGNjM2YwOTUwZGYzMmM2YjQ5ZGEyN2IyOA==";
    const finalPreviousHash = invoice.previousInvoiceHash || DEFAULT_FIRST_HASH;

    if (invoice.invoiceCounterNumber === 1 && !invoice.previousInvoiceHash) {
      // Automatic initial hash usage logic
    }

    // Auto-Time calculation (Dynamic Timezone)
    const timezone = invoice.timezone || "Asia/Riyadh";
    const finalDate = invoice.issueDate || getZatcaDate(timezone);
    const finalTime = invoice.issueTime || getZatcaTime(timezone);

    // Determine Logic Flags
    const isStandard = invoice.invoiceTypeCodeName?.startsWith("01") || false;
    const isNote =
      invoice.invoiceTypeCode === "381" || invoice.invoiceTypeCode === "383";

    const lineItemsXml = lineItems
      .map((item, index) => {
        const docRefXml = item.documentReference
          ? `
        <cac:DocumentReference>
            <cbc:ID>${item.documentReference.id}</cbc:ID>
            <cbc:UUID>${item.documentReference.uuid}</cbc:UUID>
            <cbc:IssueDate>${item.documentReference.issueDate}</cbc:IssueDate>
            <cbc:IssueTime>${item.documentReference.issueTime}</cbc:IssueTime>
            <cbc:DocumentTypeCode>${item.documentReference.documentTypeCode || "386"}</cbc:DocumentTypeCode>
        </cac:DocumentReference>`
          : "";

        const lineAllowanceChargesXml = (item.allowanceCharges || [])
          .map((ac) => {
            return `
        <cac:AllowanceCharge>
            <cbc:ChargeIndicator>${ac.chargeIndicator}</cbc:ChargeIndicator>
            ${ac.reasonCode ? `<cbc:AllowanceChargeReasonCode>${ac.reasonCode}</cbc:AllowanceChargeReasonCode>` : ""}
            ${ac.reason ? `<cbc:AllowanceChargeReason>${ac.reason}</cbc:AllowanceChargeReason>` : ""}
            <cbc:Amount currencyID="${invoice.currency || "SAR"}">${ac.amount.toFixed(2)}</cbc:Amount>
        </cac:AllowanceCharge>`;
          })
          .join("");

        return `
    <cac:InvoiceLine>
        <cbc:ID>${item.lineId}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="${item.unitCode || "PCE"}">${item.quantity}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency || "SAR"}">${item.taxExclusiveAmount.toFixed(2)}</cbc:LineExtensionAmount>${docRefXml}${lineAllowanceChargesXml}
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${item.vatAmount.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${invoice.currency || "SAR"}">${(item.taxExclusiveAmount + item.vatAmount + (item.allowanceCharges?.reduce((sum, c) => (c.chargeIndicator ? sum + c.amount : sum - c.amount), 0) || 0)).toFixed(2)}</cbc:RoundingAmount>
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

    // Prepayment Line Item (if prepayment exists)
    const prepaymentLineItemXml = dto.prepayment
      ? `
    <cac:InvoiceLine>
        <cbc:ID>${lineItems.length + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="PCE">0.000000</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${invoice.currency || "SAR"}">0.00</cbc:LineExtensionAmount>${
          dto.prepayment.prepaymentInvoiceId
            ? `
        <cac:DocumentReference>
            <cbc:ID>${dto.prepayment.prepaymentInvoiceId}</cbc:ID>${
              dto.prepayment.prepaymentDate
                ? `
            <cbc:IssueDate>${dto.prepayment.prepaymentDate}</cbc:IssueDate>`
                : ""
            }
            <cbc:DocumentTypeCode>386</cbc:DocumentTypeCode>
        </cac:DocumentReference>`
            : ""
        }
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${dto.prepayment.prepaidVATAmount.toFixed(2)}</cbc:TaxAmount>
            <cbc:RoundingAmount currencyID="${invoice.currency || "SAR"}">0.00</cbc:RoundingAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="${invoice.currency || "SAR"}">${dto.prepayment.prepaidAmountExVAT.toFixed(2)}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${dto.prepayment.prepaidVATAmount.toFixed(2)}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID>S</cbc:ID>
                    <cbc:Percent>15.00</cbc:Percent>
                    <cac:TaxScheme>
                        <cbc:ID>VAT</cbc:ID>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Name>Advance payment received - Booking deposit</cbc:Name>
            <cac:ClassifiedTaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>15.00</cbc:Percent>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${invoice.currency || "SAR"}">0.00</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`
      : "";

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

    // --- Dynamic Tax Subtotals Calculation ---
    // Group line items by TaxCategory and Percent to generate <cac:TaxSubtotal> blocks
    const taxSubtotalsMap = new Map<
      string,
      {
        taxableAmount: number;
        taxAmount: number;
        percent: number;
        category: string;
        reasonCode?: string;
        reason?: string;
      }
    >();

    lineItems.forEach((item) => {
      const cat = item.taxCategory || (item.vatPercent > 0 ? "S" : "O");
      const key = `${cat}_${item.vatPercent}`;

      if (!taxSubtotalsMap.has(key)) {
        taxSubtotalsMap.set(key, {
          taxableAmount: 0,
          taxAmount: 0,
          percent: item.vatPercent,
          category: cat,
          reasonCode: item.taxExemptionReasonCode,
          reason: item.taxExemptionReason,
        });
      }

      const sub = taxSubtotalsMap.get(key)!;

      // Calculate net line amount after charges/allowances (Assumes same tax category as line)
      // Note: If charges have different tax rates, they should ideally be handled separately,
      // but for Municipality Fees (Base Taxable), this works.
      const lineNetChange = (item.allowanceCharges || []).reduce((sum, ac) => {
        return ac.chargeIndicator ? sum + ac.amount : sum - ac.amount;
      }, 0);

      sub.taxableAmount += item.taxExclusiveAmount + lineNetChange;
      sub.taxAmount += item.vatAmount;
    });

    const taxSubtotalsXml = Array.from(taxSubtotalsMap.values())
      .map((sub) => {
        return `
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${invoice.currency || "SAR"}">${sub.taxableAmount.toFixed(2)}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${sub.taxAmount.toFixed(2)}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">${sub.category}</cbc:ID>
                <cbc:Percent>${sub.percent.toFixed(2)}</cbc:Percent>
                ${sub.reasonCode ? `<cbc:TaxExemptionReasonCode>${sub.reasonCode}</cbc:TaxExemptionReasonCode>` : ""}
                ${sub.reason ? `<cbc:TaxExemptionReason>${sub.reason}</cbc:TaxExemptionReason>` : ""}
                <cac:TaxScheme>
                    <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>`;
      })
      .join("");

    // Document Level Allowance/Charges
    const allowanceChargesXml = (dto.allowanceCharges || [])
      .map((ac) => {
        return `
    <cac:AllowanceCharge>
        <cbc:ChargeIndicator>${ac.chargeIndicator}</cbc:ChargeIndicator>
        ${ac.reasonCode ? `<cbc:AllowanceChargeReasonCode>${ac.reasonCode}</cbc:AllowanceChargeReasonCode>` : ""}
        ${ac.reason ? `<cbc:AllowanceChargeReason>${ac.reason}</cbc:AllowanceChargeReason>` : ""}
        <cbc:Amount currencyID="${invoice.currency || "SAR"}">${ac.amount.toFixed(2)}</cbc:Amount>
        <cac:TaxCategory>
            <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5305">${ac.taxCategory || "S"}</cbc:ID>
            <cbc:Percent>${(ac.vatPercent || 15).toFixed(2)}</cbc:Percent>
            <cac:TaxScheme>
                <cbc:ID schemeAgencyID="6" schemeID="UN/ECE 5153">VAT</cbc:ID>
            </cac:TaxScheme>
        </cac:TaxCategory>
    </cac:AllowanceCharge>`;
      })
      .join("");

    // Customer Party (Full details for Standard, Basic for Simplified)
    let customerPartyXml = "";
    if (isStandard && customer) {
      // Use the business name if provided, otherwise the guest name
      const customerName =
        customer.registrationName || customer.name || "Customer";
      customerPartyXml = `
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="CRN">${customer.crNumber || "1010010000"}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PostalAddress>
                <cbc:StreetName>${customer.address?.street || "Street"}</cbc:StreetName>
                <cbc:BuildingNumber>${customer.address?.buildingNumber || "0000"}</cbc:BuildingNumber>
                <cbc:CitySubdivisionName>${customer.address?.district || "District"}</cbc:CitySubdivisionName>
                <cbc:CityName>${customer.address?.city || "City"}</cbc:CityName>
                <cbc:PostalZone>${customer.address?.postalCode || "00000"}</cbc:PostalZone>
                <cac:Country><cbc:IdentificationCode>${customer.address?.country || "SA"}</cbc:IdentificationCode></cac:Country>
            </cac:PostalAddress>
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
                <cbc:RegistrationName>${customerName}</cbc:RegistrationName>
            </cac:PartyLegalEntity>
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

    // Determine ProfileID based on invoice type
    // Standard (B2B) = clearance:1.0, Simplified (B2C) = reporting:1.0
    // NOTE: ZATCA Simulation might require 'reporting:1.0' for standard invoices, but Production requires 'clearance:1.0'.
    const profileID = isStandard ? "clearance:1.0" : "reporting:1.0";

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
    <cbc:ProfileID>${profileID}</cbc:ProfileID>
    <cbc:ID>${invoice.invoiceSerialNumber}</cbc:ID>
    <cbc:UUID>${crypto.randomUUID()}</cbc:UUID>
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
                <cbc:CitySubdivisionName>${supplier.address.district || "District"}</cbc:CitySubdivisionName>
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
    ${
      invoice.invoiceTypeCode === "381" || invoice.invoiceTypeCode === "383"
        ? `
    <cac:PaymentMeans>
        <cbc:PaymentMeansCode>42</cbc:PaymentMeansCode>
        <cbc:InstructionNote>${
          invoice.invoiceTypeCode === "381"
            ? "Cancellation"
            : "Debit Adjustment"
        }</cbc:InstructionNote>
    </cac:PaymentMeans>`
        : ""
    }
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${invoice.currency || "SAR"}">${totals.vatTotal.toFixed(2)}</cbc:TaxAmount>${taxSubtotalsXml}
    </cac:TaxTotal>
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="SAR">${(totals.taxCurrencyVatTotal ?? totals.vatTotal).toFixed(2)}</cbc:TaxAmount>
    </cac:TaxTotal>${allowanceChargesXml}
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${invoice.currency || "SAR"}">${totals.lineExtensionTotal.toFixed(2)}</cbc:LineExtensionAmount>
        <cbc:TaxExclusiveAmount currencyID="${invoice.currency || "SAR"}">${totals.taxExclusiveTotal.toFixed(2)}</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount currencyID="${invoice.currency || "SAR"}">${totals.taxInclusiveTotal.toFixed(2)}</cbc:TaxInclusiveAmount>
        ${totals.allowanceTotalAmount ? `<cbc:AllowanceTotalAmount currencyID="${invoice.currency || "SAR"}">${totals.allowanceTotalAmount.toFixed(2)}</cbc:AllowanceTotalAmount>` : ""}
        ${totals.chargeTotalAmount ? `<cbc:ChargeTotalAmount currencyID="${invoice.currency || "SAR"}">${totals.chargeTotalAmount.toFixed(2)}</cbc:ChargeTotalAmount>` : ""}
        ${totals.prepaidAmount ? `<cbc:PrepaidAmount currencyID="${invoice.currency || "SAR"}">${totals.prepaidAmount.toFixed(2)}</cbc:PrepaidAmount>` : ""}
        ${totals.payableRoundingAmount ? `<cbc:PayableRoundingAmount currencyID="${invoice.currency || "SAR"}">${totals.payableRoundingAmount.toFixed(2)}</cbc:PayableRoundingAmount>` : ""}
        <cbc:PayableAmount currencyID="${invoice.currency || "SAR"}">${totals.payableAmount.toFixed(2)}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${lineItemsXml}${prepaymentLineItemXml}
</Invoice>`;

    return xml;
  }
}
