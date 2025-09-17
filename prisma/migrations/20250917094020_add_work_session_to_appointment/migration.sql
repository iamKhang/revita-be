/*
  Warnings:

  - You are about to drop the column `clinic_room_id` on the `appointments` table. All the data in the column will be lost.
  - Added the required column `work_session_id` to the `appointments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_clinic_room_id_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "clinic_room_id",
ADD COLUMN     "work_session_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_work_session_id_fkey" FOREIGN KEY ("work_session_id") REFERENCES "work_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
