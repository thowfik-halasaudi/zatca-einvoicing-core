import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ZatcaClientService } from "./zatca-client.service";

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [ZatcaClientService],
  exports: [ZatcaClientService],
})
export class ZatcaModule {}
