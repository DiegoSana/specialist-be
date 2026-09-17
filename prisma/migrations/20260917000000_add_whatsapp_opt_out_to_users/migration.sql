-- Add whatsappOptedOut / whatsappOptedOutAt columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsappOptedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsappOptedOutAt" TIMESTAMP(3);
