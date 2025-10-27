-- AlterEnum
ALTER TYPE "PrescriptionStatus" ADD VALUE 'RETURNING';

-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "callCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skipCount" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
