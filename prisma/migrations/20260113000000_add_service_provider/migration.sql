-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('PROFESSIONAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');

-- CreateTable: service_providers
CREATE TABLE "service_providers" (
    "id" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: companies
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceProviderId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "description" TEXT,
    "foundedYear" INTEGER,
    "employeeCount" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Bariloche',
    "zone" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "profileImage" TEXT,
    "gallery" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: company_trades
CREATE TABLE "company_trades" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_trades_pkey" PRIMARY KEY ("id")
);

-- Step 1: Add new columns to professionals (nullable for now)
ALTER TABLE "professionals" ADD COLUMN "serviceProviderId" TEXT;

-- Step 2: Add new columns to requests (nullable for now)
ALTER TABLE "requests" ADD COLUMN "providerId" TEXT;

-- Step 3: Rename column in reviews (professionalId -> serviceProviderId)
-- First add new column
ALTER TABLE "reviews" ADD COLUMN "serviceProviderId" TEXT;

-- Step 4: Create ServiceProvider for each existing Professional
-- and update the professional with the reference
DO $$
DECLARE
    prof RECORD;
    new_sp_id TEXT;
BEGIN
    FOR prof IN SELECT id, "averageRating", "totalReviews" FROM professionals
    LOOP
        new_sp_id := gen_random_uuid()::text;
        
        -- Create ServiceProvider
        INSERT INTO service_providers (id, type, "averageRating", "totalReviews", "createdAt", "updatedAt")
        VALUES (new_sp_id, 'PROFESSIONAL', prof."averageRating", prof."totalReviews", NOW(), NOW());
        
        -- Update Professional with serviceProviderId
        UPDATE professionals SET "serviceProviderId" = new_sp_id WHERE id = prof.id;
    END LOOP;
END $$;

-- Step 5: Migrate Request.professionalId -> Request.providerId
-- First, get the serviceProviderId from the professional
UPDATE requests r
SET "providerId" = p."serviceProviderId"
FROM professionals p
WHERE r."professionalId" = p.id AND r."professionalId" IS NOT NULL;

-- Step 6: Migrate Review.professionalId -> Review.serviceProviderId
UPDATE reviews rv
SET "serviceProviderId" = p."serviceProviderId"
FROM professionals p
WHERE rv."professionalId" = p.id;

-- Step 7: Now make serviceProviderId NOT NULL on professionals
ALTER TABLE "professionals" ALTER COLUMN "serviceProviderId" SET NOT NULL;

-- Step 8: Make Review.serviceProviderId NOT NULL and requestId NOT NULL
-- Note: If there are reviews without requestId, they need to be handled
-- For now, we'll delete orphan reviews (reviews without a request)
DELETE FROM reviews WHERE "requestId" IS NULL;
ALTER TABLE "reviews" ALTER COLUMN "serviceProviderId" SET NOT NULL;
ALTER TABLE "reviews" ALTER COLUMN "requestId" SET NOT NULL;

-- Step 9: Drop old columns
ALTER TABLE "professionals" DROP COLUMN "averageRating";
ALTER TABLE "professionals" DROP COLUMN "totalReviews";
ALTER TABLE "requests" DROP COLUMN "professionalId";
ALTER TABLE "reviews" DROP COLUMN "professionalId";

-- Step 10: Add unique constraints
CREATE UNIQUE INDEX "professionals_serviceProviderId_key" ON "professionals"("serviceProviderId");
CREATE UNIQUE INDEX "companies_userId_key" ON "companies"("userId");
CREATE UNIQUE INDEX "companies_serviceProviderId_key" ON "companies"("serviceProviderId");
CREATE UNIQUE INDEX "company_trades_companyId_tradeId_key" ON "company_trades"("companyId", "tradeId");

-- Step 11: Add foreign keys
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_serviceProviderId_fkey" 
    FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "companies" ADD CONSTRAINT "companies_serviceProviderId_fkey" 
    FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_trades" ADD CONSTRAINT "company_trades_companyId_fkey" 
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_trades" ADD CONSTRAINT "company_trades_tradeId_fkey" 
    FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "requests" ADD CONSTRAINT "requests_providerId_fkey" 
    FOREIGN KEY ("providerId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_serviceProviderId_fkey" 
    FOREIGN KEY ("serviceProviderId") REFERENCES "service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

