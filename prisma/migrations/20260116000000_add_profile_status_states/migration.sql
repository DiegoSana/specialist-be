-- Add new states to CompanyStatus enum
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TYPE "CompanyStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- Add new states to ProfessionalStatus enum
ALTER TYPE "ProfessionalStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "ProfessionalStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TYPE "ProfessionalStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- Add unique constraint to taxId (CUIT) if not exists
-- Note: This allows multiple NULLs but ensures unique non-null values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'companies_taxId_key'
    ) THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_taxId_key" UNIQUE ("taxId");
    END IF;
END $$;

-- Migrate existing VERIFIED companies to ACTIVE (they can operate)
-- VERIFIED will now mean ACTIVE + special badge
UPDATE "companies" 
SET "status" = 'ACTIVE' 
WHERE "status" = 'VERIFIED';

-- Migrate existing VERIFIED professionals to ACTIVE
UPDATE "professionals" 
SET "status" = 'ACTIVE' 
WHERE "status" = 'VERIFIED';

