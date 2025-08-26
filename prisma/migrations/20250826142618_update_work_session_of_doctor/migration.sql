-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrescriptionStatus" ADD VALUE 'WAITING';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'SERVING';

-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 1;
