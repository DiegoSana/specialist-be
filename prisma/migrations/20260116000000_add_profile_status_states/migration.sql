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

-- NOTE: Data migration for existing VERIFIED records should be done
-- in a separate migration after the enum values are committed.
-- For fresh installs, this is not needed as the seed data will use 
-- the correct status values.
