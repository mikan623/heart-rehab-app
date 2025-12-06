/*
  Warnings:

  - A unique constraint covering the columns `[userId,email]` on the table `family_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,lineUserId]` on the table `family_members` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_email_key" ON "family_members"("userId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_lineUserId_key" ON "family_members"("userId", "lineUserId");
