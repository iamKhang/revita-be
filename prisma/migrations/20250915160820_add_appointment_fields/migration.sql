/*
  Warnings:

  - You are about to drop the column `invoice_id` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `appointmentId` on the `medical_records` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrescriptionStatus" ADD VALUE 'PREPARING';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'SKIPPED';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'RECALL_FIRST';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'RECALL_SECOND';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'RECALL_THIRD';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'RECALL_BACK';

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_service_id_fkey";

-- DropForeignKey
ALTER TABLE "medical_records" DROP CONSTRAINT "medical_records_appointmentId_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "invoice_id",
ALTER COLUMN "booker_id" DROP NOT NULL,
ALTER COLUMN "service_id" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "change_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "medical_records" DROP COLUMN "appointmentId",
ADD COLUMN     "appointment_id" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "is_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" TEXT,
ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "time_per_patient" DROP NOT NULL;

-- CreateTable
CREATE TABLE "appointment_services" (
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "workSessionId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "appointment_services_appointmentId_serviceId_key" ON "appointment_services"("appointmentId", "serviceId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_services" ADD CONSTRAINT "appointment_services_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
