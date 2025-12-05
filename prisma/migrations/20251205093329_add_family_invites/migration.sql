/*
  Warnings:

  - You are about to drop the `health_records` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[lineUserId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `family_members` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."health_records" DROP CONSTRAINT "health_records_userId_fkey";

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "riskFactors" TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authType" TEXT NOT NULL DEFAULT 'line',
ADD COLUMN     "lineConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lineUserId" TEXT,
ADD COLUMN     "password" TEXT;

-- DropTable
DROP TABLE "public"."health_records";

-- CreateTable
CREATE TABLE "healthRecords" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "bloodPressureSystolic" INTEGER NOT NULL,
    "bloodPressureDiastolic" INTEGER NOT NULL,
    "pulse" INTEGER,
    "weight" DOUBLE PRECISION,
    "exercise" JSONB,
    "meal" JSONB,
    "dailyLife" TEXT,
    "medicationTaken" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "healthRecords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_invites" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "family_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_lineUserId_key" ON "users"("lineUserId");

-- AddForeignKey
ALTER TABLE "healthRecords" ADD CONSTRAINT "healthRecords_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_invites" ADD CONSTRAINT "family_invites_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
