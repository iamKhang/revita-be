/*
  Warnings:

  - You are about to drop the `medication_prescription_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "medication_prescription_items" DROP CONSTRAINT "medication_prescription_items_prescription_id_fkey";

-- AlterTable
ALTER TABLE "medication_prescriptions" ADD COLUMN     "drug_names" TEXT[];

-- DropTable
DROP TABLE "medication_prescription_items";
