/*
  Warnings:

  - You are about to drop the column `clinic_id` on the `admins` table. All the data in the column will be lost.
  - You are about to drop the column `clinic_id` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `clinic_id` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `clinic_id` on the `receptionists` table. All the data in the column will be lost.
  - You are about to drop the column `clinic_id` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `clinic_id` on the `specialties` table. All the data in the column will be lost.
  - You are about to drop the `clinics` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "admins" DROP CONSTRAINT "admins_clinic_id_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clinic_id_fkey";

-- DropForeignKey
ALTER TABLE "doctors" DROP CONSTRAINT "doctors_clinic_id_fkey";

-- DropForeignKey
ALTER TABLE "receptionists" DROP CONSTRAINT "receptionists_clinic_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_clinic_id_fkey";

-- DropForeignKey
ALTER TABLE "specialties" DROP CONSTRAINT "specialties_clinic_id_fkey";

-- AlterTable
ALTER TABLE "admins" DROP COLUMN "clinic_id";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "clinic_id";

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "clinic_id";

-- AlterTable
ALTER TABLE "receptionists" DROP COLUMN "clinic_id";

-- AlterTable
ALTER TABLE "services" DROP COLUMN "clinic_id";

-- AlterTable
ALTER TABLE "specialties" DROP COLUMN "clinic_id";

-- DropTable
DROP TABLE "clinics";
