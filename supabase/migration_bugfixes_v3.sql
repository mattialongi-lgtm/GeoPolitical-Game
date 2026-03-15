-- ============================================
-- Migration: Bugfixes V3
-- Description: Ensures all factory columns exist,
--              fixes lastLogin for activity tracking,
--              adds missing columns for factory creation
-- Run AFTER: full_schema.sql or migration_factories_v2.sql
-- ============================================

-- 1. Ensure all factory columns exist (fixes "currentStorage not found in schema cache" error)
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "currentStorage" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalWorkerCount" INT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalProduction" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalOwnerProfit" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalTaxesPaid" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "listedForSale" BOOLEAN DEFAULT false;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "salePrice" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "energyCost" INT DEFAULT 10;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payoutMoney" BIGINT DEFAULT 50;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "minLevel" INT DEFAULT 1;

-- 2. Ensure user_factory_cooldowns table exists
CREATE TABLE IF NOT EXISTS user_factory_cooldowns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES users(id),
    "factoryId" UUID REFERENCES factories(id),
    "lastUsed" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("userId", "factoryId")
);

-- 3. Ensure lastLogin column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS "lastLogin" BIGINT DEFAULT 0;

-- 4. Update lastLogin for all users who have never had it set
UPDATE users SET "lastLogin" = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE "lastLogin" IS NULL OR "lastLogin" = 0;

-- 5. Ensure dictatorship column exists in regions table
ALTER TABLE regions ADD COLUMN IF NOT EXISTS dictatorship INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "governmentForm" TEXT DEFAULT 'PRESIDENTIAL_REPUBLIC';
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "leaderTitle" TEXT DEFAULT 'Presidente';

-- 6. Ensure nations table updatedAt is BIGINT type (it should already be)
-- If updatedAt was incorrectly stored as a string, fix existing data
UPDATE nations SET "updatedAt" = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE "updatedAt" IS NULL;
