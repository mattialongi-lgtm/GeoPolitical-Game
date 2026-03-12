-- ==========================================
-- FULL DATABASE RESET & SCHEMA (Supabase)
-- WARNING: This will DROP existing tables!
-- Uso: per un database Supabase nuovo, copia/incolla TUTTO
-- questo file nel SQL Editor e premi "Run".
-- Se hai già dati in produzione, usa invece i file
-- migration_*.sql presenti in questa directory per evitare un reset distruttivo.
-- ==========================================

-- 1. DROP EXISTING TABLES (Destructive Reset)
DROP TABLE IF EXISTS market_transactions_log CASCADE;
DROP TABLE IF EXISTS budget_transactions CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS bloc_votes CASCADE;
DROP TABLE IF EXISTS bloc_regulation_proposals CASCADE;
DROP TABLE IF EXISTS bloc_regulations CASCADE;
DROP TABLE IF EXISTS bloc_applications CASCADE;
DROP TABLE IF EXISTS bloc_memberships CASCADE;
DROP TABLE IF EXISTS blocs CASCADE;
DROP TABLE IF EXISTS law_votes CASCADE;
DROP TABLE IF EXISTS laws CASCADE;
DROP TABLE IF EXISTS parliament_members CASCADE;
DROP TABLE IF EXISTS election_votes CASCADE;
DROP TABLE IF EXISTS elections CASCADE;
DROP TABLE IF EXISTS party_primaries CASCADE;
DROP TABLE IF EXISTS party_invites CASCADE;
DROP TABLE IF EXISTS party_logs CASCADE;
DROP TABLE IF EXISTS party_members CASCADE;
DROP TABLE IF EXISTS parties CASCADE;
DROP TABLE IF EXISTS production_queue CASCADE;
DROP TABLE IF EXISTS ministers CASCADE;
DROP TABLE IF EXISTS sanctions CASCADE;
DROP TABLE IF EXISTS work_permits CASCADE;
DROP TABLE IF EXISTS leader_votes CASCADE;
DROP TABLE IF EXISTS leader_candidates CASCADE;
DROP TABLE IF EXISTS user_factory_cooldowns CASCADE;
DROP TABLE IF EXISTS factories CASCADE;
DROP TABLE IF EXISTS user_inventory CASCADE;
DROP TABLE IF EXISTS market_offers CASCADE;
DROP TABLE IF EXISTS cooldowns CASCADE;
DROP TABLE IF EXISTS migration_agreements CASCADE;
DROP TABLE IF EXISTS leader_orders CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS wars CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS perks CASCADE;
DROP TABLE IF EXISTS regions CASCADE;
DROP TABLE IF EXISTS nations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

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
    "travelingTo" TEXT DEFAULT NULL,
    "travelingUntil" BIGINT DEFAULT NULL,
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
    "leaderTitle" TEXT DEFAULT 'Leader',
    "nextLeaderElectionAt" TIMESTAMPTZ,
    "dictatorshipAttempts" INT DEFAULT 0,
    "dictatorship" INT DEFAULT 0,
    "oilBonus" FLOAT DEFAULT 1.0,
    "mineralsBonus" FLOAT DEFAULT 1.0,
    "uraniumBonus" FLOAT DEFAULT 1.0,
    "diamondsBonus" FLOAT DEFAULT 1.0,
    "marketTaxRate" INT DEFAULT 10,
    "travelFee" INT DEFAULT 0,
    "parliamentSize" INT DEFAULT 20,
    "parliamentDuration" INT DEFAULT 5,
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
    "defenderScore" BIGINT DEFAULT 0,
    "lastEventAt" TIMESTAMPTZ
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
    channel TEXT DEFAULT 'global',
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
    section TEXT DEFAULT 'global',
    "likeCount" INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ARTICLE COMMENTS
CREATE TABLE article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "authorName" TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ARTICLE VOTES
CREATE TABLE article_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("articleId", "userId")
);

-- PARTIES (partiti politici)
CREATE TABLE parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ideology TEXT DEFAULT '',
    tag TEXT DEFAULT '',
    description TEXT DEFAULT '',
    logo TEXT DEFAULT '',
    "regionId" TEXT REFERENCES regions(id),
    "leaderUserId" UUID REFERENCES users(id),
    "createdAt" BIGINT
);

-- PARTY MEMBERS
CREATE TABLE party_members (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    "salaryCash" BIGINT DEFAULT 0,
    "salaryGold" BIGINT DEFAULT 0,
    "joinedAt" BIGINT,
    PRIMARY KEY ("userId", "partyId")
);

-- PARTY LOGS
CREATE TABLE party_logs (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    action TEXT,
    details TEXT,
    timestamp BIGINT
);

-- PARTY INVITES
CREATE TABLE party_invites (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "invitedBy" UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- PARTY PRIMARIES
CREATE TABLE party_primaries (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "candidateId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- USER INVENTORY (magazzino giocatore)
CREATE TABLE user_inventory (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "itemId" TEXT NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY ("userId", "itemId")
);

-- ELECTIONS
CREATE TABLE elections (
    id TEXT PRIMARY KEY,
    "regionId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'active',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "closesAt" TIMESTAMPTZ
);

-- ELECTION VOTES
CREATE TABLE election_votes (
    id TEXT PRIMARY KEY,
    "electionId" TEXT REFERENCES elections(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("electionId", "voterId")
);

-- PARLIAMENT MEMBERS
CREATE TABLE parliament_members (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id),
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "electedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("userId", "regionId")
);

-- LAWS
CREATE TABLE laws (
    id TEXT PRIMARY KEY,
    "regionId" TEXT REFERENCES regions(id),
    "proposerId" UUID REFERENCES users(id),
    type TEXT,
    params JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ
);

-- LAW VOTES
CREATE TABLE law_votes (
    "lawId" TEXT REFERENCES laws(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("lawId", "voterId")
);

-- LEADER CANDIDATES
CREATE TABLE leader_candidates (
    "regionId" TEXT REFERENCES regions(id),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    votes INT DEFAULT 0,
    PRIMARY KEY ("regionId", "userId")
);

-- LEADER VOTES
CREATE TABLE leader_votes (
    "regionId" TEXT REFERENCES regions(id),
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "candidateId" UUID REFERENCES users(id),
    PRIMARY KEY ("regionId", "voterId")
);

-- WORK PERMITS
CREATE TABLE work_permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- SANCTIONS
CREATE TABLE sanctions (
    id TEXT PRIMARY KEY,
    "fromStateId" TEXT REFERENCES regions(id),
    "targetStateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdByUserId" UUID REFERENCES users(id),
    "revokedAt" TIMESTAMPTZ,
    "revokedByUserId" UUID REFERENCES users(id)
);

-- BLOCS (alleanze)
CREATE TABLE blocs (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    logo TEXT DEFAULT '',
    description TEXT DEFAULT '',
    "ownerStateId" TEXT REFERENCES regions(id),
    "ownerUserId" UUID REFERENCES users(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- BLOC MEMBERSHIPS
CREATE TABLE bloc_memberships (
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    "stateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'active',
    "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("blocId", "stateId")
);

-- BLOC APPLICATIONS
CREATE TABLE bloc_applications (
    id TEXT PRIMARY KEY,
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    "stateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- BLOC REGULATIONS
CREATE TABLE bloc_regulations (
    "blocId" TEXT PRIMARY KEY REFERENCES blocs(id) ON DELETE CASCADE,
    "openBorders" INT DEFAULT 0,
    "defaultMilitaryAgreement" INT DEFAULT 0,
    "migrationOpen" INT DEFAULT 0
);

-- BLOC REGULATION PROPOSALS
CREATE TABLE bloc_regulation_proposals (
    id TEXT PRIMARY KEY,
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    type TEXT,
    "proposedValue" INT,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- BLOC VOTES
CREATE TABLE bloc_votes (
    "targetId" TEXT NOT NULL,
    "voterStateId" TEXT REFERENCES regions(id),
    choice INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("targetId", "voterStateId")
);

-- PRODUCTION QUEUE (coda produzione armi)
CREATE TABLE production_queue (
    id TEXT PRIMARY KEY,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "weaponType" TEXT,
    qty INT DEFAULT 1,
    status TEXT DEFAULT 'queued',
    "startedAt" TIMESTAMPTZ,
    "willCompleteAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- MINISTERS
CREATE TABLE ministers (
    id TEXT PRIMARY KEY,
    "stateId" TEXT REFERENCES regions(id),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT,
    title TEXT,
    "assignedByUserId" UUID REFERENCES users(id),
    "assignedAt" BIGINT,
    status TEXT DEFAULT 'ACTIVE'
);

-- MARKET TRANSACTIONS LOG
CREATE TABLE market_transactions_log (
    id TEXT PRIMARY KEY,
    "buyerId" TEXT,
    "isStateBuy" INT DEFAULT 0,
    "sellerId" TEXT,
    "itemId" TEXT,
    quantity INT,
    price BIGINT,
    "taxPaid" BIGINT DEFAULT 0,
    timestamp BIGINT
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

  -- Formula matches frontend: 100 * 1.5^(level-1)
  v_next_level_xp := FLOOR(100 * POWER(1.5, v_current_level - 1));
  
  -- Level up loop (handles multiple level ups from large XP gains)
  WHILE v_current_xp >= v_next_level_xp LOOP
    v_current_xp := v_current_xp - v_next_level_xp;
    v_current_level := v_current_level + 1;
    v_next_level_xp := FLOOR(100 * POWER(1.5, v_current_level - 1));
  END LOOP;
  
  UPDATE users SET xp = v_current_xp, level = v_current_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION execute_factory_work(
    p_user_id UUID,
    p_factory_id UUID,
    p_wage BIGINT,
    p_output_item TEXT,
    p_output_qty INT,
    p_energy_cost INT,
    p_owner_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE users SET energy = energy - p_energy_cost, money = money + p_wage WHERE id = p_user_id;
    UPDATE factories SET budget = budget - p_wage WHERE id = p_factory_id;
    INSERT INTO user_inventory ("userId", "itemId", quantity) VALUES (p_owner_id, p_output_item, p_output_qty)
    ON CONFLICT ("userId", "itemId") DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;
    INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed") VALUES (p_user_id, p_factory_id, NOW())
    ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_election_votes_count(p_election_id TEXT)
RETURNS TABLE("partyId" TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT ev."partyId", COUNT(*) as count
    FROM election_votes ev
    WHERE ev."electionId" = p_election_id
    GROUP BY ev."partyId";
END;
$$ LANGUAGE plpgsql;

-- RPC: update_region_stability
CREATE OR REPLACE FUNCTION update_region_stability(
  p_region_id TEXT,
  p_delta INT
) RETURNS VOID AS $$
BEGIN
  UPDATE regions
  SET stability = LEAST(100, GREATEST(0, stability + p_delta))
  WHERE id = p_region_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: process_invest_action
CREATE OR REPLACE FUNCTION process_invest_action(
  p_region_id TEXT,
  p_stability_delta INT,
  p_pop_delta INT,
  p_economy_delta INT
) RETURNS VOID AS $$
BEGIN
  UPDATE regions
  SET stability = LEAST(100, stability + p_stability_delta),
      population = population + p_pop_delta,
      "economyLevel" = LEAST(100, COALESCE("economyLevel", 0) + p_economy_delta)
  WHERE id = p_region_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: create_market_offer
CREATE OR REPLACE FUNCTION create_market_offer(
  p_user_id TEXT,
  p_item_id TEXT,
  p_quantity INT,
  p_price BIGINT,
  p_region_id TEXT,
  p_tax_rate INT,
  p_origin_state_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_offer_id TEXT;
BEGIN
  -- 1. Deduct Inventory
  UPDATE user_inventory
  SET quantity = quantity - p_quantity
  WHERE "userId" = p_user_id AND "itemId" = p_item_id;

  DELETE FROM user_inventory WHERE "userId" = p_user_id AND quantity <= 0;

  -- 2. Create Offer
  v_offer_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO market_offers (id, "sellerId", "sellerName", "itemId", quantity, price, "regionId", "taxRate", "originStateId", "createdAt")
  SELECT v_offer_id, id, username, p_item_id, p_quantity, p_price, p_region_id, p_tax_rate, p_origin_state_id, NOW()
  FROM users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- RPC: purchase_market_offer
CREATE OR REPLACE FUNCTION purchase_market_offer(
  p_buyer_id TEXT,
  p_offer_id TEXT,
  p_quantity INT,
  p_is_state_buy BOOLEAN,
  p_buyer_state_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_offer RECORD;
  v_total_price BIGINT;
  v_tax_amount BIGINT;
  v_net_to_seller BIGINT;
  v_txn_id TEXT;
BEGIN
  -- 1. Lock and Get Offer
  SELECT * INTO v_offer FROM market_offers WHERE id = p_offer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offerta non trovata'; END IF;
  IF v_offer.quantity < p_quantity THEN RAISE EXCEPTION 'Quantità insufficiente'; END IF;

  v_total_price := v_offer.price * p_quantity;
  v_tax_amount := floor(v_total_price * (COALESCE(v_offer."taxRate", 10)::float / 100));
  v_net_to_seller := v_total_price - v_tax_amount;

  -- 2. Deduct Funds
  IF p_is_state_buy THEN
    IF NOT EXISTS (SELECT 1 FROM regions WHERE id = p_buyer_state_id AND "ownerUserId" = p_buyer_id) THEN
      RAISE EXCEPTION 'Non autorizzato a usare i fondi dello Stato';
    END IF;

    UPDATE budgets SET "moneyEUR" = "moneyEUR" - v_total_price
    WHERE "ownerType" = 'REGION' AND "ownerId" = p_buyer_state_id;

    PERFORM add_budget_transaction(
      'REGION', p_buyer_state_id,
      'EXPENSE', 'MARKET_BUY',
      -v_total_price, jsonb_build_object(v_offer."itemId", p_quantity),
      p_buyer_id, jsonb_build_object('offerId', p_offer_id)
    );
  ELSE
    UPDATE users SET money = money - v_total_price WHERE id = p_buyer_id;

    INSERT INTO user_inventory ("userId", "itemId", quantity)
    VALUES (p_buyer_id, v_offer."itemId", p_quantity)
    ON CONFLICT ("userId", "itemId") DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;
  END IF;

  -- 3. Pay Seller and Region Taxes
  UPDATE users SET money = money + v_net_to_seller WHERE id = v_offer."sellerId";

  PERFORM add_budget_transaction(
    'REGION', v_offer."regionId",
    'INCOME', 'MARKET_TAX',
    v_tax_amount, '{}'::jsonb,
    p_buyer_id, jsonb_build_object('offerId', p_offer_id)
  );

  -- 4. Update/Delete Offer
  IF v_offer.quantity = p_quantity THEN
    DELETE FROM market_offers WHERE id = p_offer_id;
  ELSE
    UPDATE market_offers SET quantity = quantity - p_quantity WHERE id = p_offer_id;
  END IF;

  -- 5. Log Transaction
  v_txn_id := encode(gen_random_bytes(6), 'hex');
  INSERT INTO market_transactions_log (id, "buyerId", "isStateBuy", "sellerId", "itemId", quantity, price, "taxPaid", timestamp)
  VALUES (v_txn_id, p_buyer_id, CASE WHEN p_is_state_buy THEN 1 ELSE 0 END, v_offer."sellerId", v_offer."itemId", p_quantity, v_offer.price, v_tax_amount, EXTRACT(EPOCH FROM NOW()) * 1000);
END;
$$ LANGUAGE plpgsql;

-- RPC: increment_candidate_votes
CREATE OR REPLACE FUNCTION increment_candidate_votes(
  p_region_id TEXT,
  p_candidate_id TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE leader_candidates
  SET votes = votes + 1
  WHERE "regionId" = p_region_id AND "userId" = p_candidate_id;
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
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_primaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parliament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloc_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloc_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloc_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloc_regulation_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloc_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_transactions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Regions are viewable by everyone" ON regions FOR SELECT USING (true);
CREATE POLICY "Budgets are viewable by everyone" ON budgets FOR SELECT USING (true);
CREATE POLICY "Wars public read" ON wars FOR SELECT USING (true);
CREATE POLICY "Wars server manage" ON wars FOR ALL USING (true);
CREATE POLICY "Parties public read" ON parties FOR SELECT USING (true);
CREATE POLICY "Parties server manage" ON parties FOR ALL USING (true);
CREATE POLICY "Party members public read" ON party_members FOR SELECT USING (true);
CREATE POLICY "Party members server manage" ON party_members FOR ALL USING (true);
CREATE POLICY "Party logs public read" ON party_logs FOR SELECT USING (true);
CREATE POLICY "Party logs server manage" ON party_logs FOR ALL USING (true);
CREATE POLICY "Party invites public read" ON party_invites FOR SELECT USING (true);
CREATE POLICY "Party invites server manage" ON party_invites FOR ALL USING (true);
CREATE POLICY "Party primaries public read" ON party_primaries FOR SELECT USING (true);
CREATE POLICY "Party primaries server manage" ON party_primaries FOR ALL USING (true);
CREATE POLICY "User inventory public read" ON user_inventory FOR SELECT USING (true);
CREATE POLICY "User inventory server manage" ON user_inventory FOR ALL USING (true);
CREATE POLICY "Article comments public read" ON article_comments FOR SELECT USING (true);
CREATE POLICY "Article comments server manage" ON article_comments FOR ALL USING (true);
CREATE POLICY "Article votes public read" ON article_votes FOR SELECT USING (true);
CREATE POLICY "Article votes server manage" ON article_votes FOR ALL USING (true);
CREATE POLICY "Elections public read" ON elections FOR SELECT USING (true);
CREATE POLICY "Elections server manage" ON elections FOR ALL USING (true);
CREATE POLICY "Election votes public read" ON election_votes FOR SELECT USING (true);
CREATE POLICY "Election votes server manage" ON election_votes FOR ALL USING (true);
CREATE POLICY "Parliament members public read" ON parliament_members FOR SELECT USING (true);
CREATE POLICY "Parliament members server manage" ON parliament_members FOR ALL USING (true);
CREATE POLICY "Laws public read" ON laws FOR SELECT USING (true);
CREATE POLICY "Laws server manage" ON laws FOR ALL USING (true);
CREATE POLICY "Law votes public read" ON law_votes FOR SELECT USING (true);
CREATE POLICY "Law votes server manage" ON law_votes FOR ALL USING (true);
CREATE POLICY "Leader candidates public read" ON leader_candidates FOR SELECT USING (true);
CREATE POLICY "Leader candidates server manage" ON leader_candidates FOR ALL USING (true);
CREATE POLICY "Leader votes public read" ON leader_votes FOR SELECT USING (true);
CREATE POLICY "Leader votes server manage" ON leader_votes FOR ALL USING (true);
CREATE POLICY "Work permits public read" ON work_permits FOR SELECT USING (true);
CREATE POLICY "Work permits server manage" ON work_permits FOR ALL USING (true);
CREATE POLICY "Sanctions public read" ON sanctions FOR SELECT USING (true);
CREATE POLICY "Sanctions server manage" ON sanctions FOR ALL USING (true);
CREATE POLICY "Blocs public read" ON blocs FOR SELECT USING (true);
CREATE POLICY "Blocs server manage" ON blocs FOR ALL USING (true);
CREATE POLICY "Bloc memberships public read" ON bloc_memberships FOR SELECT USING (true);
CREATE POLICY "Bloc memberships server manage" ON bloc_memberships FOR ALL USING (true);
CREATE POLICY "Bloc applications public read" ON bloc_applications FOR SELECT USING (true);
CREATE POLICY "Bloc applications server manage" ON bloc_applications FOR ALL USING (true);
CREATE POLICY "Bloc regulations public read" ON bloc_regulations FOR SELECT USING (true);
CREATE POLICY "Bloc regulations server manage" ON bloc_regulations FOR ALL USING (true);
CREATE POLICY "Bloc regulation proposals public read" ON bloc_regulation_proposals FOR SELECT USING (true);
CREATE POLICY "Bloc regulation proposals server manage" ON bloc_regulation_proposals FOR ALL USING (true);
CREATE POLICY "Bloc votes public read" ON bloc_votes FOR SELECT USING (true);
CREATE POLICY "Bloc votes server manage" ON bloc_votes FOR ALL USING (true);
CREATE POLICY "Production queue public read" ON production_queue FOR SELECT USING (true);
CREATE POLICY "Production queue server manage" ON production_queue FOR ALL USING (true);
CREATE POLICY "Ministers public read" ON ministers FOR SELECT USING (true);
CREATE POLICY "Ministers server manage" ON ministers FOR ALL USING (true);
CREATE POLICY "Market transactions log public read" ON market_transactions_log FOR SELECT USING (true);
CREATE POLICY "Market transactions log server manage" ON market_transactions_log FOR ALL USING (true);
