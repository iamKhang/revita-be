-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_owner_id_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_owner_id_fkey_admin";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_owner_id_fkey_cashier";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_owner_id_fkey_doctor";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_owner_id_fkey_receptionist";
