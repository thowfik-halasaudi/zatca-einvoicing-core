/*
  Warnings:

  - Added the required column `commonName` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoiceTypeCodeName` to the `Invoice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "commonName" TEXT NOT NULL,
ADD COLUMN     "invoiceTypeCodeName" TEXT NOT NULL,
ADD COLUMN     "qrCode" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_commonName_idx" ON "Invoice"("commonName");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_commonName_fkey" FOREIGN KEY ("commonName") REFERENCES "EgsUnit"("commonName") ON DELETE RESTRICT ON UPDATE CASCADE;
