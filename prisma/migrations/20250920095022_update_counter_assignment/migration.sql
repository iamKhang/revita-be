/*
  Warnings:

  - You are about to drop the column `appointment_id` on the `counter_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `patient_name` on the `counter_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `priority_score` on the `counter_assignments` table. All the data in the column will be lost.
  - You are about to drop the `counter_queue_items` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `receptionist_id` to the `counter_assignments` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "counter_assignments" DROP CONSTRAINT "counter_assignments_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "counter_queue_items" DROP CONSTRAINT "counter_queue_items_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "counter_queue_items" DROP CONSTRAINT "counter_queue_items_counter_id_fkey";

-- AlterTable
ALTER TABLE "counter_assignments" DROP COLUMN "appointment_id",
DROP COLUMN "patient_name",
DROP COLUMN "priority_score",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "receptionist_id" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- DropTable
DROP TABLE "counter_queue_items";

-- AddForeignKey
ALTER TABLE "counter_assignments" ADD CONSTRAINT "counter_assignments_receptionist_id_fkey" FOREIGN KEY ("receptionist_id") REFERENCES "receptionists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
