-- CreateTable
CREATE TABLE "counters" (
    "id" TEXT NOT NULL,
    "counter_code" TEXT NOT NULL,
    "counter_name" TEXT NOT NULL,
    "location" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_queue" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "receptionist_id" TEXT,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_queue_items" (
    "id" TEXT NOT NULL,
    "counter_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "priority_score" INTEGER NOT NULL,
    "estimated_wait_time" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'WAITING',

    CONSTRAINT "counter_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_assignments" (
    "id" TEXT NOT NULL,
    "counter_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "priority_score" INTEGER NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "counter_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "counters_counter_code_key" ON "counters"("counter_code");

-- AddForeignKey
ALTER TABLE "counters" ADD CONSTRAINT "counters_receptionist_id_fkey" FOREIGN KEY ("receptionist_id") REFERENCES "receptionists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_queue_items" ADD CONSTRAINT "counter_queue_items_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_queue_items" ADD CONSTRAINT "counter_queue_items_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_assignments" ADD CONSTRAINT "counter_assignments_counter_id_fkey" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_assignments" ADD CONSTRAINT "counter_assignments_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
