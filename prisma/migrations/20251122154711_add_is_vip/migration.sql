/*
  Warnings:

  - You are about to drop the column `is_pure_service` on the `counter_assignments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "counter_assignments" DROP COLUMN "is_pure_service",
ADD COLUMN     "is_vip" BOOLEAN;
