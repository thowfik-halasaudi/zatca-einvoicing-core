import { IsString, IsNotEmpty } from "class-validator";

export class CheckComplianceDto {
  @IsString()
  @IsNotEmpty()
  commonName: string;

  @IsString()
  @IsNotEmpty()
  invoiceSerialNumber: string;
}
