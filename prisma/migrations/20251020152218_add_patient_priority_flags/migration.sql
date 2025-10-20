-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "rating" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "patient_profiles" ADD COLUMN     "is_disabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pregnant" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "doctor_ratings" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doctor_ratings_doctor_id_idx" ON "doctor_ratings"("doctor_id");

-- CreateIndex
CREATE INDEX "doctor_ratings_patient_id_idx" ON "doctor_ratings"("patient_id");

-- CreateIndex
CREATE INDEX "doctor_ratings_rating_idx" ON "doctor_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_ratings_doctor_id_patient_id_key" ON "doctor_ratings"("doctor_id", "patient_id");

-- AddForeignKey
ALTER TABLE "doctor_ratings" ADD CONSTRAINT "doctor_ratings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_ratings" ADD CONSTRAINT "doctor_ratings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
