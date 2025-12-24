import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";

export class EgsDto {
  @IsString()
  @IsNotEmpty()
  commonName: string;

  @IsString()
  @IsOptional()
  organizationName?: string;

  @IsString()
  @IsOptional()
  organizationUnitName?: string;

  @IsString()
  @IsNotEmpty()
  vatNumber: string;

  @IsString()
  @IsOptional()
  crNumber?: string;

  @IsString()
  @IsOptional()
  countryCode?: string;

  @IsString()
  @IsOptional()
  invoiceType?: string;

  @IsBoolean()
  @IsOptional()
  production?: boolean = false;
}

export class InvoiceMetaDto {
  @IsString()
  @IsOptional()
  invoiceSerialNumber?: string;

  @IsString()
  @IsOptional()
  uuid?: string;

  @IsString()
  @IsOptional()
  issueDate?: string;

  @IsString()
  @IsOptional()
  issueTime?: string;

  @IsString()
  @IsOptional()
  currency?: string = "SAR";

  @IsNumber()
  @IsOptional()
  invoiceCounterNumber?: number;

  @IsString()
  @IsOptional()
  previousInvoiceHash?: string;

  @IsString()
  @IsOptional()
  paymentMeansCode?: string;

  @IsString()
  @IsOptional()
  deliveryDate?: string;

  @IsString()
  @IsOptional()
  invoiceTypeCode?: string = "388"; // 388=Invoice, 381=Credit, 383=Debit

  @IsString()
  @IsOptional()
  invoiceTypeCodeName?: string = "0211010"; // e.g., 0100000 (Standard), 0200000 (Simplified)

  @IsString()
  @IsOptional()
  billingReferenceId?: string; // Original Invoice ID for Credit/Debit Notes
}

export class AddressDto {
  @IsString()
  @IsOptional()
  fullAddress?: string; // Single-line address (e.g., "123 Main St, Riyadh, 12345, SA")

  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  buildingNumber?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string = "SA";
}

export class AllowanceChargeDto {
  @IsBoolean()
  chargeIndicator: boolean; // true for Charge, false for Allowance (Discount)

  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  amount: number;

  @IsNumber()
  @IsOptional()
  vatPercent?: number = 15;

  @IsString()
  @IsOptional()
  taxCategory?: string = "S";
}

export class DocumentReferenceDto {
  @IsString()
  id: string;

  @IsString()
  uuid: string;

  @IsString()
  issueDate: string;

  @IsString()
  issueTime: string;

  @IsString()
  @IsOptional()
  documentTypeCode?: string = "386";
}

export class SupplierDto {
  @IsString()
  @IsNotEmpty()
  registrationName: string;

  @IsString()
  @IsNotEmpty()
  vatNumber: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;
}

export class CustomerDto {
  @IsString()
  @IsOptional()
  type?: string; // 'B2B' or 'B2C'

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  registrationName?: string; // Business name for B2B

  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsString()
  @IsOptional()
  crNumber?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

export class PrepaymentDto {
  @IsNumber()
  prepaidAmount: number; // Total prepaid including VAT

  @IsNumber()
  prepaidAmountExVAT: number; // Prepaid amount excluding VAT

  @IsNumber()
  prepaidVATAmount: number; // VAT on prepaid amount

  @IsString()
  @IsOptional()
  prepaymentInvoiceId?: string; // Reference to prepayment invoice

  @IsString()
  @IsOptional()
  prepaymentDate?: string; // Date when prepayment was made
}

export class InvoiceLineItemDto {
  @IsString()
  @IsNotEmpty()
  lineId: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  quantity: number;

  @IsString()
  @IsOptional()
  unitCode?: string = "PCE";

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  taxExclusiveAmount: number;

  @IsNumber()
  vatPercent: number; // e.g., 15

  @IsNumber()
  vatAmount: number;

  @IsString()
  @IsOptional()
  taxCategory?: string = "S";

  @IsString()
  @IsOptional()
  taxExemptionReasonCode?: string;

  @IsString()
  @IsOptional()
  taxExemptionReason?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentReferenceDto)
  documentReference?: DocumentReferenceDto;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllowanceChargeDto)
  allowanceCharges?: AllowanceChargeDto[];
}

export class TotalsDto {
  @IsNumber()
  lineExtensionTotal: number;

  @IsNumber()
  taxExclusiveTotal: number;

  @IsNumber()
  @IsOptional()
  vatTotal: number;

  @IsNumber()
  @IsOptional()
  taxCurrencyVatTotal?: number;

  @IsNumber()
  taxInclusiveTotal: number;

  @IsNumber()
  @IsOptional()
  allowanceTotalAmount?: number = 0;

  @IsNumber()
  @IsOptional()
  chargeTotalAmount?: number = 0;

  @IsNumber()
  @IsOptional()
  prepaidAmount?: number = 0;

  @IsNumber()
  @IsOptional()
  payableRoundingAmount?: number = 0;

  @IsNumber()
  payableAmount: number;
}

export class SignInvoiceDto {
  @IsObject()
  @ValidateNested()
  @Type(() => EgsDto)
  egs: EgsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => InvoiceMetaDto)
  invoice: InvoiceMetaDto;

  @IsObject()
  @ValidateNested()
  @Type(() => SupplierDto)
  supplier: SupplierDto;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AllowanceChargeDto)
  allowanceCharges?: AllowanceChargeDto[];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => PrepaymentDto)
  prepayment?: PrepaymentDto;

  @IsObject()
  @ValidateNested()
  @Type(() => TotalsDto)
  totals: TotalsDto;
}
