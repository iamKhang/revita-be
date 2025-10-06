/*
  Warnings:

  - You are about to drop the column `drug_names` on the `medication_prescriptions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MedicationPrescriptionStatus" AS ENUM ('DRAFT', 'SIGNED', 'DISPENSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "medication_prescriptions" DROP COLUMN "drug_names",
ADD COLUMN     "status" "MedicationPrescriptionStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "drugs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ndc" TEXT,
    "strength" TEXT,
    "dosage_form" TEXT,
    "route" TEXT,
    "unit" TEXT,
    "source" JSONB,

    CONSTRAINT "drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "drugId" TEXT,
    "name" TEXT NOT NULL,
    "ndc" TEXT,
    "strength" TEXT,
    "dosage_form" TEXT,
    "route" TEXT,
    "dose" DOUBLE PRECISION,
    "dose_unit" TEXT,
    "frequency" TEXT,
    "duration_days" INTEGER,
    "quantity" DOUBLE PRECISION,
    "quantity_unit" TEXT,
    "instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drugs_ndc_key" ON "drugs"("ndc");

-- AddForeignKey
ALTER TABLE "medication_prescription_items" ADD CONSTRAINT "medication_prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "medication_prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_prescription_items" ADD CONSTRAINT "medication_prescription_items_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
