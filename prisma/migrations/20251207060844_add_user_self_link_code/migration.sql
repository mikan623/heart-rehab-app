/*
  Warnings:

  - A unique constraint covering the columns `[selfLinkCode]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "selfLinkCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_selfLinkCode_key" ON "users"("selfLinkCode");
