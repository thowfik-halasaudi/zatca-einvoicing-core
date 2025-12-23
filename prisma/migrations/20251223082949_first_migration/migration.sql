/*
  Warnings:

  - You are about to drop the column `binarySecurityToken` on the `EgsUnit` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `EgsUnit` table. All the data in the column will be lost.
  - You are about to drop the column `requestId` on the `EgsUnit` table. All the data in the column will be lost.
  - You are about to drop the column `secret` on the `EgsUnit` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `EgsUnit` table. All the data in the column will be lost.
  - Added the required column `csr` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Made the column `onboardingConfig` on table `EgsUnit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "EgsUnit_commonName_idx";

-- AlterTable
ALTER TABLE "EgsUnit" DROP COLUMN "binarySecurityToken",
DROP COLUMN "createdAt",
DROP COLUMN "requestId",
DROP COLUMN "secret",
DROP COLUMN "updatedAt",
ADD COLUMN     "csr" TEXT NOT NULL,
ALTER COLUMN "onboardingConfig" SET NOT NULL,
ALTER COLUMN "production" DROP DEFAULT;
