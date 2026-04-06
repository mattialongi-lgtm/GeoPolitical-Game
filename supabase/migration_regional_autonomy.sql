-- ============================================================
-- Migration: Regional Autonomy System
-- Adds autonomy, buildings, energy, indices, taxes, extraction
-- Run this in your Supabase SQL Editor to add regional autonomy
-- ============================================================

-- 0. Ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add autonomy columns to regions table
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isCapital" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isAutonomous" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isBorderRegion" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "governorPlayerId" UUID REFERENCES users(id);
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalParliamentEnabled" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalBudget" BIGINT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "nationalProfitSharePercent" INT DEFAULT 100;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalProfitSharePercent" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "workerTaxPercent" INT DEFAULT 10;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "industryTaxPercent" INT DEFAULT 10;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "healthIndex" FLOAT DEFAULT 1;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "militaryIndex" FLOAT DEFAULT 1;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "educationIndex" FLOAT DEFAULT 1;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "developmentIndex" FLOAT DEFAULT 1;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "pollution" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyGeneration" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyConsumption" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "energyEfficiency" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitGold" INT DEFAULT 1250;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitOil" INT DEFAULT 300;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitMinerals" INT DEFAULT 300;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitUranium" INT DEFAULT 45;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitDiamonds" INT DEFAULT 60;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedGold" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedOil" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedMinerals" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedUranium" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractedDiamonds" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "nextExtractionResetAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "autonomyGrantedAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "autonomyRevokedAt" TIMESTAMPTZ;

-- 2. Regional buildings table
CREATE TABLE IF NOT EXISTS regional_buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "buildingType" TEXT NOT NULL,
    quantity INT DEFAULT 0,
    level INT DEFAULT 1,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("regionId", "buildingType")
);

-- 3. Regional parliament members table
CREATE TABLE IF NOT EXISTS regional_parliament_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "partyId" UUID,
    "electedAt" TIMESTAMPTZ DEFAULT NOW(),
    "termEndsAt" TIMESTAMPTZ,
    UNIQUE("regionId", "userId")
);

-- 4. Regional laws table (for autonomy-specific proposals)
CREATE TABLE IF NOT EXISTS regional_laws (
    id TEXT PRIMARY KEY,
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "proposerId" UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS regional_law_votes (
    "lawId" TEXT NOT NULL REFERENCES regional_laws(id) ON DELETE CASCADE,
    "voterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("lawId", "voterId")
);

-- 5. Regional budget transactions
CREATE TABLE IF NOT EXISTS regional_budget_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    subtype TEXT,
    "moneyDelta" BIGINT DEFAULT 0,
    description TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. Autonomy history log
CREATE TABLE IF NOT EXISTS autonomy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    "performedByUserId" UUID REFERENCES users(id),
    details JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_regional_buildings_region ON regional_buildings("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_parliament_region ON regional_parliament_members("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_laws_region ON regional_laws("regionId");
CREATE INDEX IF NOT EXISTS idx_regional_laws_status ON regional_laws(status);
CREATE INDEX IF NOT EXISTS idx_regional_budget_tx_region ON regional_budget_transactions("regionId");
CREATE INDEX IF NOT EXISTS idx_autonomy_history_region ON autonomy_history("regionId");
CREATE INDEX IF NOT EXISTS idx_regions_autonomous ON regions("isAutonomous") WHERE "isAutonomous" = TRUE;
CREATE INDEX IF NOT EXISTS idx_regions_nation ON regions("nation_id");

-- 8. Row Level Security (RLS) for new tables
ALTER TABLE regional_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_parliament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent — safe to re-run)
-- Uses DROP IF EXISTS + CREATE to handle any prior partial runs
DROP POLICY IF EXISTS "Regional buildings public read" ON regional_buildings;
DROP POLICY IF EXISTS "Regional buildings server manage" ON regional_buildings;
CREATE POLICY "Regional buildings public read" ON regional_buildings FOR SELECT USING (true);
CREATE POLICY "Regional buildings server manage" ON regional_buildings FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional parliament public read" ON regional_parliament_members;
DROP POLICY IF EXISTS "Regional parliament server manage" ON regional_parliament_members;
CREATE POLICY "Regional parliament public read" ON regional_parliament_members FOR SELECT USING (true);
CREATE POLICY "Regional parliament server manage" ON regional_parliament_members FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional laws public read" ON regional_laws;
DROP POLICY IF EXISTS "Regional laws server manage" ON regional_laws;
CREATE POLICY "Regional laws public read" ON regional_laws FOR SELECT USING (true);
CREATE POLICY "Regional laws server manage" ON regional_laws FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional law votes public read" ON regional_law_votes;
DROP POLICY IF EXISTS "Regional law votes server manage" ON regional_law_votes;
CREATE POLICY "Regional law votes public read" ON regional_law_votes FOR SELECT USING (true);
CREATE POLICY "Regional law votes server manage" ON regional_law_votes FOR ALL USING (true);

DROP POLICY IF EXISTS "Regional budget tx public read" ON regional_budget_transactions;
DROP POLICY IF EXISTS "Regional budget tx server manage" ON regional_budget_transactions;
CREATE POLICY "Regional budget tx public read" ON regional_budget_transactions FOR SELECT USING (true);
CREATE POLICY "Regional budget tx server manage" ON regional_budget_transactions FOR ALL USING (true);

DROP POLICY IF EXISTS "Autonomy history public read" ON autonomy_history;
DROP POLICY IF EXISTS "Autonomy history server manage" ON autonomy_history;
CREATE POLICY "Autonomy history public read" ON autonomy_history FOR SELECT USING (true);
CREATE POLICY "Autonomy history server manage" ON autonomy_history FOR ALL USING (true);
