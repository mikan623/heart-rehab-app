/*
  Warnings:

  - You are about to drop the `healthRecords` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."healthRecords" DROP CONSTRAINT "healthRecords_userId_fkey";

-- DropTable
DROP TABLE "public"."healthRecords";

-- CreateTable
CREATE TABLE "health_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "blood_pressure_systolic" INTEGER NOT NULL,
    "blood_pressure_diastolic" INTEGER NOT NULL,
    "pulse" INTEGER,
    "weight" DOUBLE PRECISION,
    "exercise" JSONB,
    "meal" JSONB,
    "daily_life" TEXT,
    "medication_taken" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "health_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "health_records" ADD CONSTRAINT "health_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
