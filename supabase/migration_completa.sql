-- ==========================================
-- MIGRAZIONE COMPLETA — File unico per Supabase
-- Generato automaticamente combinando:
--   full_schema.sql + tutte le migration_*.sql
-- ==========================================
-- ATTENZIONE: Questo file CANCELLA le tabelle esistenti!
-- Uso: per un database Supabase nuovo, copia tutto nel
-- SQL Editor di Supabase e premi "Run".
-- ==========================================

-- ============================================================
-- 1. DROP ALL TABLES (Destructive Reset)
-- ============================================================

DROP TABLE IF EXISTS streak_milestone_claims CASCADE;
DROP TABLE IF EXISTS periodic_reward_progress CASCADE;
DROP TABLE IF EXISTS daily_task_completions CASCADE;
DROP TABLE IF EXISTS free_reward_claims CASCADE;
DROP TABLE IF EXISTS work_streaks CASCADE;
DROP TABLE IF EXISTS military_academy_claims CASCADE;
DROP TABLE IF EXISTS daily_damage_log CASCADE;
DROP TABLE IF EXISTS daily_auto_work CASCADE;
DROP TABLE IF EXISTS resource_department_bonuses CASCADE;
DROP TABLE IF EXISTS extraction_detailed_logs CASCADE;
DROP TABLE IF EXISTS player_resource_work_experience CASCADE;
DROP TABLE IF EXISTS factory_worker_logs CASCADE;
DROP TABLE IF EXISTS factory_economy_logs CASCADE;
DROP TABLE IF EXISTS factory_market_listings CASCADE;
DROP TABLE IF EXISTS factory_upgrade_log CASCADE;
DROP TABLE IF EXISTS factory_upgrade_costs CASCADE;
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

-- ============================================================
-- 2. EXTENSIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 3. TABLES
-- ============================================================

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
    "militaryExp" INT DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" BIGINT
);

-- NATIONS
CREATE TABLE nations (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo TEXT DEFAULT '🏳️',
    "leaderUserId" UUID REFERENCES users(id),
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
    "updatedAt" BIGINT,
    -- Regional Autonomy fields
    "isCapital" BOOLEAN DEFAULT FALSE,
    "isAutonomous" BOOLEAN DEFAULT FALSE,
    "isBorderRegion" BOOLEAN DEFAULT FALSE,
    "governorPlayerId" UUID REFERENCES users(id),
    "regionalParliamentEnabled" BOOLEAN DEFAULT FALSE,
    "regionalBudget" BIGINT DEFAULT 0,
    "nationalProfitSharePercent" INT DEFAULT 100,
    "regionalProfitSharePercent" INT DEFAULT 0,
    "workerTaxPercent" INT DEFAULT 10,
    "industryTaxPercent" INT DEFAULT 10,
    "healthIndex" FLOAT DEFAULT 0,
    "militaryIndex" FLOAT DEFAULT 0,
    "educationIndex" FLOAT DEFAULT 0,
    "developmentIndex" FLOAT DEFAULT 0,
    "pollution" INT DEFAULT 0,
    "energyGeneration" FLOAT DEFAULT 0,
    "energyConsumption" FLOAT DEFAULT 0,
    "energyEfficiency" FLOAT DEFAULT 0,
    "dailyExtractionLimitGold" INT DEFAULT 2500,
    "dailyExtractionLimitOil" INT DEFAULT 600,
    "dailyExtractionLimitMinerals" INT DEFAULT 500,
    "dailyExtractionLimitUranium" INT DEFAULT 60,
    "dailyExtractionLimitDiamonds" INT DEFAULT 75,
    "dailyExtractedGold" INT DEFAULT 0,
    "dailyExtractedOil" INT DEFAULT 0,
    "dailyExtractedMinerals" INT DEFAULT 0,
    "dailyExtractedUranium" INT DEFAULT 0,
    "dailyExtractedDiamonds" INT DEFAULT 0,
    "nextExtractionResetAt" TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
    "autonomyGrantedAt" TIMESTAMPTZ,
    "autonomyRevokedAt" TIMESTAMPTZ,
    -- Regional Indexes fields (from migration_regional_indexes)
    "healthProgress" FLOAT DEFAULT 0,
    "militaryProgress" FLOAT DEFAULT 0,
    "educationProgress" FLOAT DEFAULT 0,
    "developmentProgress" FLOAT DEFAULT 0,
    "regionalClassification" TEXT DEFAULT 'underdeveloped',
    "pollutionModifier" FLOAT DEFAULT 0,
    "warModifier" FLOAT DEFAULT 0,
    "crisisModifier" FLOAT DEFAULT 0
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

-- REGIONAL BUILDINGS
CREATE TABLE regional_buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "buildingType" TEXT NOT NULL,
    quantity INT DEFAULT 0,
    level INT DEFAULT 1,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("regionId", "buildingType")
);

-- REGIONAL PARLIAMENT MEMBERS
CREATE TABLE regional_parliament_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "partyId" UUID,
    "electedAt" TIMESTAMPTZ DEFAULT NOW(),
    "termEndsAt" TIMESTAMPTZ,
    UNIQUE("regionId", "userId")
);

-- REGIONAL LAWS
CREATE TABLE regional_laws (
    id TEXT PRIMARY KEY,
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "proposerId" UUID NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    params JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ
);

CREATE TABLE regional_law_votes (
    "lawId" TEXT NOT NULL REFERENCES regional_laws(id) ON DELETE CASCADE,
    "voterId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("lawId", "voterId")
);

-- REGIONAL BUDGET TRANSACTIONS
CREATE TABLE regional_budget_transactions (
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

-- AUTONOMY HISTORY
CREATE TABLE autonomy_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    "performedByUserId" UUID REFERENCES users(id),
    details JSONB DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- FACTORIES (extended with v2/v3 columns)
CREATE TABLE factories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    type TEXT,
    "regionId" TEXT REFERENCES regions(id),
    "ownerUserId" UUID REFERENCES users(id),
    wage BIGINT DEFAULT 50,
    budget BIGINT DEFAULT 0,
    "payMode" TEXT DEFAULT 'salary', -- 'salary' (fixed wage) or 'resource' (resource-based)
    level INT DEFAULT 1,
    "cooldownSec" INT DEFAULT 600,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "currentStorage" BIGINT DEFAULT 0,
    "isActive" BOOLEAN DEFAULT TRUE,
    "totalWorkerCount" INT DEFAULT 0,
    "totalProduction" BIGINT DEFAULT 0,
    "totalOwnerProfit" BIGINT DEFAULT 0,
    "totalTaxesPaid" BIGINT DEFAULT 0,
    "listedForSale" BOOLEAN DEFAULT FALSE,
    "salePrice" BIGINT DEFAULT 0,
    "energyCost" INT DEFAULT 10,
    "payoutMoney" BIGINT DEFAULT 50,
    "minLevel" INT DEFAULT 1
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

-- PRIVATE MESSAGES
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "senderId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "senderName" TEXT NOT NULL,
    "receiverId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "receiverName" TEXT NOT NULL,
    subject TEXT DEFAULT '',
    body TEXT NOT NULL,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages("receiverId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages("receiverId") WHERE "read" = false;

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

-- REGIONAL RESOURCES SYSTEM TABLES

CREATE TABLE game_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE deep_levels (
    level INT PRIMARY KEY,
    "targetCap" INT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    description TEXT
);

CREATE TABLE region_resources (
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "dailyAvailable" INT NOT NULL DEFAULT 5000,
    "dailyExtracted" INT NOT NULL DEFAULT 0,
    "baseCapPerRecharge" INT NOT NULL DEFAULT 200,
    "deepBonusCap" INT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

CREATE TABLE player_extraction_state (
    "playerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "extractedSinceLastRecharge" INT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("playerId", "regionId", "resourceType")
);

CREATE TABLE resource_recharges (
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "lastRechargeAt" TIMESTAMPTZ DEFAULT NULL,
    "rechargedByUserId" UUID REFERENCES users(id),
    PRIMARY KEY ("regionId", "resourceType")
);

CREATE TABLE deep_explorations (
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

CREATE TABLE resource_extraction_logs (
    id BIGSERIAL PRIMARY KEY,
    "playerId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    amount INT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- NEW TABLES (from migrations)

-- FACTORY UPGRADE COSTS
CREATE TABLE factory_upgrade_costs (
  level_to INT PRIMARY KEY,
  upgrade_cost INT NOT NULL,
  aggregate_cost INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GOLD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FACTORY UPGRADE LOG
CREATE TABLE factory_upgrade_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  level_before INT NOT NULL,
  level_after INT NOT NULL,
  gold_cost INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FACTORY MARKET LISTINGS
CREATE TABLE factory_market_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    "sellerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "askingPrice" BIGINT NOT NULL CHECK ("askingPrice" > 0),
    "listedAt" TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled')),
    "buyerId" UUID REFERENCES users(id),
    "soldAt" TIMESTAMPTZ
);

-- FACTORY ECONOMY LOGS
CREATE TABLE factory_economy_logs (
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

-- FACTORY WORKER LOGS
CREATE TABLE factory_worker_logs (
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

-- PLAYER RESOURCE WORK EXPERIENCE
CREATE TABLE player_resource_work_experience (
    "playerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    experience INT NOT NULL DEFAULT 1,
    "totalExtractions" INT NOT NULL DEFAULT 0,
    "lastWorkedAt" TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY ("playerId", "resourceType")
);

-- EXTRACTION DETAILED LOGS
CREATE TABLE extraction_detailed_logs (
    id BIGSERIAL PRIMARY KEY,
    "playerId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "factoryId" UUID NULL,
    "resourceType" TEXT NOT NULL,
    "grossAmount" NUMERIC NOT NULL DEFAULT 0,
    "playerAmount" NUMERIC NOT NULL DEFAULT 0,
    "ownerAmount" NUMERIC NOT NULL DEFAULT 0,
    "taxAmount" NUMERIC NOT NULL DEFAULT 0,
    "stateAmount" NUMERIC NOT NULL DEFAULT 0,
    "autonomyAmount" NUMERIC NOT NULL DEFAULT 0,
    "moneyGenerated" NUMERIC NOT NULL DEFAULT 0,
    "withdrawnPoints" NUMERIC NOT NULL DEFAULT 0,
    "playerLevel" INT NOT NULL DEFAULT 1,
    "factoryLevel" INT NOT NULL DEFAULT 1,
    "workExperience" INT NOT NULL DEFAULT 1,
    "resourceCoefficient" NUMERIC NOT NULL DEFAULT 0,
    "finalProductivity" NUMERIC NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- RESOURCE DEPARTMENT BONUSES
CREATE TABLE resource_department_bonuses (
    "regionId" TEXT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType" TEXT NOT NULL,
    "bonusLevel" INT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

-- DAILY AUTO WORK
CREATE TABLE daily_auto_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL DEFAULT 'gold_ore',
  active BOOLEAN NOT NULL DEFAULT false,
  started_at BIGINT,
  duration_ms BIGINT NOT NULL DEFAULT 28800000,
  estimated_yield NUMERIC DEFAULT 0,
  energy_cost INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- DAILY DAMAGE LOG
CREATE TABLE daily_damage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT,
  damage_dealt NUMERIC NOT NULL DEFAULT 0,
  xp_gained NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MILITARY ACADEMY CLAIMS
CREATE TABLE military_academy_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL,
  claimed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claimed_date)
);

-- WORK STREAKS
CREATE TABLE work_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_work_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- FREE REWARD CLAIMS
CREATE TABLE free_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_label TEXT,
  reward_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- DAILY TASK COMPLETIONS
CREATE TABLE daily_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id, completed_date)
);

-- PERIODIC REWARD PROGRESS
CREATE TABLE periodic_reward_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  days_completed INTEGER NOT NULL DEFAULT 0,
  total_days_required INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  last_counted_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);

-- STREAK MILESTONE CLAIMS
CREATE TABLE streak_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_days INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_days)
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_region_resources_region ON region_resources("regionId");
CREATE INDEX IF NOT EXISTS idx_player_extraction_region ON player_extraction_state("regionId", "resourceType");
CREATE INDEX IF NOT EXISTS idx_player_extraction_player ON player_extraction_state("playerId");
CREATE INDEX IF NOT EXISTS idx_deep_explorations_active ON deep_explorations("nationId", "isActive") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_extraction_logs_player ON resource_extraction_logs("playerId", "createdAt");

CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_factory ON factory_upgrade_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_user ON factory_upgrade_log(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_costs_currency ON factory_upgrade_costs(currency);
CREATE INDEX IF NOT EXISTS idx_factory_market_status ON factory_market_listings(status);
CREATE INDEX IF NOT EXISTS idx_factory_market_factory ON factory_market_listings("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_econ_factory ON factory_economy_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_econ_date ON factory_economy_logs("logDate");
CREATE INDEX IF NOT EXISTS idx_factory_worker_factory ON factory_worker_logs("factoryId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_worker ON factory_worker_logs("workerId");
CREATE INDEX IF NOT EXISTS idx_factory_worker_date ON factory_worker_logs("workedAt");
CREATE INDEX IF NOT EXISTS idx_prwe_player ON player_resource_work_experience("playerId");
CREATE INDEX IF NOT EXISTS idx_edl_player_date ON extraction_detailed_logs("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_region_date ON extraction_detailed_logs("regionId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_factory ON extraction_detailed_logs("factoryId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_daily_damage_log_user ON daily_damage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_free_reward_claims_user ON free_reward_claims(user_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_task_completions_user ON daily_task_completions(user_id, completed_date);

-- ============================================================
-- 5. RPC FUNCTIONS
-- ============================================================

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
    -- Auto-create budget for the owner if it does not exist yet
    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR", resources, "updatedAt")
    VALUES (p_owner_type, p_owner_id, 0, '{}'::jsonb, EXTRACT(EPOCH FROM NOW()) * 1000)
    RETURNING id, "moneyEUR", resources INTO v_budget_id, v_current_money, v_current_resources;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- TEXT overload for add_user_xp (compatibility)
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id TEXT,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  PERFORM add_user_xp(p_user_id::UUID, p_amount);
END;
$$ LANGUAGE plpgsql;

-- Updated execute_factory_work with currentStorage support (from migration_factory_storage_fix)
CREATE OR REPLACE FUNCTION execute_factory_work(
  p_user_id TEXT,
  p_factory_id UUID,
  p_wage BIGINT,
  p_output_item TEXT,
  p_output_qty INT,
  p_energy_cost INT,
  p_owner_id TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Deduct Energy and Add Wage to user
  UPDATE users
  SET energy = energy - p_energy_cost,
      money = money + p_wage
  WHERE id = p_user_id;

  -- 2. Deduct Wage from Factory Budget and Add Item to Factory Storage
  UPDATE factories
  SET budget = budget - p_wage,
      "currentStorage" = COALESCE("currentStorage", 0) + p_output_qty
  WHERE id = p_factory_id;

  -- 3. Update Cooldown
  INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";
END;
$$ LANGUAGE plpgsql;

-- increment_factory_storage RPC (from migration_factory_storage_fix)
CREATE OR REPLACE FUNCTION increment_factory_storage(
  p_factory_id UUID,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  UPDATE factories
  SET "currentStorage" = COALESCE("currentStorage", 0) + p_amount
  WHERE id = p_factory_id;
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

-- RPC: upgrade_factory (from migration_consolidated)
CREATE OR REPLACE FUNCTION upgrade_factory(
  p_factory_id TEXT,
  p_target_level INT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_factory RECORD;
  v_current_level INT;
  v_current_agg INT;
  v_target_agg INT;
  v_gold_cost INT;
  v_user_gold NUMERIC;
BEGIN
  SELECT * INTO v_factory
  FROM factories
  WHERE id = p_factory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Fabbrica non trovata.');
  END IF;

  IF v_factory."ownerUserId" != p_user_id THEN
    RETURN json_build_object('error', 'Non sei il proprietario di questa fabbrica.');
  END IF;

  v_current_level := COALESCE(v_factory.level, 1);

  IF p_target_level <= v_current_level THEN
    RETURN json_build_object('error', 'Il livello target deve essere maggiore di quello attuale.');
  END IF;

  IF p_target_level > 800 THEN
    RETURN json_build_object('error', 'Il livello massimo è 800.');
  END IF;

  SELECT aggregate_cost INTO v_current_agg
  FROM factory_upgrade_costs
  WHERE level_to = v_current_level;

  IF v_current_agg IS NULL THEN
    v_current_agg := 0;
  END IF;

  SELECT aggregate_cost INTO v_target_agg
  FROM factory_upgrade_costs
  WHERE level_to = p_target_level;

  IF v_target_agg IS NULL THEN
    RETURN json_build_object('error', 'Livello target non presente nella tabella costi.');
  END IF;

  v_gold_cost := v_target_agg - v_current_agg;

  IF v_gold_cost <= 0 THEN
    RETURN json_build_object('error', 'Costo calcolato non valido.');
  END IF;

  SELECT gold INTO v_user_gold
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user_gold < v_gold_cost THEN
    RETURN json_build_object('error',
      format('Gold insufficiente. Servono %s Gold, hai %s.', v_gold_cost, FLOOR(v_user_gold)));
  END IF;

  UPDATE users SET gold = gold - v_gold_cost WHERE id = p_user_id;
  UPDATE factories SET level = p_target_level WHERE id = p_factory_id;

  INSERT INTO factory_upgrade_log (factory_id, user_id, level_before, level_after, gold_cost)
  VALUES (p_factory_id, p_user_id, v_current_level, p_target_level, v_gold_cost);

  RETURN json_build_object(
    'success', true,
    'levelBefore', v_current_level,
    'levelAfter', p_target_level,
    'goldCost', v_gold_cost
  );
END;
$$;

-- RPC: safe_deduct_currency (from migration_consolidated)
CREATE OR REPLACE FUNCTION safe_deduct_currency(
  p_user_id UUID,
  p_money_cost NUMERIC DEFAULT 0,
  p_gold_cost NUMERIC DEFAULT 0,
  p_energy_cost NUMERIC DEFAULT 0
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows_affected INT;
  v_user RECORD;
BEGIN
  UPDATE users
  SET
    money = money - p_money_cost,
    gold = gold - p_gold_cost,
    energy = energy - p_energy_cost
  WHERE id = p_user_id
    AND money >= p_money_cost
    AND gold >= p_gold_cost
    AND energy >= p_energy_cost;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    SELECT money, gold, energy INTO v_user FROM users WHERE id = p_user_id;
    IF v_user IS NULL THEN
      RETURN json_build_object('error', 'Utente non trovato.');
    END IF;
    IF v_user.money < p_money_cost THEN
      RETURN json_build_object('error', format('Fondi insufficienti. Servono $%s, hai $%s.', p_money_cost, v_user.money));
    END IF;
    IF v_user.gold < p_gold_cost THEN
      RETURN json_build_object('error', format('Gold insufficiente. Servono %s Gold, hai %s.', p_gold_cost, v_user.gold));
    END IF;
    IF v_user.energy < p_energy_cost THEN
      RETURN json_build_object('error', format('Energia insufficiente. Servono %s, hai %s.', p_energy_cost, v_user.energy));
    END IF;
    RETURN json_build_object('error', 'Fondi insufficienti.');
  END IF;

  SELECT money, gold, energy INTO v_user FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'money', v_user.money,
    'gold', v_user.gold,
    'energy', v_user.energy
  );
END;
$$;

-- RPC: upsert_factory_economy_log (from migration_factories_v2)
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

-- RPC: transfer_factory_ownership (from migration_factories_v2)
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

-- RPC: increment_factory_counters (from migration_factories_v3)
CREATE OR REPLACE FUNCTION increment_factory_counters(
  p_factory_id UUID,
  p_worker_count INT DEFAULT 1,
  p_production BIGINT DEFAULT 0,
  p_owner_profit BIGINT DEFAULT 0,
  p_taxes_paid BIGINT DEFAULT 0,
  p_storage_delta BIGINT DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  UPDATE factories SET
    "totalWorkerCount" = COALESCE("totalWorkerCount", 0) + p_worker_count,
    "totalProduction"  = COALESCE("totalProduction", 0)  + p_production,
    "totalOwnerProfit" = COALESCE("totalOwnerProfit", 0) + p_owner_profit,
    "totalTaxesPaid"   = COALESCE("totalTaxesPaid", 0)   + p_taxes_paid,
    "currentStorage"   = COALESCE("currentStorage", 0)   + p_storage_delta
  WHERE id = p_factory_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: record_daily_work (from migration_daily_gameplay)
CREATE OR REPLACE FUNCTION record_daily_work(p_user_id UUID)
RETURNS TABLE(new_streak INTEGER, is_new_day BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_row work_streaks%ROWTYPE;
BEGIN
  -- Upsert: create row if not exists
  INSERT INTO work_streaks (user_id, current_streak, longest_streak, last_work_date, updated_at)
  VALUES (p_user_id, 0, 0, NULL, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM work_streaks WHERE user_id = p_user_id FOR UPDATE;

  IF v_row.last_work_date = v_today THEN
    -- Already worked today
    new_streak := v_row.current_streak;
    is_new_day := false;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.last_work_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day
    UPDATE work_streaks SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_work_date = v_today,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    -- Streak broken, start fresh
    UPDATE work_streaks SET
      current_streak = 1,
      longest_streak = GREATEST(longest_streak, 1),
      last_work_date = v_today,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  SELECT current_streak INTO new_streak FROM work_streaks WHERE user_id = p_user_id;
  is_new_day := true;
  RETURN NEXT;
END;
$$;

-- RPC: claim_academy_reward (from migration_daily_gameplay)
CREATE OR REPLACE FUNCTION claim_academy_reward(
  p_user_id UUID,
  p_region_id TEXT,
  p_rewards JSONB DEFAULT '[]'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO military_academy_claims (user_id, region_id, claimed_date, rewards)
  VALUES (p_user_id, p_region_id, v_today, p_rewards)
  ON CONFLICT (user_id, claimed_date) DO NOTHING;

  -- Returns true if the row was inserted (new claim), false if already claimed
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 6. SEED DATA
-- ============================================================

-- Initial region seed
INSERT INTO regions (id, name, population, stability, health, education, military)
VALUES ('IT-RM', 'Rome', 2800000, 100, 10, 10, 10)
ON CONFLICT (id) DO NOTHING;

-- Initial budget for Rome
INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR")
VALUES ('REGION', 'IT-RM', 1000000)
ON CONFLICT DO NOTHING;

-- Factory upgrade costs (800 levels)
INSERT INTO factory_upgrade_costs (level_to, upgrade_cost, aggregate_cost, currency)
SELECT
  level,
  CASE WHEN level = 1 THEN 500 ELSE 5 * level END,
  CASE WHEN level = 1 THEN 500 ELSE 495 + (5 * level * (level + 1)) / 2 END,
  'GOLD'
FROM generate_series(1, 800) AS level
ON CONFLICT (level_to) DO NOTHING;

-- Extraction system game_settings
INSERT INTO game_settings (key, value, description) VALUES
  ('extraction_base_coefficient',       '0.2',   'Base coefficient for productivity formula'),
  ('extraction_player_level_exponent',  '0.8',   'Exponent for player level in productivity formula'),
  ('extraction_resource_coeff_exponent','0.8',   'Exponent for resource coefficient in productivity formula'),
  ('extraction_factory_level_exponent', '0.8',   'Exponent for factory level in productivity formula'),
  ('extraction_work_exp_exponent',      '0.6',   'Exponent for work experience in productivity formula'),
  ('extraction_nation_bonus',           '1.2',   'Nation/global production bonus multiplier'),
  ('extraction_gold_to_money',          '3.538975', 'Money generated per unit of gold produced (derived from base game economy ratio for gold-to-currency conversion)'),
  ('extraction_work_exp_gain',          '1',     'Work experience gained per extraction action'),
  ('extraction_balancing_multipliers',  '{"gold_ore":4,"oil":1,"minerals":1,"uranium":1,"diamonds":0.001,"liquid_oxygen":0.2,"helium3":0.001,"rivalium":1}', 'Final balancing multipliers per resource type'),
  ('extraction_resource_coeff_multipliers', '{"gold_ore":0.4,"oil":0.65,"minerals":0.65,"uranium":0.75,"diamonds":0.75}', 'Resource coefficient multipliers based on region max cap'),
  ('extraction_consumption_gold_ore',   '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for gold'),
  ('extraction_consumption_oil',        '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for oil'),
  ('extraction_consumption_minerals',   '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for minerals'),
  ('extraction_consumption_uranium',    '{"linearCoeff":200000,"baseOffset":20000000}', 'Regional consumption formula coefficients for uranium'),
  ('extraction_consumption_diamonds',   '{"linearCoeff":250,"baseOffset":25000}', 'Regional consumption formula coefficients for diamonds'),
  ('extraction_consumption_helium3',    '{"linearCoeff":250,"baseOffset":25000}', 'Regional consumption formula coefficients for helium3'),
  ('extraction_energy_resource_multiplier', '2', 'Multiplier for power plants in energy-based resource coefficient'),
  ('extraction_energy_resource_exponent',   '0.4', 'Exponent for energy-based resource coefficient')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 7. CHECK CONSTRAINTS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_gold_non_negative') THEN
    ALTER TABLE users ADD CONSTRAINT users_gold_non_negative CHECK (gold >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_money_non_negative') THEN
    ALTER TABLE users ADD CONSTRAINT users_money_non_negative CHECK (money >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_energy_non_negative') THEN
    ALTER TABLE users ADD CONSTRAINT users_energy_non_negative CHECK (energy >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_inventory_quantity_non_negative') THEN
    BEGIN
      ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_quantity_non_negative CHECK (quantity >= 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'factories_budget_non_negative') THEN
    BEGIN
      ALTER TABLE factories ADD CONSTRAINT factories_budget_non_negative CHECK (budget >= 0);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- ============================================================
-- 8. RLS POLICIES
-- ============================================================

-- Core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE nations ENABLE ROW LEVEL SECURITY;
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
CREATE POLICY "Nations public read" ON nations FOR SELECT USING (true);
CREATE POLICY "Nations server manage" ON nations FOR ALL USING (true);
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

-- Resource system tables
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

-- Regional Autonomy tables
ALTER TABLE regional_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_parliament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_laws ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_law_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE regional_budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regional buildings public read" ON regional_buildings FOR SELECT USING (true);
CREATE POLICY "Regional buildings server manage" ON regional_buildings FOR ALL USING (true);
CREATE POLICY "Regional parliament public read" ON regional_parliament_members FOR SELECT USING (true);
CREATE POLICY "Regional parliament server manage" ON regional_parliament_members FOR ALL USING (true);
CREATE POLICY "Regional laws public read" ON regional_laws FOR SELECT USING (true);
CREATE POLICY "Regional laws server manage" ON regional_laws FOR ALL USING (true);
CREATE POLICY "Regional law votes public read" ON regional_law_votes FOR SELECT USING (true);
CREATE POLICY "Regional law votes server manage" ON regional_law_votes FOR ALL USING (true);
CREATE POLICY "Regional budget tx public read" ON regional_budget_transactions FOR SELECT USING (true);
CREATE POLICY "Regional budget tx server manage" ON regional_budget_transactions FOR ALL USING (true);
CREATE POLICY "Autonomy history public read" ON autonomy_history FOR SELECT USING (true);
CREATE POLICY "Autonomy history server manage" ON autonomy_history FOR ALL USING (true);

-- Factory upgrade tables
ALTER TABLE factory_upgrade_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read factory upgrade costs" ON factory_upgrade_costs FOR SELECT USING (true);
ALTER TABLE factory_upgrade_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own upgrade logs" ON factory_upgrade_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert upgrade logs" ON factory_upgrade_log FOR INSERT WITH CHECK (true);

-- Factory marketplace tables
ALTER TABLE factory_market_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factory_market_read" ON factory_market_listings FOR SELECT USING (true);
CREATE POLICY "factory_market_insert" ON factory_market_listings FOR INSERT WITH CHECK (auth.uid() = "sellerId");
CREATE POLICY "factory_market_update" ON factory_market_listings FOR UPDATE USING (auth.uid() = "sellerId" OR auth.uid() = "buyerId");
ALTER TABLE factory_economy_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factory_econ_read" ON factory_economy_logs FOR SELECT USING (true);
CREATE POLICY "factory_econ_write" ON factory_economy_logs FOR ALL USING (true);
ALTER TABLE factory_worker_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factory_worker_read" ON factory_worker_logs FOR SELECT USING (true);
CREATE POLICY "factory_worker_write" ON factory_worker_logs FOR ALL USING (true);

-- Extraction system tables
ALTER TABLE player_resource_work_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prwe_read" ON player_resource_work_experience FOR SELECT USING (true);
ALTER TABLE extraction_detailed_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edl_read" ON extraction_detailed_logs FOR SELECT USING (true);
ALTER TABLE resource_department_bonuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rdb_read" ON resource_department_bonuses FOR SELECT USING (true);

-- Daily gameplay tables (all public read, server manages writes)
ALTER TABLE daily_auto_work ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_auto_work_read" ON daily_auto_work FOR SELECT USING (true);
CREATE POLICY "daily_auto_work_write" ON daily_auto_work FOR ALL USING (true);
ALTER TABLE daily_damage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_damage_log_read" ON daily_damage_log FOR SELECT USING (true);
CREATE POLICY "daily_damage_log_write" ON daily_damage_log FOR ALL USING (true);
ALTER TABLE military_academy_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "military_academy_claims_read" ON military_academy_claims FOR SELECT USING (true);
CREATE POLICY "military_academy_claims_write" ON military_academy_claims FOR ALL USING (true);
ALTER TABLE work_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work_streaks_read" ON work_streaks FOR SELECT USING (true);
CREATE POLICY "work_streaks_write" ON work_streaks FOR ALL USING (true);
ALTER TABLE free_reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "free_reward_claims_read" ON free_reward_claims FOR SELECT USING (true);
CREATE POLICY "free_reward_claims_write" ON free_reward_claims FOR ALL USING (true);
ALTER TABLE daily_task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_task_completions_read" ON daily_task_completions FOR SELECT USING (true);
CREATE POLICY "daily_task_completions_write" ON daily_task_completions FOR ALL USING (true);
ALTER TABLE periodic_reward_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periodic_reward_progress_read" ON periodic_reward_progress FOR SELECT USING (true);
CREATE POLICY "periodic_reward_progress_write" ON periodic_reward_progress FOR ALL USING (true);
ALTER TABLE streak_milestone_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "streak_milestone_claims_read" ON streak_milestone_claims FOR SELECT USING (true);
CREATE POLICY "streak_milestone_claims_write" ON streak_milestone_claims FOR ALL USING (true);
