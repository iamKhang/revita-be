-- CreateTable
CREATE TABLE "booth_services" (
    "boothId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "booth_services_boothId_serviceId_key" ON "booth_services"("boothId", "serviceId");

-- AddForeignKey
ALTER TABLE "booth_services" ADD CONSTRAINT "booth_services_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_services" ADD CONSTRAINT "booth_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
