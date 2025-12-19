import { Module } from "@nestjs/common";
import { CommonModule } from "../common/common.module";
import { CryptoCliService } from "./crypto-cli.service";

/**
 * Cryptography Module
 *
 * Provides cryptographic operations via OpenSSL CLI
 * Replaces custom Node.js crypto implementations with exact PHP CLI calls
 */
@Module({
  imports: [CommonModule],
  providers: [CryptoCliService],
  exports: [CryptoCliService],
})
export class CryptographyModule {}
