-- Medical lab comments: provider comments on blood test / CPX entries

CREATE TABLE "medical_lab_comments" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "bloodDataId" TEXT,
  "cpxTestId" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_lab_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "medical_lab_comments_patientId_createdAt_idx" ON "medical_lab_comments"("patientId", "createdAt");
CREATE INDEX "medical_lab_comments_providerId_createdAt_idx" ON "medical_lab_comments"("providerId", "createdAt");

ALTER TABLE "medical_lab_comments"
ADD CONSTRAINT "medical_lab_comments_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_lab_comments"
ADD CONSTRAINT "medical_lab_comments_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_lab_comments"
ADD CONSTRAINT "medical_lab_comments_bloodDataId_fkey"
FOREIGN KEY ("bloodDataId") REFERENCES "blood_data"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_lab_comments"
ADD CONSTRAINT "medical_lab_comments_cpxTestId_fkey"
FOREIGN KEY ("cpxTestId") REFERENCES "cardiopulmonary_exercise_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


