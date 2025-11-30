/*
  Warnings:

  - The values [DELAYED] on the enum `PrescriptionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PrescriptionStatus_new" AS ENUM ('NOT_STARTED', 'PENDING', 'WAITING', 'PREPARING', 'SERVING', 'WAITING_RESULT', 'RETURNING', 'COMPLETED', 'CANCELLED', 'SKIPPED', 'RESCHEDULED');
ALTER TABLE "prescription_services" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "prescriptions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "prescriptions" ALTER COLUMN "status" TYPE "PrescriptionStatus_new" USING ("status"::text::"PrescriptionStatus_new");
ALTER TABLE "prescription_services" ALTER COLUMN "status" TYPE "PrescriptionStatus_new" USING ("status"::text::"PrescriptionStatus_new");
ALTER TYPE "PrescriptionStatus" RENAME TO "PrescriptionStatus_old";
ALTER TYPE "PrescriptionStatus_new" RENAME TO "PrescriptionStatus";
DROP TYPE "PrescriptionStatus_old";
ALTER TABLE "prescription_services" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
ALTER TABLE "prescriptions" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';
COMMIT;
