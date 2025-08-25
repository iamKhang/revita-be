/*
  Warnings:

  - You are about to drop the `WorkSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_boothId_fkey";

-- DropForeignKey
ALTER TABLE "WorkSession" DROP CONSTRAINT "WorkSession_doctorId_fkey";

-- DropTable
DROP TABLE "WorkSession";

-- CreateTable
CREATE TABLE "work_sessions" (
    "id" TEXT NOT NULL,
    "boothId" TEXT,
    "doctorId" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "next_available_at" TIMESTAMP(3),

    CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "Booth"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
