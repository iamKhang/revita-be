-- AlterTable
ALTER TABLE "medication_prescriptions" ADD COLUMN     "feedback_at" TIMESTAMP(3),
ADD COLUMN     "feedback_by_id" TEXT,
ADD COLUMN     "feedback_by_role" TEXT,
ADD COLUMN     "feedback_is_urgent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feedback_message" TEXT;

-- AddForeignKey
ALTER TABLE "medication_prescriptions" ADD CONSTRAINT "medication_prescriptions_feedback_by_id_fkey" FOREIGN KEY ("feedback_by_id") REFERENCES "auths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
