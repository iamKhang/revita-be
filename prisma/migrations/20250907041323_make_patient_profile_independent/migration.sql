-- DropForeignKey
ALTER TABLE "patient_profiles" DROP CONSTRAINT "patient_profiles_patient_id_fkey";

-- AlterTable
ALTER TABLE "patient_profiles" ALTER COLUMN "patient_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
