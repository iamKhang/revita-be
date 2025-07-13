/*
  Warnings:

  - You are about to drop the `doctor_schedules` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "doctor_schedules" DROP CONSTRAINT "doctor_schedules_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "doctor_schedules" DROP CONSTRAINT "doctor_schedules_doctor_id_fkey";

-- DropTable
DROP TABLE "doctor_schedules";

-- CreateTable
CREATE TABLE "monthly_schedule_submissions" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "rejected_reason" TEXT,

    CONSTRAINT "monthly_schedule_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_working_days" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "working_date" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_working_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "working_sessions" (
    "id" TEXT NOT NULL,
    "working_day_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "session_type" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "working_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_schedule_submissions_doctor_id_month_year_key" ON "monthly_schedule_submissions"("doctor_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_working_days_doctor_id_working_date_key" ON "doctor_working_days"("doctor_id", "working_date");

-- AddForeignKey
ALTER TABLE "monthly_schedule_submissions" ADD CONSTRAINT "monthly_schedule_submissions_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_schedule_submissions" ADD CONSTRAINT "monthly_schedule_submissions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "clinic_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_working_days" ADD CONSTRAINT "doctor_working_days_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_working_days" ADD CONSTRAINT "doctor_working_days_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "monthly_schedule_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "working_sessions" ADD CONSTRAINT "working_sessions_working_day_id_fkey" FOREIGN KEY ("working_day_id") REFERENCES "doctor_working_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
