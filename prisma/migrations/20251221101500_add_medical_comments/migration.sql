-- Medical comments: provider (medical) can comment on a patient's health record

CREATE TABLE "medical_comments" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "healthRecordId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_comments_patientId_createdAt_idx" ON "medical_comments"("patientId", "createdAt");
CREATE INDEX "medical_comments_providerId_createdAt_idx" ON "medical_comments"("providerId", "createdAt");

ALTER TABLE "medical_comments"
ADD CONSTRAINT "medical_comments_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_comments"
ADD CONSTRAINT "medical_comments_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_comments"
ADD CONSTRAINT "medical_comments_healthRecordId_fkey"
FOREIGN KEY ("healthRecordId") REFERENCES "health_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;


