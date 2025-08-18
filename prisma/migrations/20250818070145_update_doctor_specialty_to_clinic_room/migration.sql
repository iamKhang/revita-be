/*
  Warnings:

  - You are about to drop the column `specialty_id` on the `services` table. All the data in the column will be lost.
  - You are about to drop the `doctor_specialties` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "doctor_specialties" DROP CONSTRAINT "doctor_specialties_doctor_id_fkey";

-- DropForeignKey
ALTER TABLE "doctor_specialties" DROP CONSTRAINT "doctor_specialties_specialty_id_fkey";

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_specialty_id_fkey";

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "clinic_room_id" TEXT;

-- AlterTable
ALTER TABLE "services" DROP COLUMN "specialty_id";

-- DropTable
DROP TABLE "doctor_specialties";

-- CreateTable
CREATE TABLE "clinic_rooms" (
    "id" TEXT NOT NULL,
    "room_code" TEXT NOT NULL,
    "room_name" TEXT NOT NULL,
    "specialty_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_room_services" (
    "clinic_room_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "clinic_rooms_room_code_key" ON "clinic_rooms"("room_code");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_rooms_doctor_id_key" ON "clinic_rooms"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_room_services_clinic_room_id_service_id_key" ON "clinic_room_services"("clinic_room_id", "service_id");

-- AddForeignKey
ALTER TABLE "clinic_rooms" ADD CONSTRAINT "clinic_rooms_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_rooms" ADD CONSTRAINT "clinic_rooms_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_room_services" ADD CONSTRAINT "clinic_room_services_clinic_room_id_fkey" FOREIGN KEY ("clinic_room_id") REFERENCES "clinic_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinic_room_services" ADD CONSTRAINT "clinic_room_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinic_room_id_fkey" FOREIGN KEY ("clinic_room_id") REFERENCES "clinic_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
