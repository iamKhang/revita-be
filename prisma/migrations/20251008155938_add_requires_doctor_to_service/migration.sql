/*
  Warnings:

  - You are about to drop the column `department_id` on the `services` table. All the data in the column will be lost.
  - You are about to drop the column `is_insurance` on the `services` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_department_id_fkey";

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "requires_doctor" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "department_id",
DROP COLUMN "is_insurance",
ADD COLUMN     "requires_doctor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialty_id" TEXT;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
