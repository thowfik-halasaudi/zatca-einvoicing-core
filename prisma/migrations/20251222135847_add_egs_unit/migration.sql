-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "id" SERIAL NOT NULL,
    "seriesKey" TEXT NOT NULL DEFAULT 'INV',
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "invoiceTypeCode" TEXT NOT NULL,
    "invoiceCategory" TEXT NOT NULL,
    "issueDateTime" TIMESTAMP(3) NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerVatNumber" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "buyerName" TEXT,
    "buyerVatNumber" TEXT,
    "buyerAddress" TEXT,
    "referenceInvoiceNumber" TEXT,
    "referenceUUID" TEXT,
    "referenceIssueDate" TIMESTAMP(3),
    "prepaidAmount" DOUBLE PRECISION DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION DEFAULT 0,
    "subTotal" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "signedXml" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceHash" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "previousInvoiceHash" TEXT,
    "currentInvoiceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceHash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZatcaSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "submissionType" TEXT NOT NULL,
    "zatcaStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "qrCode" TEXT,
    "zatcaResponse" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZatcaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EgsUnit" (
    "id" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "csr" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "onboardingConfig" TEXT,
    "binarySecurityToken" TEXT,
    "secret" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EgsUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceCounter_seriesKey_key" ON "InvoiceCounter"("seriesKey");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_uuid_key" ON "Invoice"("uuid");

-- CreateIndex
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_uuid_idx" ON "Invoice"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceHash_invoiceId_key" ON "InvoiceHash"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaSubmission_invoiceId_key" ON "ZatcaSubmission"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "EgsUnit_commonName_key" ON "EgsUnit"("commonName");

-- CreateIndex
CREATE INDEX "EgsUnit_commonName_idx" ON "EgsUnit"("commonName");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceHash" ADD CONSTRAINT "InvoiceHash_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZatcaSubmission" ADD CONSTRAINT "ZatcaSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
