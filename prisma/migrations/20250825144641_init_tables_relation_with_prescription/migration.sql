/*
  Warnings:

  - You are about to drop the column `auth_id` on the `invoices` table. All the data in the column will be lost.
  - Added the required column `cashierId` to the `invoices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientProfileId` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'CASHIER';

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_booker_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_invoice_id_fkey";

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_auth_id_fkey";

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "auth_id",
ADD COLUMN     "cashierId" TEXT NOT NULL,
ADD COLUMN     "patientProfileId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "cashiers" (
    "id" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,

    CONSTRAINT "cashiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_details" (
    "invoiceId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "prescriptionId" TEXT
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" TEXT NOT NULL,
    "prescription_code" TEXT NOT NULL,
    "doctorId" TEXT,
    "patientProfileId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_services" (
    "prescriptionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "note" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "cashiers_auth_id_key" ON "cashiers"("auth_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_details_invoiceId_serviceId_key" ON "invoice_details"("invoiceId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "prescription_services_prescriptionId_serviceId_key" ON "prescription_services"("prescriptionId", "serviceId");

-- AddForeignKey
ALTER TABLE "cashiers" ADD CONSTRAINT "cashiers_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
