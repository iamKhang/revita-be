/*
  Warnings:

  - You are about to drop the column `department` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `license_expiry` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `license_issued_at` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `license_number` on the `doctors` table. All the data in the column will be lost.
  - You are about to drop the column `specialty` on the `doctors` table. All the data in the column will be lost.
  - Added the required column `specialty_id` to the `doctors` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "doctors_license_number_key";

-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "department",
DROP COLUMN "license_expiry",
DROP COLUMN "license_issued_at",
DROP COLUMN "license_number",
DROP COLUMN "specialty",
ADD COLUMN     "specialty_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
