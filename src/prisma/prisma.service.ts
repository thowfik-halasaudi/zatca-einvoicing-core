import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    console.log("--------------------------------------------------");
    console.log("📡 [PRISMA] CONNECTING TO DATABASE...");
    console.log(
      `🌐 URL: ${process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":****@")}`
    );
    try {
      await this.$connect();
      console.log("✅ [PRISMA] DATABASE CONNECTED SUCCESSFULLY.");
    } catch (e) {
      console.log("❌ [PRISMA] DATABASE CONNECTION FAILED!");
      console.log(`❗ Error: ${e.message}`);
    }
    console.log("--------------------------------------------------");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
