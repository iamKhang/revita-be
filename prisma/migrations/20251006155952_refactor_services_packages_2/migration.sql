-- AlterTable
ALTER TABLE "medication_prescription_items" ADD COLUMN     "drugId" TEXT;

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

-- CreateIndex
CREATE UNIQUE INDEX "drugs_ndc_key" ON "drugs"("ndc");

-- AddForeignKey
ALTER TABLE "medication_prescription_items" ADD CONSTRAINT "medication_prescription_items_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
