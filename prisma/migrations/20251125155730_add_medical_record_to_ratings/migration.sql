/*
  Warnings:

  - A unique constraint covering the columns `[medical_record_id,patient_id]` on the table `doctor_ratings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `medical_record_id` to the `doctor_ratings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "doctor_ratings_doctor_id_patient_id_key";

-- AlterTable
ALTER TABLE "doctor_ratings" ADD COLUMN     "medical_record_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "doctor_ratings_medical_record_id_idx" ON "doctor_ratings"("medical_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_ratings_medical_record_id_patient_id_key" ON "doctor_ratings"("medical_record_id", "patient_id");

-- AddForeignKey
ALTER TABLE "doctor_ratings" ADD CONSTRAINT "doctor_ratings_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
