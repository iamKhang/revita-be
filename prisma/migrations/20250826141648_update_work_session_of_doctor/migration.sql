-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING';
