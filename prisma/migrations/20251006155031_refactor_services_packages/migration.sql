/*
  Warnings:

  - The values [RECALL_FIRST,RECALL_SECOND,RECALL_THIRD,RECALL_BACK] on the enum `PrescriptionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `drugId` on the `medication_prescription_items` table. All the data in the column will be lost.
  - You are about to drop the column `is_allowed` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `parent_id` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `time_per_patient` on the `services` table. All the data in the column will be lost.
  - You are about to drop the `Booth` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MedicalRecordHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `drugs` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PrescriptionStatus_new" AS ENUM ('NOT_STARTED', 'PENDING', 'WAITING', 'PREPARING', 'SERVING', 'WAITING_RESULT', 'COMPLETED', 'DELAYED', 'CANCELLED', 'SKIPPED');
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

-- DropForeignKey
ALTER TABLE "Booth" DROP CONSTRAINT "Booth_roomId_fkey";

-- DropForeignKey
ALTER TABLE "MedicalRecordHistory" DROP CONSTRAINT "MedicalRecordHistory_medicalRecordId_fkey";

-- DropForeignKey
ALTER TABLE "medication_prescription_items" DROP CONSTRAINT "medication_prescription_items_drugId_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "work_sessions" DROP CONSTRAINT "work_sessions_boothId_fkey";

-- AlterTable
ALTER TABLE "medication_prescription_items" DROP COLUMN "drugId";

-- AlterTable
ALTER TABLE "services" DROP COLUMN "is_allowed",
DROP COLUMN "parent_id",
DROP COLUMN "time_per_patient",
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "currency" TEXT DEFAULT 'VND',
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "duration_minutes" SMALLINT DEFAULT 15,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_insurance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- DropTable
DROP TABLE "Booth";

-- DropTable
DROP TABLE "MedicalRecordHistory";

-- DropTable
DROP TABLE "drugs";

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "package_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "category_id" TEXT,
    "specialty_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price_override" DOUBLE PRECISION,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "notes" TEXT,

    CONSTRAINT "package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_record_histories" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,

    CONSTRAINT "medical_record_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booths" (
    "id" TEXT NOT NULL,
    "booth_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packages_package_code_key" ON "packages"("package_code");

-- CreateIndex
CREATE INDEX "package_items_package_id_idx" ON "package_items"("package_id");

-- CreateIndex
CREATE INDEX "package_items_service_id_idx" ON "package_items"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_items_package_id_service_id_key" ON "package_items"("package_id", "service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "booths_booth_code_key" ON "booths"("booth_code");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_items" ADD CONSTRAINT "package_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_histories" ADD CONSTRAINT "medical_record_histories_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
