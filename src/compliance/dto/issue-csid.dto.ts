import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class IssueCsidDto {
  @IsString()
  @IsNotEmpty()
  commonName: string;

  @IsString()
  @IsNotEmpty()
  otp: string;

  @IsOptional()
  production?: boolean = false;
}
