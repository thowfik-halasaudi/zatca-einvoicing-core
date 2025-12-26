/**
 * Root Application Module
 *
 * Configures global providers (Interceptor, Filter), database connection (Prisma),
 * internationalization (i18n), and imports feature modules (Invoice, Compliance).
 */
import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { CommonModule } from "./common/common.module";
import { ComplianceModule } from "./compliance/compliance.module";
import { CryptographyModule } from "./cryptography/cryptography.module";
import { InvoiceModule } from "./invoice/invoice.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AcceptLanguageResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import * as path from "path";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

@Module({
  imports: [
    PrismaModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommonModule,
    ComplianceModule,
    CryptographyModule,
    InvoiceModule,
    I18nModule.forRoot({
      fallbackLanguage: "en",
      loaderOptions: {
        path: path.join(__dirname, "/locales/"),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ["lang"] },
        AcceptLanguageResolver,
      ],
    }),
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
