-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "booth_id" TEXT,
ADD COLUMN     "clinic_room_id" TEXT,
ADD COLUMN     "work_session_id" TEXT;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_clinic_room_id_fkey" FOREIGN KEY ("clinic_room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_work_session_id_fkey" FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
