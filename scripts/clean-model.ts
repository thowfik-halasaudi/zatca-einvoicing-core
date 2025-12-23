import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CleanerResult = { model: string; count: number };
type Cleaner = () => Promise<CleanerResult[]>;

/**
 * Return cleaners keyed by model name (case-insensitive).
 * For models with dependencies, we clear children first to avoid FK errors.
 */
const cleaners: Record<string, Cleaner> = {
  egsunit: async () => {
    const res = await prisma.egsUnit.deleteMany();
    return [{ model: "EgsUnit", count: res.count }];
  },
  invoicecounter: async () => {
    const res = await prisma.invoiceCounter.deleteMany();
    return [{ model: "InvoiceCounter", count: res.count }];
  },
  invoice: async () => {
    const steps: CleanerResult[] = [];
    const items = await prisma.invoiceItem.deleteMany();
    steps.push({ model: "InvoiceItem", count: items.count });
    const hashes = await prisma.invoiceHash.deleteMany();
    steps.push({ model: "InvoiceHash", count: hashes.count });
    const subs = await prisma.zatcaSubmission.deleteMany();
    steps.push({ model: "ZatcaSubmission", count: subs.count });
    const invoices = await prisma.invoice.deleteMany();
    steps.push({ model: "Invoice", count: invoices.count });
    return steps;
  },
  invoiceitem: async () => {
    const res = await prisma.invoiceItem.deleteMany();
    return [{ model: "InvoiceItem", count: res.count }];
  },
  invoicehash: async () => {
    const res = await prisma.invoiceHash.deleteMany();
    return [{ model: "InvoiceHash", count: res.count }];
  },
  zatcasubmission: async () => {
    const res = await prisma.zatcaSubmission.deleteMany();
    return [{ model: "ZatcaSubmission", count: res.count }];
  },
};

async function main() {
  const targetRaw = process.argv[2] || "";
  const target = targetRaw.toLowerCase();

  if (!target || !cleaners[target]) {
    console.error("❌ Please provide a model to clear.");
    console.error("   Supported: egsunit, invoice, invoicecounter, invoiceitem, invoicehash, zatcasubmission");
    process.exitCode = 1;
    return;
  }

  console.log("--------------------------------------------------");
  console.log(`🧹 Clearing model: ${targetRaw}`);

  const results = await cleaners[target]();
  for (const r of results) {
    console.log(`✅ Cleared ${r.model}: ${r.count} row(s) removed`);
  }

  console.log("🎉 Done.");
}

main()
  .catch((err) => {
    console.error("❌ Cleanup failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

