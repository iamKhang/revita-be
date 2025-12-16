-- AlterTable
ALTER TABLE "medication_prescriptions" ADD COLUMN     "feedback_processed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feedback_response_at" TIMESTAMP(3),
ADD COLUMN     "feedback_response_note" TEXT;
