-- Add phoneVerified and emailVerified columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- For OAuth users (Google/Facebook), mark email as verified by default
-- Note: This assumes OAuth providers have already verified the email
UPDATE "users" 
SET "emailVerified" = true 
WHERE "authProvider" IN ('GOOGLE', 'FACEBOOK') AND "emailVerified" = false;

