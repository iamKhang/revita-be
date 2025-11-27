-- AlterTable
ALTER TABLE "invoice_details" ADD COLUMN     "discount_amount" DOUBLE PRECISION,
ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "original_price" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discount_reason" TEXT,
ADD COLUMN     "original_total_amount" DOUBLE PRECISION,
ADD COLUMN     "total_discount_amount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "service_promotions" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "allow_loyalty_discount" BOOLEAN NOT NULL DEFAULT true,
    "max_discount_percent" DOUBLE PRECISION,
    "max_discount_amount" DOUBLE PRECISION,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_promotions_service_id_key" ON "service_promotions"("service_id");

-- AddForeignKey
ALTER TABLE "service_promotions" ADD CONSTRAINT "service_promotions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
