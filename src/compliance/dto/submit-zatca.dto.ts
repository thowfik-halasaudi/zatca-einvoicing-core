import { IsNotEmpty, IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SubmitZatcaDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: "Common Name of the onboarded EGS" })
  commonName: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: "Invoice Serial Number to submit" })
  invoiceSerialNumber: string;

  @IsOptional()
  @IsBoolean()
  @ApiProperty({
    description: "Whether to use production endpoints",
    default: false,
  })
  production?: boolean;
}
