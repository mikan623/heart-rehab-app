-- Medical invites: provider (medical) invites patient; patient accepts to allow access

CREATE TABLE "medical_invites" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "medical_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_invites_providerId_patientId_key" ON "medical_invites"("providerId","patientId");

ALTER TABLE "medical_invites"
ADD CONSTRAINT "medical_invites_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_invites"
ADD CONSTRAINT "medical_invites_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


