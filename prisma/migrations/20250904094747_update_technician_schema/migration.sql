-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'TECHNICIAN';

-- DropForeignKey
ALTER TABLE "work_sessions" DROP CONSTRAINT "work_sessions_doctorId_fkey";

-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "doctorId" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3),
ADD COLUMN     "technicianId" TEXT;

-- AlterTable
ALTER TABLE "work_sessions" ADD COLUMN     "technicianId" TEXT,
ALTER COLUMN "doctorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "technicians" (
    "id" TEXT NOT NULL,
    "technician_code" TEXT NOT NULL,
    "auth_id" TEXT NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "technicians_technician_code_key" ON "technicians"("technician_code");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_auth_id_key" ON "technicians"("auth_id");

-- AddForeignKey
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_services" ADD CONSTRAINT "prescription_services_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;
