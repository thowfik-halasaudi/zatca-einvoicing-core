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
  @IsNotEmpty()
  invoiceSerialNumber: string;

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
  invoiceCounterNumber: number;

  @IsString()
  @IsOptional()
  previousInvoiceHash?: string;

  @IsString()
  @IsOptional()
  paymentMeansCode?: string;

  @IsString()
  @IsOptional()
  deliveryDate?: string;
}

export class AddressDto {
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
  type?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
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
}

export class TotalsDto {
  @IsNumber()
  lineExtensionTotal: number;

  @IsNumber()
  taxExclusiveTotal: number;

  @IsNumber()
  vatTotal: number;

  @IsNumber()
  taxInclusiveTotal: number;

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

  @IsObject()
  @ValidateNested()
  @Type(() => TotalsDto)
  totals: TotalsDto;
}
