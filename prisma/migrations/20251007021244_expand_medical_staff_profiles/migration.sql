/*
  Warnings:

  - A unique constraint covering the columns `[license_number]` on the table `doctors` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('LICENSE', 'DEGREE', 'TRAINING', 'OTHER');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "position" TEXT;

-- AlterTable
ALTER TABLE "booth_services" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "cashiers" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "department" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "license_expiry" TIMESTAMP(3),
ADD COLUMN     "license_issued_at" TIMESTAMP(3),
ADD COLUMN     "license_number" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "specialty" TEXT,
ADD COLUMN     "sub_specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "receptionists" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "technicians" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "title" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "issued_by" TEXT,
    "issued_at" TIMESTAMP(3),
    "expiry_at" TIMESTAMP(3),
    "file" TEXT,
    "description" TEXT,
    "doctor_id" TEXT,
    "technician_id" TEXT,
    "receptionist_id" TEXT,
    "cashier_id" TEXT,
    "admin_id" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_license_number_key" ON "doctors"("license_number");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_receptionist_id_fkey" FOREIGN KEY ("receptionist_id") REFERENCES "receptionists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
