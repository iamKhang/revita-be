/*
  Warnings:

  - Added the required column `updatedAt` to the `work_sessions` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WorkSessionStatus" AS ENUM ('PENDING', 'APPROVED', 'IN_PROGRESS', 'CANCELED', 'COMPLETED');

-- AlterTable
ALTER TABLE "work_sessions" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "WorkSessionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "work_session_services" (
    "workSessionId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "work_session_services_workSessionId_serviceId_key" ON "work_session_services"("workSessionId", "serviceId");

-- AddForeignKey
ALTER TABLE "work_session_services" ADD CONSTRAINT "work_session_services_workSessionId_fkey" FOREIGN KEY ("workSessionId") REFERENCES "work_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_session_services" ADD CONSTRAINT "work_session_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
