/*
  Warnings:

  - Added the required column `updatedAt` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EgsUnit" ADD COLUMN     "binarySecurityToken" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "secret" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "onboardingConfig" DROP NOT NULL,
ALTER COLUMN "production" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "EgsUnit_commonName_idx" ON "EgsUnit"("commonName");
