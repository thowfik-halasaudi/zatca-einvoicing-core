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

  // Detailed Address
  // Detailed Address Fields (Optional for now to support old clients, but preferred)
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsOptional()
  buildingNumber?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  // Keep locationAddress for legacy/CLI compatibility just in case, but it won't be saved to DB directly
  @IsString()
  @IsOptional()
  locationAddress?: string;

  /*
  // Detailed address components we want to store
  @IsString()
  @IsOptional()
  street?: string = "Unknown";

  @IsString()
  @IsOptional()
  buildingNumber?: string = "0000";

  @IsString()
  @IsOptional()
  city?: string = "Riyadh";

  @IsString()
  @IsOptional()
  district?: string = "District";

  @IsString()
  @IsOptional()
  postalCode?: string = "00000";
  */

  @IsString()
  @IsNotEmpty()
  industryBusinessCategory: string;

  @IsString()
  @IsOptional()
  propertyId?: string;

  @IsOptional()
  production?: boolean = false;
}
