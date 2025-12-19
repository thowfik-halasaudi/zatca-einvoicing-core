import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "./common/common.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { CryptographyModule } from "./cryptography/cryptography.module";
import { InvoiceModule } from "./invoice/invoice.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommonModule,
    ComplianceModule,
    CryptographyModule,
    InvoiceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
