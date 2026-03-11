-- ==========================================
-- FULL DATABASE RESET & SCHEMA (Supabase)
-- WARNING: This will DROP existing tables!
-- ==========================================

-- 1. DROP EXISTING TABLES (Destructive Reset)
DROP TABLE IF EXISTS budget_transactions CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS perks CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS wars CASCADE;
DROP TABLE IF EXISTS cooldowns CASCADE;
DROP TABLE IF EXISTS user_inventory CASCADE;
DROP TABLE IF EXISTS nations CASCADE;
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS party_members CASCADE;
DROP TABLE IF EXISTS elections CASCADE;
DROP TABLE IF EXISTS election_votes CASCADE;
DROP TABLE IF EXISTS parliament_members CASCADE;
DROP TABLE IF EXISTS laws CASCADE;
DROP TABLE IF EXISTS law_votes CASCADE;
DROP TABLE IF EXISTS sanctions CASCADE;
DROP TABLE IF EXISTS market_offers CASCADE;
DROP TABLE IF EXISTS user_factory_cooldowns CASCADE;
DROP TABLE IF EXISTS factories CASCADE;
DROP TABLE IF EXISTS leader_candidates CASCADE;
DROP TABLE IF EXISTS leader_votes CASCADE;
DROP TABLE IF EXISTS migration_agreements CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS leader_orders CASCADE;
DROP TABLE IF EXISTS market_transactions_log CASCADE;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. TABLES

-- USERS
CREATE TABLE users (
    id UUID PRIMARY KEY, -- Matches Supabase Auth ID
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    money BIGINT DEFAULT 5000,
    gold BIGINT DEFAULT 50,
    energy INT DEFAULT 100,
    influence BIGINT DEFAULT 0,
    "regionId" TEXT DEFAULT 'IT-RM',
    "residenceId" TEXT DEFAULT 'IT-RM',
    "workPermitId" TEXT,
    "originalNation" TEXT DEFAULT 'IT',
    "displayedNation" TEXT DEFAULT 'IT',
    "lastOriginalNationChange" BIGINT DEFAULT 0,
    "lastEnergyUpdate" BIGINT,
    xp BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    "perkPoints" INT DEFAULT 0,
    "avatarData" TEXT,
    "energyDrinks" INT DEFAULT 0,
    "lastEnergyDrink" BIGINT DEFAULT 0,
    "warMedals" INT DEFAULT 0,
    "lastMedalClaim" BIGINT DEFAULT 0,
    "lastLogin" BIGINT DEFAULT 0,
    "perkUpgradesJson" TEXT DEFAULT '{}',
    "boostersJson" TEXT DEFAULT '{}',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" BIGINT
);

-- REGIONS
CREATE TABLE regions (
    id TEXT PRIMARY KEY, -- ISO Code (e.g., 'IT', 'US')
    name TEXT UNIQUE,
    population BIGINT DEFAULT 1000000,
    stability INT DEFAULT 100,
    treasury BIGINT DEFAULT 0,
    "economyLevel" INT DEFAULT 1,
    health INT DEFAULT 1,
    education INT DEFAULT 1,
    military INT DEFAULT 1,
    "ownerUserId" UUID REFERENCES users(id),
    "leaderUserId" UUID REFERENCES users(id),
    "stateColor" TEXT DEFAULT '#334155',
    "stateHymn" TEXT,
    "factoriesCount" INT DEFAULT 0,
    "workRestrictions" INT DEFAULT 0, -- 0 or 1
    "residencePolicy" TEXT DEFAULT 'open',
    "governmentForm" TEXT DEFAULT 'PARLIAMENTARY_REPUBLIC',
    "economicAdviserId" UUID REFERENCES users(id),
    "foreignMinisterId" UUID REFERENCES users(id),
    "nation_id" TEXT REFERENCES nations(id),
    "updatedAt" BIGINT
);

-- BUDGETS
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerType" TEXT, -- 'REGION', 'AUTONOMY', 'STATE'
    "ownerId" TEXT, -- ISO code for Region
    "moneyEUR" BIGINT DEFAULT 0,
    resources JSONB DEFAULT '{}'::jsonb,
    "updatedAt" BIGINT
);

-- BUDGET TRANSACTIONS
CREATE TABLE budget_transactions (
    id TEXT PRIMARY KEY,
    "budgetId" UUID REFERENCES budgets(id) ON DELETE CASCADE,
    type TEXT, 
    subtype TEXT,
    "moneyDelta" BIGINT DEFAULT 0,
    "resourcesDelta" JSONB DEFAULT '{}'::jsonb,
    "createdAt" BIGINT,
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- FACTORIES
CREATE TABLE factories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    type TEXT,
    "regionId" TEXT REFERENCES regions(id),
    "ownerUserId" UUID REFERENCES users(id),
    wage BIGINT DEFAULT 50,
    budget BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    "cooldownSec" INT DEFAULT 600,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- USER FACTORY COOLDOWNS
CREATE TABLE user_factory_cooldowns (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "factoryId" UUID REFERENCES factories(id) ON DELETE CASCADE,
    "lastUsed" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("userId", "factoryId")
);

-- MARKET OFFERS
CREATE TABLE market_offers (
    id TEXT PRIMARY KEY,
    "sellerId" UUID REFERENCES users(id),
    "sellerName" TEXT,
    "itemId" TEXT,
    quantity INT,
    price BIGINT,
    "regionId" TEXT REFERENCES regions(id),
    "taxRate" INT DEFAULT 10,
    "originStateId" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- COOLDOWNS
CREATE TABLE cooldowns (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, action_type)
);

-- APPLICATIONS
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    "userId" UUID REFERENCES users(id),
    username TEXT,
    "regionId" TEXT REFERENCES regions(id),
    type TEXT,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- WARS
CREATE TABLE wars (
    id TEXT PRIMARY KEY,
    "attackerCountryIso2" TEXT,
    "defenderCountryIso2" TEXT,
    "attackerUserId" UUID REFERENCES users(id),
    "defenderUserId" UUID REFERENCES users(id),
    status TEXT,
    "startedAt" TIMESTAMPTZ DEFAULT NOW(),
    "endsAt" TIMESTAMPTZ DEFAULT NOW(),
    "attackerScore" BIGINT DEFAULT 0,
    "defenderScore" BIGINT DEFAULT 0
);

-- NATIONS
CREATE TABLE nations (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo TEXT DEFAULT '🏳️',
    "leaderUserId" UUID REFERENCES users(id),
    "updatedAt" BIGINT
);

-- LEADER ORDERS
CREATE TABLE leader_orders (
    id SERIAL PRIMARY KEY,
    "regionId" TEXT REFERENCES regions(id),
    "leaderId" UUID REFERENCES users(id),
    title TEXT,
    content TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- MIGRATION AGREEMENTS
CREATE TABLE migration_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "fromStateId" TEXT REFERENCES regions(id),
    "toStateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- PERKS (livelli perk per utente)
CREATE TABLE perks (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "perkId" TEXT NOT NULL,
    level INT DEFAULT 0,
    PRIMARY KEY ("userId", "perkId")
);

-- CHAT MESSAGES (chat globale)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    "regionId" TEXT,
    message TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ARTICLES (giornale)
CREATE TABLE articles (
    id TEXT PRIMARY KEY,
    "authorId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "authorName" TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RPC FUNCTIONS (Crucial for atomicity)

CREATE OR REPLACE FUNCTION add_budget_transaction(
  p_owner_type TEXT,
  p_owner_id TEXT,
  p_type TEXT,
  p_subtype TEXT,
  p_money_delta BIGINT,
  p_resources_delta JSONB DEFAULT '{}'::jsonb,
  p_created_by UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS TEXT AS $$
DECLARE
  v_budget_id UUID;
  v_current_money BIGINT;
  v_current_resources JSONB;
  v_new_resources JSONB;
  v_res_key TEXT;
  v_res_val INT;
  v_tx_id TEXT;
BEGIN
  -- 1. Get Budget
  SELECT id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources
  FROM budgets
  WHERE "ownerType" = p_owner_type AND "ownerId" = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget non trovato per % %', p_owner_type, p_owner_id;
  END IF;

  -- 2. Check Money
  IF v_current_money + p_money_delta < 0 THEN
    RAISE EXCEPTION 'Fondi insufficienti';
  END IF;

  -- 3. Update Resources
  v_new_resources = v_current_resources;
  FOR v_res_key, v_res_val IN SELECT * FROM jsonb_each_text(p_resources_delta)
  LOOP
    v_new_resources = jsonb_set(
      v_new_resources, 
      ARRAY[v_res_key], 
      to_jsonb(COALESCE((v_new_resources->>v_res_key)::int, 0) + v_res_val::int)
    );
    IF (v_new_resources->>v_res_key)::int < 0 THEN
      RAISE EXCEPTION 'Risorse insufficienti: %', v_res_key;
    END IF;
  END LOOP;

  -- 4. Apply Updates
  UPDATE budgets 
  SET "moneyEUR" = "moneyEUR" + p_money_delta, 
      resources = v_new_resources, 
      "updatedAt" = EXTRACT(EPOCH FROM NOW()) * 1000
  WHERE id = v_budget_id;

  -- 5. Log Transaction
  v_tx_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO budget_transactions (
    id, "budgetId", type, subtype, "moneyDelta", "resourcesDelta", "createdAt", "createdByUserId", metadata
  ) VALUES (
    v_tx_id, v_budget_id, p_type, p_subtype, p_money_delta, p_resources_delta, 
    EXTRACT(EPOCH FROM NOW()) * 1000, p_created_by, p_metadata
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_work_action(
  p_user_id UUID,
  p_factory_id UUID,
  p_energy_cost INT,
  p_net_earnings BIGINT,
  p_taxes BIGINT,
  p_region_id TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Deduct Energy and Add Money
  UPDATE users 
  SET energy = energy - p_energy_cost,
      money = money + p_net_earnings
  WHERE id = p_user_id;

  -- 2. Update Cooldown
  INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";

  -- 3. Apply Taxes if any
  IF p_taxes > 0 THEN
    PERFORM add_budget_transaction(
      'REGION', p_region_id,
      'INCOME', 'TAX',
      p_taxes, '{}'::jsonb,
      p_user_id,
      jsonb_build_object('factoryId', p_factory_id)
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id UUID,
  p_amount INT
) RETURNS VOID AS $$
DECLARE
  v_current_xp INT;
  v_current_level INT;
  v_next_level_xp INT;
BEGIN
  UPDATE users 
  SET xp = xp + p_amount
  WHERE id = p_user_id
  RETURNING xp, level INTO v_current_xp, v_current_level;

  v_next_level_xp := v_current_level * 1000;
  IF v_current_xp >= v_next_level_xp THEN
    UPDATE users SET level = level + 1 WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. SEED DATA
INSERT INTO regions (id, name, population, stability, health, education, military)
VALUES ('IT-RM', 'Rome', 2800000, 100, 10, 10, 10)
ON CONFLICT (id) DO NOTHING;

-- Initial budget for Rome
INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR")
VALUES ('REGION', 'IT-RM', 1000000)
ON CONFLICT DO NOTHING;

-- 6. RLS POLICIES
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Regions are viewable by everyone" ON regions FOR SELECT USING (true);
CREATE POLICY "Budgets are viewable by everyone" ON budgets FOR SELECT USING (true);
