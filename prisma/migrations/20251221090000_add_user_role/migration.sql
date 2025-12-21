-- Add role column to users table
-- Default: patient

ALTER TABLE "users"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'patient';


