import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Hard-reset all business data in a safe FK order.
 */
async function main() {
  console.log("--------------------------------------------------");
  console.log("🧹 Starting full database cleanup...");

  const steps = [
    { label: "InvoiceItem", action: () => prisma.invoiceItem.deleteMany() },
    { label: "InvoiceHash", action: () => prisma.invoiceHash.deleteMany() },
    { label: "ZatcaSubmission", action: () => prisma.zatcaSubmission.deleteMany() },
    { label: "Invoice", action: () => prisma.invoice.deleteMany() },
    { label: "InvoiceCounter", action: () => prisma.invoiceCounter.deleteMany() },
    { label: "EgsUnit", action: () => prisma.egsUnit.deleteMany() },
  ];

  for (const step of steps) {
    const result = await step.action();
    console.log(`✅ Cleared ${step.label}: ${result.count} row(s) removed`);
  }

  console.log("🎉 Database cleanup complete.");
}

main()
  .catch((err) => {
    console.error("❌ Cleanup failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


