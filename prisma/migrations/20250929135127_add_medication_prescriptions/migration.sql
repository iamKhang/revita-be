-- CreateTable
CREATE TABLE "medication_prescriptions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_profile_id" TEXT NOT NULL,
    "medical_record_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_prescription_items" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ndc" TEXT,
    "strength" TEXT,
    "dosage_form" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "instructions" TEXT,
    "source" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medication_prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medication_prescriptions_code_key" ON "medication_prescriptions"("code");

-- AddForeignKey
ALTER TABLE "medication_prescriptions" ADD CONSTRAINT "medication_prescriptions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_prescriptions" ADD CONSTRAINT "medication_prescriptions_patient_profile_id_fkey" FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_prescriptions" ADD CONSTRAINT "medication_prescriptions_medical_record_id_fkey" FOREIGN KEY ("medical_record_id") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_prescription_items" ADD CONSTRAINT "medication_prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "medication_prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
