import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber: "HILTONGROUP-SD-25-00000034" },
    select: { qrCode: true },
  });

  if (invoice && invoice.qrCode) {
    console.log("Length:", invoice.qrCode.length);
    console.log("First 50 chars:", invoice.qrCode.substring(0, 50));
    console.log(
      "Last 50 chars:",
      invoice.qrCode.substring(invoice.qrCode.length - 50)
    );
    // Check for whitespace
    console.log("Has newlines:", invoice.qrCode.includes("\n"));
    console.log("Has returns:", invoice.qrCode.includes("\r"));
  } else {
    console.log("QR Code is null or undefined");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
