/*
  Warnings:

  - A unique constraint covering the columns `[cashier_code]` on the table `cashiers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[receptionist_code]` on the table `receptionists` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cashier_code` to the `cashiers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receptionist_code` to the `receptionists` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "cashiers" ADD COLUMN     "cashier_code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "receptionists" ADD COLUMN     "receptionist_code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "cashiers_cashier_code_key" ON "cashiers"("cashier_code");

-- CreateIndex
CREATE UNIQUE INDEX "receptionists_receptionist_code_key" ON "receptionists"("receptionist_code");
