/*
  Warnings:

  - Added the required column `countryName` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `industryBusinessCategory` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `invoiceType` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `locationAddress` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationIdentifier` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationName` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationUnitName` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serialNumber` to the `EgsUnit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EgsUnit" ADD COLUMN     "countryName" TEXT NOT NULL,
ADD COLUMN     "industryBusinessCategory" TEXT NOT NULL,
ADD COLUMN     "invoiceType" TEXT NOT NULL,
ADD COLUMN     "locationAddress" TEXT NOT NULL,
ADD COLUMN     "organizationIdentifier" TEXT NOT NULL,
ADD COLUMN     "organizationName" TEXT NOT NULL,
ADD COLUMN     "organizationUnitName" TEXT NOT NULL,
ADD COLUMN     "production" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "serialNumber" TEXT NOT NULL;
