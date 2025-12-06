/*
  Warnings:

  - A unique constraint covering the columns `[userId,linkCode]` on the table `family_members` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "linkCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_linkCode_key" ON "family_members"("userId", "linkCode");
