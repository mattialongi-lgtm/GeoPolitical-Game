-- ============================================================
-- MIGRATION: Regional Resources System
-- Features: resource caps, daily extraction, recharge, Deep Exploration
-- ============================================================

-- 1. GAME SETTINGS (centralised config)
CREATE TABLE IF NOT EXISTS game_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO game_settings (key, value, description) VALUES
  ('extraction_k',              '0.02',                                      'Coefficient K for per-work extraction amount'),
  ('recharge_cooldown_seconds', '7200',                                      'Cooldown between recharges in seconds (default 2h)'),
  ('recharge_cost_eur',         '50000',                                     'EUR cost per recharge from country treasury'),
  ('recharge_cost_gold',        '0',                                         'Gold cost per recharge'),
  ('recharge_cost_diamonds',    '0',                                         'Diamond cost per recharge'),
  ('cap_max_global',            '2000',                                      'Hard-limit maximum cap per recharge'),
  ('cap_target_max_recommended','637',                                       'Max recommended target cap for Deep Exploration'),
  ('deep_base_cost_diamonds',   '500',                                       'Base diamond cost to activate Deep Exploration'),
  ('deep_base_cost_eur',        '100000',                                    'Base EUR cost to activate Deep Exploration'),
  ('deep_base_cost_gold',       '0',                                         'Base gold cost to activate Deep Exploration'),
  ('deep_cost_per_delta_diamonds','2',                                       'Diamond cost per unit of sumDelta'),
  ('deep_cost_per_delta_eur',   '500',                                       'EUR cost per unit of sumDelta'),
  ('deep_cost_per_delta_gold',  '0',                                         'Gold cost per unit of sumDelta'),
  ('deep_cost_per_region_diamonds','50',                                     'Diamond cost per region included in Deep'),
  ('deep_cost_per_region_eur',  '10000',                                     'EUR cost per region included in Deep'),
  ('deep_cost_per_region_gold', '0',                                         'Gold cost per region included in Deep'),
  ('deep_duration_days',        '7',                                         'Duration of Deep Exploration in days'),
  ('deep_cost_cap_discount_strength','0',                                    'Discount factor 0..1 based on avg base cap (0 = disabled)'),
  ('daily_available_base',      '{"oil":5000,"minerals":5000,"uranium":2000,"diamonds":1000,"gold_ore":3000}', 'Base daily available per resource type'),
  ('base_cap_defaults',         '{"oil":200,"minerals":200,"uranium":100,"diamonds":50,"gold_ore":150}',       'Default base cap per recharge per resource type'),
  ('work_energy_cost_extract',  '10',                                        'Energy cost per extraction work action')
ON CONFLICT (key) DO NOTHING;

-- 2. DEEP LEVELS
CREATE TABLE IF NOT EXISTS deep_levels (
    level INT PRIMARY KEY,
    "targetCap" INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT
);

INSERT INTO deep_levels (level, "targetCap", enabled, description) VALUES
  (1, 450, true,  'Deep Exploration Livello 1 – targetCap 450'),
  (2, 550, true,  'Deep Exploration Livello 2 – targetCap 550'),
  (3, 637, true,  'Deep Exploration Livello 3 – targetCap 637 (massimo standard)')
ON CONFLICT (level) DO NOTHING;

-- 3. REGION RESOURCES
CREATE TABLE IF NOT EXISTS region_resources (
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "dailyAvailable" INT NOT NULL DEFAULT 5000,
    "dailyExtracted" INT NOT NULL DEFAULT 0,
    "baseCapPerRecharge" INT NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

-- 4. PLAYER EXTRACTION STATE (per player, per region+resource)
CREATE TABLE IF NOT EXISTS player_extraction_state (
    "playerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "extractedSinceLastRecharge" INT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("playerId", "regionId", "resourceType")
);

-- 5. RESOURCE RECHARGES (tracks global recharge per region+resource)
CREATE TABLE IF NOT EXISTS resource_recharges (
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "lastRechargeAt" TIMESTAMPTZ DEFAULT NULL,
    "rechargedByUserId" UUID REFERENCES users(id),
    PRIMARY KEY ("regionId", "resourceType")
);

-- 6. ACTIVE DEEP EXPLORATION LAWS (national, per country/nation)
CREATE TABLE IF NOT EXISTS deep_explorations (
    id TEXT PRIMARY KEY,
    "nationId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    level INT NOT NULL DEFAULT 1,
    "targetCap" INT NOT NULL,
    "activatedByUserId" UUID REFERENCES users(id),
    "startsAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "endsAt" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "costDiamonds" INT DEFAULT 0,
    "costEur" INT DEFAULT 0,
    "costGold" INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RESOURCE EXTRACTION LOG (audit trail)
CREATE TABLE IF NOT EXISTS resource_extraction_logs (
    id BIGSERIAL PRIMARY KEY,
    "playerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    amount INT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_region_resources_region ON region_resources("regionId");
CREATE INDEX IF NOT EXISTS idx_player_extraction_region ON player_extraction_state("regionId", "resourceType");
CREATE INDEX IF NOT EXISTS idx_player_extraction_player ON player_extraction_state("playerId");
CREATE INDEX IF NOT EXISTS idx_deep_explorations_active ON deep_explorations("nationId", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_extraction_logs_player ON resource_extraction_logs("playerId", "createdAt");

-- ============================================================
-- RLS POLICIES (simple: allow read for authenticated, write via service role / RPC)
-- ============================================================

ALTER TABLE game_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_settings_read" ON game_settings FOR SELECT USING (true);

ALTER TABLE deep_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deep_levels_read" ON deep_levels FOR SELECT USING (true);

ALTER TABLE region_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "region_resources_read" ON region_resources FOR SELECT USING (true);

ALTER TABLE player_extraction_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_extraction_state_read" ON player_extraction_state FOR SELECT USING (auth.uid() = "playerId");

ALTER TABLE resource_recharges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resource_recharges_read" ON resource_recharges FOR SELECT USING (true);

ALTER TABLE deep_explorations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deep_explorations_read" ON deep_explorations FOR SELECT USING (true);

ALTER TABLE resource_extraction_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extraction_logs_read" ON resource_extraction_logs FOR SELECT USING (auth.uid() = "playerId");

-- ============================================================
-- END MIGRATION
-- ============================================================
