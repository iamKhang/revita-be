/*
  Warnings:

  - You are about to drop the column `admin_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `cashier_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `doctor_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `receptionist_id` on the `certificates` table. All the data in the column will be lost.
  - You are about to drop the column `technician_id` on the `certificates` table. All the data in the column will be lost.
  - Added the required column `owner_id` to the `certificates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_role` to the `certificates` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_admin_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_cashier_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_receptionist_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_technician_id_fkey";

-- AlterTable
ALTER TABLE "certificates" DROP COLUMN "admin_id",
DROP COLUMN "cashier_id",
DROP COLUMN "doctor_id",
DROP COLUMN "receptionist_id",
DROP COLUMN "technician_id",
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "owner_role" "Role" NOT NULL;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_owner_id_fkey_doctor" FOREIGN KEY ("owner_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "technicians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_owner_id_fkey_receptionist" FOREIGN KEY ("owner_id") REFERENCES "receptionists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_owner_id_fkey_cashier" FOREIGN KEY ("owner_id") REFERENCES "cashiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_owner_id_fkey_admin" FOREIGN KEY ("owner_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
