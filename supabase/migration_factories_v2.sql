-- ============================================================
-- FACTORY SYSTEM V2 - Complete Factory Economy Migration
-- ============================================================
-- This migration extends the existing factory system with:
-- 1. New columns on factories table (storage, economy tracking, marketplace)
-- 2. Factory market listings table (buy/sell factories)
-- 3. Factory economy logs table (daily income/tax/profit tracking)
-- 4. Factory worker logs table (individual work action tracking)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Extend factories table with new columns ──────────────

ALTER TABLE factories ADD COLUMN IF NOT EXISTS "currentStorage" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalWorkerCount" INT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalProduction" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalOwnerProfit" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "totalTaxesPaid" BIGINT DEFAULT 0;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "listedForSale" BOOLEAN DEFAULT FALSE;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "salePrice" BIGINT DEFAULT 0;

-- ── 2. Factory market listings table ──────────────────────

CREATE TABLE IF NOT EXISTS factory_market_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "sellerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "askingPrice" BIGINT NOT NULL CHECK ("askingPrice" > 0),
    "listedAt" TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    "buyerId" UUID REFERENCES users(id),
    "soldAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_factory_market_status ON factory_market_listings(status);
CREATE INDEX IF NOT EXISTS idx_factory_market_factory ON factory_market_listings("factoryId");

-- ── 3. Factory economy logs table ──────────────────────────

CREATE TABLE IF NOT EXISTS factory_economy_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "logDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "workerCount" INT DEFAULT 0,
    "grossIncome" BIGINT DEFAULT 0,
    "taxesPaid" BIGINT DEFAULT 0,
    "ownerProfit" BIGINT DEFAULT 0,
    production BIGINT DEFAULT 0,
    UNIQUE("factoryId", "logDate")
);

CREATE INDEX IF NOT EXISTS idx_factory_econ_factory ON factory_economy_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_econ_date ON factory_economy_logs("logDate");

-- ── 4. Factory worker logs table ────────────────────────────

CREATE TABLE IF NOT EXISTS factory_worker_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "workerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "workedAt" TIMESTAMPTZ DEFAULT NOW(),
    "earningsMoney" BIGINT DEFAULT 0,
    "earningsGold" NUMERIC(12,2) DEFAULT 0,
    "resourceType" TEXT,
    "resourceAmount" BIGINT DEFAULT 0,
    "ownerCut" BIGINT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_factory_worker_factory ON factory_worker_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_worker ON factory_worker_logs("workerId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_date ON factory_worker_logs("workedAt");

-- ── 5. RLS Policies ────────────────────────────────────────

ALTER TABLE factory_market_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_economy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_worker_logs ENABLE ROW LEVEL SECURITY;

-- Market listings: everyone can read active, sellers can manage their own
DROP POLICY IF EXISTS "factory_market_read" ON factory_market_listings;
CREATE POLICY "factory_market_read" ON factory_market_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_market_insert" ON factory_market_listings;
CREATE POLICY "factory_market_insert" ON factory_market_listings FOR INSERT WITH CHECK (auth.uid() = "sellerId");

DROP POLICY IF EXISTS "factory_market_update" ON factory_market_listings;
CREATE POLICY "factory_market_update" ON factory_market_listings FOR UPDATE USING (auth.uid() = "sellerId" OR auth.uid() = "buyerId");

-- Economy logs: everyone can read, system manages writes
DROP POLICY IF EXISTS "factory_econ_read" ON factory_economy_logs;
CREATE POLICY "factory_econ_read" ON factory_economy_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_econ_write" ON factory_economy_logs;
CREATE POLICY "factory_econ_write" ON factory_economy_logs FOR ALL USING (true);

-- Worker logs: everyone can read, system manages writes
DROP POLICY IF EXISTS "factory_worker_read" ON factory_worker_logs;
CREATE POLICY "factory_worker_read" ON factory_worker_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "factory_worker_write" ON factory_worker_logs;
CREATE POLICY "factory_worker_write" ON factory_worker_logs FOR ALL USING (true);

-- ── 6. Upsert helper for daily economy logs ──────────────────

CREATE OR REPLACE FUNCTION upsert_factory_economy_log(
    p_factory_id UUID,
    p_gross_income BIGINT,
    p_taxes_paid BIGINT,
    p_owner_profit BIGINT,
    p_production BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO factory_economy_logs ("factoryId", "logDate", "workerCount", "grossIncome", "taxesPaid", "ownerProfit", production)
    VALUES (p_factory_id, CURRENT_DATE, 1, p_gross_income, p_taxes_paid, p_owner_profit, p_production)
    ON CONFLICT ("factoryId", "logDate") DO UPDATE SET
        "workerCount" = factory_economy_logs."workerCount" + 1,
        "grossIncome" = factory_economy_logs."grossIncome" + p_gross_income,
        "taxesPaid" = factory_economy_logs."taxesPaid" + p_taxes_paid,
        "ownerProfit" = factory_economy_logs."ownerProfit" + p_owner_profit,
        production = factory_economy_logs.production + p_production;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Transfer factory ownership RPC ──────────────────────

CREATE OR REPLACE FUNCTION transfer_factory_ownership(
    p_factory_id UUID,
    p_seller_id UUID,
    p_buyer_id UUID,
    p_price BIGINT,
    p_listing_id UUID
) RETURNS JSON AS $$
DECLARE
    v_factory RECORD;
    v_buyer RECORD;
BEGIN
    -- Lock factory
    SELECT * INTO v_factory FROM factories WHERE id = p_factory_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Fabbrica non trovata'); END IF;
    IF v_factory."ownerUserId" != p_seller_id THEN RETURN json_build_object('error', 'Venditore non è il proprietario'); END IF;

    -- Lock buyer
    SELECT * INTO v_buyer FROM users WHERE id = p_buyer_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('error', 'Acquirente non trovato'); END IF;
    IF v_buyer.money < p_price THEN RETURN json_build_object('error', 'Fondi insufficienti'); END IF;

    -- Transfer money: buyer pays, seller receives
    UPDATE users SET money = money - p_price WHERE id = p_buyer_id;
    UPDATE users SET money = money + p_price WHERE id = p_seller_id;

    -- Transfer ownership
    UPDATE factories SET "ownerUserId" = p_buyer_id, "listedForSale" = FALSE, "salePrice" = 0 WHERE id = p_factory_id;

    -- Update listing
    UPDATE factory_market_listings SET status = 'sold', "buyerId" = p_buyer_id, "soldAt" = NOW() WHERE id = p_listing_id;

    RETURN json_build_object('success', true, 'newOwner', p_buyer_id, 'price', p_price);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
