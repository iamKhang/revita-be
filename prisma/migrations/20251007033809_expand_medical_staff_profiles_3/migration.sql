/*
  Warnings:

  - You are about to drop the column `owner_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `owner_role` on the `certificates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "owner_id",
DROP COLUMN "owner_role",
ADD COLUMN     "doctor_id" TEXT,
ADD COLUMN     "technician_id" TEXT;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
