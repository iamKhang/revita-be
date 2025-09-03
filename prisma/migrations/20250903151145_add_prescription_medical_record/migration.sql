-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "medicalRecordId" TEXT;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
