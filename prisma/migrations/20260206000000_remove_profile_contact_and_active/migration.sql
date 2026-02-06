-- Remove whatsapp from professionals (contact = user.phone)
ALTER TABLE "professionals" DROP COLUMN IF EXISTS "whatsapp";

-- Data migration: convert active=false into status=INACTIVE for professionals
UPDATE "professionals"
SET status = 'INACTIVE'
WHERE active = false AND status IN ('ACTIVE', 'VERIFIED');

-- Remove active from professionals (use status only: ACTIVE/VERIFIED = can operate)
ALTER TABLE "professionals" DROP COLUMN IF EXISTS "active";

-- Data migration: convert active=false into status=INACTIVE for companies
UPDATE "companies"
SET status = 'INACTIVE'
WHERE active = false AND status IN ('ACTIVE', 'VERIFIED');

-- Remove phone, email, active from companies (contact = user.phone/email; use status only)
ALTER TABLE "companies" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "email";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "active";
