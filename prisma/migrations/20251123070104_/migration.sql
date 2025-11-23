/*
  Warnings:

  - A unique constraint covering the columns `[invoiceId,prescription_service_id]` on the table `invoice_details` will be added. If there are existing duplicate values, this will fail.
  - The required column `id` was added to the `invoice_details` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `id` was added to the `prescription_services` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "invoice_details_invoiceId_serviceId_key";

-- AlterTable
ALTER TABLE "invoice_details" ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "prescription_service_id" TEXT,
ADD CONSTRAINT "invoice_details_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "prescription_services" ADD COLUMN     "id" TEXT NOT NULL,
ADD CONSTRAINT "prescription_services_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_details_invoiceId_prescription_service_id_key" ON "invoice_details"("invoiceId", "prescription_service_id");

-- AddForeignKey
ALTER TABLE "invoice_details" ADD CONSTRAINT "invoice_details_prescription_service_id_fkey" FOREIGN KEY ("prescription_service_id") REFERENCES "prescription_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
