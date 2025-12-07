-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_time" TEXT;
