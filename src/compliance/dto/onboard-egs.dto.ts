import { IsString, IsNotEmpty, IsEnum, IsOptional } from "class-validator";

export enum Environment {
  SIMULATION = "SIMULATION",
  PRODUCTION = "PRODUCTION",
}

export class OnboardEgsDto {
  @IsString()
  @IsNotEmpty()
  commonName: string;

  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @IsString()
  @IsNotEmpty()
  organizationIdentifier: string;

  @IsString()
  @IsNotEmpty()
  organizationUnitName: string;

  @IsString()
  @IsNotEmpty()
  organizationName: string;

  @IsString()
  @IsNotEmpty()
  countryName: string;

  @IsString()
  @IsNotEmpty()
  invoiceType: string;

  @IsString()
  @IsNotEmpty()
  locationAddress: string;

  @IsString()
  @IsNotEmpty()
  industryBusinessCategory: string;

  @IsOptional()
  production?: boolean = false;
}
