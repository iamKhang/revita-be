-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "issued_prescription_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "belongs_to_service_id" TEXT;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_belongs_to_service_id_fkey" FOREIGN KEY ("belongs_to_service_id") REFERENCES "prescription_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
