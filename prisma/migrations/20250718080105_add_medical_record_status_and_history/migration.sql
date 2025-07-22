-- CreateEnum
CREATE TYPE "MedicalRecordStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED');

-- AlterTable
ALTER TABLE "medical_records" ADD COLUMN     "status" "MedicalRecordStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "MedicalRecordHistory" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,

    CONSTRAINT "MedicalRecordHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MedicalRecordHistory" ADD CONSTRAINT "MedicalRecordHistory_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
