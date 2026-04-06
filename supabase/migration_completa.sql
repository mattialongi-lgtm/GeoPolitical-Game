-- ==========================================
-- MIGRAZIONE COMPLETA — File unico per Supabase
-- ==========================================
-- Questo file combina TUTTE le migration in un unico file.
-- È SICURO da eseguire su un database ESISTENTE:
--   - NON cancella nessuna tabella
--   - Usa IF NOT EXISTS, CREATE OR REPLACE, ON CONFLICT DO NOTHING
--   - Completamente idempotente (puoi rieseguirlo senza errori)
--
-- Combina (nell'ordine corretto):
--   Step  1 — migration_missing_tables.sql
--   Step  2 — migration_fix.sql
--   Step  3 — migration_fixes_v2.sql
--   Step  4 — migration_wars_laws_fix.sql
--   Step  5 — migration_chat_xp_fix.sql
--   Step  6 — migration_messages.sql
--   Step  7 — migration_travel_time.sql
--   Step  8 — migration_resources.sql
--   Step  9 — migration_consolidated.sql (Factory Upgrades + Security)
--   Step 10 — migration_extraction_system.sql
--   Step 11 — migration_factories_v2.sql
--   Step 12 — migration_factories_v3.sql
--   Step 13 — migration_factory_storage_fix.sql
--   Step 14 — migration_bugfixes_v3.sql
--   Step 15 — migration_regional_autonomy.sql
--   Step 16 — migration_regional_indexes.sql
--   Step 17 — migration_daily_gameplay.sql
--
-- Uso: copia tutto nel SQL Editor di Supabase e premi "Run".
-- ==========================================


-- ======================================================================
-- Step  1 — Tabelle mancanti (partiti, elezioni, parlamento, leggi, permessi, ecc.)
-- Source: migration_missing_tables.sql
-- ======================================================================

-- ==========================================
-- MIGRAZIONE: Tabelle e colonne mancanti
-- ==========================================
-- ISTRUZIONI: Copia tutto questo file e incollalo nel
-- SQL Editor di Supabase, poi clicca "Run".
-- Puoi eseguirlo più volte senza problemi (usa IF NOT EXISTS / ON CONFLICT).
-- ==========================================

-- 0. Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. COLONNE MANCANTI NELLA TABELLA REGIONS
-- ==========================================
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "leaderTitle" TEXT DEFAULT 'Leader';
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "nextLeaderElectionAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dictatorshipAttempts" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dictatorship" INT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "oilBonus" FLOAT DEFAULT 1.0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "mineralsBonus" FLOAT DEFAULT 1.0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "uraniumBonus" FLOAT DEFAULT 1.0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "diamondsBonus" FLOAT DEFAULT 1.0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "marketTaxRate" INT DEFAULT 10;

-- ==========================================
-- 2. TABELLA PARTIES (partiti politici)
-- ==========================================
CREATE TABLE IF NOT EXISTS parties (
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

-- ==========================================
-- 3. TABELLA PARTY_MEMBERS (membri del partito)
-- ==========================================
CREATE TABLE IF NOT EXISTS party_members (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- 'leader', 'secretary', 'member'
    "salaryCash" BIGINT DEFAULT 0,
    "salaryGold" BIGINT DEFAULT 0,
    "joinedAt" BIGINT,
    PRIMARY KEY ("userId", "partyId")
);

-- ==========================================
-- 4. TABELLA PARTY_LOGS (log attività partito)
-- ==========================================
CREATE TABLE IF NOT EXISTS party_logs (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    action TEXT,
    details TEXT,
    timestamp BIGINT
);

-- ==========================================
-- 5. TABELLA PARTY_INVITES (inviti al partito)
-- ==========================================
CREATE TABLE IF NOT EXISTS party_invites (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "invitedBy" UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. TABELLA PARTY_PRIMARIES (voti primarie interne)
-- ==========================================
CREATE TABLE IF NOT EXISTS party_primaries (
    id TEXT PRIMARY KEY,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "candidateId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. TABELLA USER_INVENTORY (magazzino giocatore)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_inventory (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "itemId" TEXT NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY ("userId", "itemId")
);

-- ==========================================
-- 8. TABELLA ELECTIONS (elezioni regionali)
-- ==========================================
CREATE TABLE IF NOT EXISTS elections (
    id TEXT PRIMARY KEY,
    "regionId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'active', -- 'active', 'closed'
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "closesAt" TIMESTAMPTZ
);

-- ==========================================
-- 9. TABELLA ELECTION_VOTES (voti elezioni)
-- ==========================================
CREATE TABLE IF NOT EXISTS election_votes (
    id TEXT PRIMARY KEY,
    "electionId" TEXT REFERENCES elections(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("electionId", "voterId")
);

-- ==========================================
-- 10. TABELLA PARLIAMENT_MEMBERS (parlamentari)
-- ==========================================
CREATE TABLE IF NOT EXISTS parliament_members (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id),
    "partyId" TEXT REFERENCES parties(id) ON DELETE CASCADE,
    "electedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("userId", "regionId")
);

-- ==========================================
-- 11. TABELLA LAWS (leggi proposte)
-- ==========================================
CREATE TABLE IF NOT EXISTS laws (
    id TEXT PRIMARY KEY,
    "regionId" TEXT REFERENCES regions(id),
    "proposerId" UUID REFERENCES users(id),
    type TEXT,
    params JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending', -- 'pending', 'pending_assent', 'passed', 'rejected', 'withdrawn'
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ
);

-- ==========================================
-- 12. TABELLA LAW_VOTES (voti sulle leggi)
-- ==========================================
CREATE TABLE IF NOT EXISTS law_votes (
    "lawId" TEXT REFERENCES laws(id) ON DELETE CASCADE,
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT, -- 'yes', 'no'
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("lawId", "voterId")
);

-- ==========================================
-- 13. TABELLA LEADER_CANDIDATES (candidati leader)
-- ==========================================
CREATE TABLE IF NOT EXISTS leader_candidates (
    "regionId" TEXT REFERENCES regions(id),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    votes INT DEFAULT 0,
    PRIMARY KEY ("regionId", "userId")
);

-- ==========================================
-- 14. TABELLA LEADER_VOTES (voti leader)
-- ==========================================
CREATE TABLE IF NOT EXISTS leader_votes (
    "regionId" TEXT REFERENCES regions(id),
    "voterId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "candidateId" UUID REFERENCES users(id),
    PRIMARY KEY ("regionId", "voterId")
);

-- ==========================================
-- 15. TABELLA WORK_PERMITS (permessi di lavoro)
-- ==========================================
CREATE TABLE IF NOT EXISTS work_permits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "regionId" TEXT REFERENCES regions(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 16. TABELLA SANCTIONS (sanzioni tra stati)
-- ==========================================
CREATE TABLE IF NOT EXISTS sanctions (
    id TEXT PRIMARY KEY,
    "fromStateId" TEXT REFERENCES regions(id),
    "targetStateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "createdByUserId" UUID REFERENCES users(id),
    "revokedAt" TIMESTAMPTZ,
    "revokedByUserId" UUID REFERENCES users(id)
);

-- ==========================================
-- 17. TABELLA BLOCS (blocchi/alleanze)
-- ==========================================
CREATE TABLE IF NOT EXISTS blocs (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    logo TEXT DEFAULT '',
    description TEXT DEFAULT '',
    "ownerStateId" TEXT REFERENCES regions(id),
    "ownerUserId" UUID REFERENCES users(id),
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 18. TABELLA BLOC_MEMBERSHIPS (membri del blocco)
-- ==========================================
CREATE TABLE IF NOT EXISTS bloc_memberships (
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    "stateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'active', -- 'active', 'removed'
    "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("blocId", "stateId")
);

-- ==========================================
-- 19. TABELLA BLOC_APPLICATIONS (candidature al blocco)
-- ==========================================
CREATE TABLE IF NOT EXISTS bloc_applications (
    id TEXT PRIMARY KEY,
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    "stateId" TEXT REFERENCES regions(id),
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 20. TABELLA BLOC_REGULATIONS (regolamenti del blocco)
-- ==========================================
CREATE TABLE IF NOT EXISTS bloc_regulations (
    "blocId" TEXT PRIMARY KEY REFERENCES blocs(id) ON DELETE CASCADE,
    "openBorders" INT DEFAULT 0,
    "defaultMilitaryAgreement" INT DEFAULT 0,
    "migrationOpen" INT DEFAULT 0
);

-- ==========================================
-- 21. TABELLA BLOC_REGULATION_PROPOSALS (proposte di regolamento)
-- ==========================================
CREATE TABLE IF NOT EXISTS bloc_regulation_proposals (
    id TEXT PRIMARY KEY,
    "blocId" TEXT REFERENCES blocs(id) ON DELETE CASCADE,
    type TEXT, -- 'openBorders', 'migrationOpen', 'defaultMilitaryAgreement'
    "proposedValue" INT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 22. TABELLA BLOC_VOTES (voti nel blocco)
-- ==========================================
CREATE TABLE IF NOT EXISTS bloc_votes (
    "targetId" TEXT NOT NULL,
    "voterStateId" TEXT REFERENCES regions(id),
    choice INT DEFAULT 0, -- 0 = no, 1 = yes
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("targetId", "voterStateId")
);

-- ==========================================
-- 23. TABELLA PRODUCTION_QUEUE (coda produzione armi)
-- ==========================================
CREATE TABLE IF NOT EXISTS production_queue (
    id TEXT PRIMARY KEY,
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "weaponType" TEXT,
    qty INT DEFAULT 1,
    status TEXT DEFAULT 'queued', -- 'queued', 'producing', 'ready', 'claimed'
    "startedAt" TIMESTAMPTZ,
    "willCompleteAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 24. TABELLA MINISTERS (ministri del governo)
-- ==========================================
CREATE TABLE IF NOT EXISTS ministers (
    id TEXT PRIMARY KEY,
    "stateId" TEXT REFERENCES regions(id),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT, -- 'economics', 'foreign'
    title TEXT,
    "assignedByUserId" UUID REFERENCES users(id),
    "assignedAt" BIGINT,
    status TEXT DEFAULT 'ACTIVE' -- 'ACTIVE', 'REVOKED'
);

-- ==========================================
-- 25. TABELLA MARKET_TRANSACTIONS_LOG (log transazioni mercato)
-- ==========================================
CREATE TABLE IF NOT EXISTS market_transactions_log (
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

-- ==========================================
-- 26. TABELLE ARTICLE_COMMENTS e ARTICLE_VOTES
-- ==========================================
ALTER TABLE articles ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'global';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS "likeCount" INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "authorName" TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("articleId", "userId")
);

-- ==========================================
-- 27. RLS POLICIES (Row Level Security)
-- ==========================================
-- Abilita RLS per le nuove tabelle e aggiungi policy di lettura pubblica.
-- Il server usa la Service Role Key che bypassa RLS.

ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_primaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;

-- Policy di accesso completo (il server usa Service Role Key che bypassa RLS,
-- ma queste policy garantiscono che le query di SELECT funzionino anche con anon key)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'parties', 'party_members', 'party_logs', 'party_invites', 'party_primaries',
        'user_inventory', 'elections', 'election_votes', 'parliament_members',
        'laws', 'law_votes', 'leader_candidates', 'leader_votes', 'work_permits',
        'sanctions', 'blocs', 'bloc_memberships', 'bloc_applications',
        'bloc_regulations', 'bloc_regulation_proposals', 'bloc_votes',
        'production_queue', 'ministers', 'market_transactions_log',
        'article_comments', 'article_votes'
    ])
    LOOP
        -- CREATE POLICY does not support IF NOT EXISTS, so check pg_policies first
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'Public read ' || tbl
        ) THEN
            EXECUTE format(
                'CREATE POLICY "Public read %s" ON %I FOR SELECT USING (true)',
                tbl, tbl
            );
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'Server manage ' || tbl
        ) THEN
            EXECUTE format(
                'CREATE POLICY "Server manage %s" ON %I FOR ALL USING (true)',
                tbl, tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==========================================
-- 28. RPC: execute_factory_work (se non esiste già)
-- Gestisce il lavoro manuale nelle fabbriche dei giocatori
-- ==========================================
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
    -- 1. Togli energia e aggiungi salario al lavoratore
    UPDATE users
    SET energy = energy - p_energy_cost,
        money = money + p_wage
    WHERE id = p_user_id;

    -- 2. Togli salario dal budget della fabbrica
    UPDATE factories
    SET budget = budget - p_wage
    WHERE id = p_factory_id;

    -- 3. Aggiungi risorse all'inventario del proprietario
    INSERT INTO user_inventory ("userId", "itemId", quantity)
    VALUES (p_owner_id, p_output_item, p_output_qty)
    ON CONFLICT ("userId", "itemId") DO UPDATE SET quantity = user_inventory.quantity + EXCLUDED.quantity;

    -- 4. Aggiorna cooldown
    INSERT INTO user_factory_cooldowns ("userId", "factoryId", "lastUsed")
    VALUES (p_user_id, p_factory_id, NOW())
    ON CONFLICT ("userId", "factoryId") DO UPDATE SET "lastUsed" = EXCLUDED."lastUsed";
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 29. RPC: get_election_votes_count
-- ==========================================
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

-- ==========================================
-- FATTO! Se non ci sono errori rossi, tutto è andato a buon fine.
-- ==========================================

-- ==========================================
-- 29. Add travelFee column to regions (if missing)
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'regions' AND column_name = 'travelFee'
    ) THEN
        ALTER TABLE regions ADD COLUMN "travelFee" INT DEFAULT 0;
    END IF;
END $$;


-- ======================================================================
-- Step  2 — Fix colonne e tabelle (articoli, commenti, voti)
-- Source: migration_fix.sql
-- ======================================================================

-- ==========================================
-- MIGRAZIONE FIX: Tabelle e colonne mancanti
-- ==========================================
-- ISTRUZIONI: Copia tutto questo file e incollalo nel
-- SQL Editor di Supabase, poi clicca "Run".
-- Puoi eseguirlo più volte senza problemi (usa IF NOT EXISTS).
-- ==========================================

-- 1. Aggiungi colonne mancanti alla tabella USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS "perkUpgradesJson" TEXT DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "boostersJson" TEXT DEFAULT '{}';

-- 2. Crea la tabella PERKS (livelli dei perk per ogni utente)
CREATE TABLE IF NOT EXISTS perks (
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    "perkId" TEXT NOT NULL,
    level INT DEFAULT 0,
    PRIMARY KEY ("userId", "perkId")
);

-- 3. Crea la tabella CHAT_MESSAGES (messaggi della chat globale)
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID REFERENCES users(id) ON DELETE CASCADE,
    username TEXT,
    "regionId" TEXT,
    message TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crea la tabella ARTICLES (articoli/giornale)
CREATE TABLE IF NOT EXISTS articles (
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

-- Backfill columns for databases where articles already existed before this migration.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'global';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS "likeCount" INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "authorId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "authorName" TEXT NOT NULL,
    content TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "articleId" TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE ("articleId", "userId")
);

-- 5. Disabilita RLS (Row Level Security) per queste tabelle
--    così il server con Service Role Key può accedere a tutto.
--    Se hai già RLS abilitato su queste tabelle, queste righe
--    assicurano che ci siano le policy corrette.
ALTER TABLE perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;

-- Policy: il server usa la Service Role Key che bypassa RLS,
-- ma aggiungiamo policy di lettura pubblica per sicurezza.
DO $$
BEGIN
    -- Perks
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perks' AND policyname = 'Perks are viewable by everyone') THEN
        CREATE POLICY "Perks are viewable by everyone" ON perks FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'perks' AND policyname = 'Server can manage perks') THEN
        CREATE POLICY "Server can manage perks" ON perks FOR ALL USING (true);
    END IF;

    -- Chat Messages
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Chat messages are viewable by everyone') THEN
        CREATE POLICY "Chat messages are viewable by everyone" ON chat_messages FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'Server can manage chat') THEN
        CREATE POLICY "Server can manage chat" ON chat_messages FOR ALL USING (true);
    END IF;

    -- Articles
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Articles are viewable by everyone') THEN
        CREATE POLICY "Articles are viewable by everyone" ON articles FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'articles' AND policyname = 'Server can manage articles') THEN
        CREATE POLICY "Server can manage articles" ON articles FOR ALL USING (true);
    END IF;

    -- Article Comments
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'article_comments' AND policyname = 'Article comments are viewable by everyone') THEN
        CREATE POLICY "Article comments are viewable by everyone" ON article_comments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'article_comments' AND policyname = 'Server can manage article comments') THEN
        CREATE POLICY "Server can manage article comments" ON article_comments FOR ALL USING (true);
    END IF;

    -- Article Votes
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'article_votes' AND policyname = 'Article votes are viewable by everyone') THEN
        CREATE POLICY "Article votes are viewable by everyone" ON article_votes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'article_votes' AND policyname = 'Server can manage article votes') THEN
        CREATE POLICY "Server can manage article votes" ON article_votes FOR ALL USING (true);
    END IF;
END $$;

-- ==========================================
-- FATTO! Se non ci sono errori rossi, tutto è andato a buon fine.
-- ==========================================


-- ======================================================================
-- Step  3 — Fix payMode e militaryExp
-- Source: migration_fixes_v2.sql
-- ======================================================================

-- Migration for existing Supabase databases
-- Run these statements in Supabase SQL Editor one by one

-- 1. Add militaryExp column to users table (required for military training)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "militaryExp" INT DEFAULT 0;

-- 2. Add payMode column to factories table (salary vs resource-based work)
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payMode" TEXT DEFAULT 'salary';


-- ======================================================================
-- Step  4 — Fix guerre, leggi, RPCs mancanti
-- Source: migration_wars_laws_fix.sql
-- ======================================================================

-- ==========================================================
-- Migration: Fix war declaration, law execution, and missing RPCs
-- Run this on the Supabase SQL Editor to fix:
--   1. War declaration failure (missing lastEventAt column)
--   2. Parliament laws failure (missing parliamentSize/parliamentDuration)
--   3. Missing RPC functions (market, propaganda, investments, elections)
--   4. Missing RLS on wars table
-- ==========================================================

-- 1. Add missing column to wars table (fixes war declaration)
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "lastEventAt" TIMESTAMPTZ;

-- 2. Add missing columns to regions table (fixes parliament laws)
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "parliamentSize" INT DEFAULT 20;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "parliamentDuration" INT DEFAULT 5;

-- 3. Enable RLS on wars table
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policies for wars table (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wars' AND policyname = 'Wars public read') THEN
    EXECUTE 'CREATE POLICY "Wars public read" ON wars FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wars' AND policyname = 'Wars server manage') THEN
    EXECUTE 'CREATE POLICY "Wars server manage" ON wars FOR ALL USING (true)';
  END IF;
END $$;

-- 5. Missing RPC: update_region_stability (used by propaganda action)
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

-- 6. Missing RPC: process_invest_action (used by invest action)
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

-- 7. Missing RPC: create_market_offer (used by market sell endpoint)
CREATE OR REPLACE FUNCTION create_market_offer(
  p_user_id TEXT,
  p_item_id TEXT,
  p_quantity INT,
  p_price BIGINT,
  p_region_id TEXT,
  p_tax_rate INT,
  p_origin_state_id TEXT
) RETURNS VOID
SET search_path = public
AS $$
DECLARE
  v_offer_id TEXT;
BEGIN
  -- 1. Deduct Inventory
  UPDATE user_inventory
  SET quantity = quantity - p_quantity
  WHERE "userId" = p_user_id::uuid AND "itemId" = p_item_id;

  DELETE FROM user_inventory WHERE "userId" = p_user_id::uuid AND quantity <= 0;

  -- 2. Create Offer
  v_offer_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO market_offers (id, "sellerId", "sellerName", "itemId", quantity, price, "regionId", "taxRate", "originStateId", "createdAt")
  SELECT v_offer_id, id, username, p_item_id, p_quantity, p_price, p_region_id, p_tax_rate, p_origin_state_id, NOW()
  FROM users WHERE id = p_user_id::uuid;
END;
$$ LANGUAGE plpgsql;

-- 8. Missing RPC: purchase_market_offer (used by market buy endpoint)
CREATE OR REPLACE FUNCTION purchase_market_offer(
  p_buyer_id TEXT,
  p_offer_id TEXT,
  p_quantity INT,
  p_is_state_buy BOOLEAN,
  p_buyer_state_id TEXT
) RETURNS VOID
SET search_path = public
AS $$
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
    IF NOT EXISTS (SELECT 1 FROM regions WHERE id = p_buyer_state_id AND "ownerUserId" = p_buyer_id::uuid) THEN
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
    UPDATE users SET money = money - v_total_price WHERE id = p_buyer_id::uuid;

    INSERT INTO user_inventory ("userId", "itemId", quantity)
    VALUES (p_buyer_id::uuid, v_offer."itemId", p_quantity)
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
  v_txn_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO market_transactions_log (id, "buyerId", "isStateBuy", "sellerId", "itemId", quantity, price, "taxPaid", timestamp)
  VALUES (v_txn_id, p_buyer_id, CASE WHEN p_is_state_buy THEN 1 ELSE 0 END, v_offer."sellerId", v_offer."itemId", p_quantity, v_offer.price, v_tax_amount, EXTRACT(EPOCH FROM NOW()) * 1000);
END;
$$ LANGUAGE plpgsql;

-- 9. Missing RPC: increment_candidate_votes (used by leader election voting)
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


-- ======================================================================
-- Step  5 — Chat channels + XP formula
-- Source: migration_chat_xp_fix.sql
-- ======================================================================

-- Migration: Chat channel support, XP formula fix
-- Run this on your Supabase SQL Editor

-- 1. Add 'channel' column to chat_messages for global/local chat
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'global';

-- Backfill existing messages as 'global'
UPDATE chat_messages SET channel = 'global' WHERE channel IS NULL;

-- 2. Fix add_user_xp RPC to match frontend formula: LEVEL_UP_BASE_XP * LEVEL_UP_FACTOR^(level-1)
-- Frontend uses: LEVEL_UP_BASE_XP = 100, LEVEL_UP_FACTOR = 1.5
-- XP resets on level up (carry-over excess)
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

-- 3. Also support TEXT-typed user id for compatibility (delegates to UUID version)
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id TEXT,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  PERFORM add_user_xp(p_user_id::UUID, p_amount);
END;
$$ LANGUAGE plpgsql;


-- ======================================================================
-- Step  6 — Messaggi privati
-- Source: migration_messages.sql
-- ======================================================================

-- Migration: Add messages table for private messaging between players
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS messages (
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

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages("receiverId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages("receiverId") WHERE "read" = false;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their own messages
DROP POLICY IF EXISTS "Users can read their own messages" ON messages;
CREATE POLICY "Users can read their own messages" ON messages
    FOR SELECT USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");

DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages
    FOR INSERT WITH CHECK (auth.uid() = "senderId");

DROP POLICY IF EXISTS "Users can update their received messages" ON messages;
CREATE POLICY "Users can update their received messages" ON messages
    FOR UPDATE USING (auth.uid() = "receiverId");

DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages" ON messages
    FOR DELETE USING (auth.uid() = "senderId" OR auth.uid() = "receiverId");


-- ======================================================================
-- Step  7 — Colonne tempo di viaggio
-- Source: migration_travel_time.sql
-- ======================================================================

-- Migration: Add travel time columns to users table
-- Run this in the Supabase SQL Editor

-- Add travelingTo column (ISO code of travel destination)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelingTo" TEXT DEFAULT NULL;

-- Add travelingUntil column (timestamp in ms when travel completes)
ALTER TABLE users ADD COLUMN IF NOT EXISTS "travelingUntil" BIGINT DEFAULT NULL;


-- ======================================================================
-- Step  8 — Sistema risorse regionali + Deep Exploration
-- Source: migration_resources.sql
-- ======================================================================

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
-- NOTE: Values are stored as JSONB. Scalar values (numbers/strings) are parsed in
-- application code via parseInt/parseFloat. JSON objects are used for structured config.
-- Resource types in daily_available_base and base_cap_defaults must match RESOURCE_TYPES in src/types.ts.
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
DROP POLICY IF EXISTS "game_settings_read" ON game_settings;
CREATE POLICY "game_settings_read" ON game_settings FOR SELECT USING (true);

ALTER TABLE deep_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deep_levels_read" ON deep_levels;
CREATE POLICY "deep_levels_read" ON deep_levels FOR SELECT USING (true);

ALTER TABLE region_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "region_resources_read" ON region_resources;
CREATE POLICY "region_resources_read" ON region_resources FOR SELECT USING (true);

ALTER TABLE player_extraction_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_extraction_state_read" ON player_extraction_state;
CREATE POLICY "player_extraction_state_read" ON player_extraction_state FOR SELECT USING (auth.uid() = "playerId");

ALTER TABLE resource_recharges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resource_recharges_read" ON resource_recharges;
CREATE POLICY "resource_recharges_read" ON resource_recharges FOR SELECT USING (true);

ALTER TABLE deep_explorations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deep_explorations_read" ON deep_explorations;
CREATE POLICY "deep_explorations_read" ON deep_explorations FOR SELECT USING (true);

ALTER TABLE resource_extraction_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "extraction_logs_read" ON resource_extraction_logs;
CREATE POLICY "extraction_logs_read" ON resource_extraction_logs FOR SELECT USING (auth.uid() = "playerId");

-- ============================================================
-- END MIGRATION
-- ============================================================


-- ======================================================================
-- Step  9 — Factory Upgrade (800 livelli) + Security Fixes
-- Source: migration_consolidated.sql
-- ======================================================================

-- ============================================================
-- CONSOLIDATED MIGRATION: Factory Upgrade System + Security Fixes
-- Run this file on Supabase to apply all changes at once.
-- ============================================================

-- ============================================================
-- PART 1: Factory Upgrade Costs System
-- ============================================================

-- 1.1 Factory Upgrade Costs lookup table
CREATE TABLE IF NOT EXISTS factory_upgrade_costs (
  level_to INT PRIMARY KEY,
  upgrade_cost INT NOT NULL,
  aggregate_cost INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GOLD',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Seed data for levels 1..800
-- Level 1: upgrade_cost = 500 (initial build cost)
-- Levels 2-800: upgrade_cost = 5 * level
-- aggregate_cost = cumulative sum
INSERT INTO factory_upgrade_costs (level_to, upgrade_cost, aggregate_cost, currency)
SELECT
  level,
  CASE WHEN level = 1 THEN 500 ELSE 5 * level END,
  CASE WHEN level = 1 THEN 500 ELSE 495 + (5 * level * (level + 1)) / 2 END,
  'GOLD'
FROM generate_series(1, 800) AS level
ON CONFLICT (level_to) DO NOTHING;

-- 1.3 Factory Upgrade Log table
CREATE TABLE IF NOT EXISTS factory_upgrade_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factory_id UUID NOT NULL REFERENCES factories(id),
  user_id UUID NOT NULL REFERENCES users(id),
  level_before INT NOT NULL,
  level_after INT NOT NULL,
  gold_cost INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Align legacy column type (text -> uuid) when upgrading existing databases
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'factory_upgrade_log'
      AND column_name = 'factory_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE factory_upgrade_log
      ALTER COLUMN factory_id TYPE UUID USING factory_id::uuid;
  END IF;
END $$;

-- 1.4 Indexes
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_factory ON factory_upgrade_log(factory_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_log_user ON factory_upgrade_log(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_upgrade_costs_currency ON factory_upgrade_costs(currency);

-- 1.5 RLS Policies
ALTER TABLE factory_upgrade_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read factory upgrade costs" ON factory_upgrade_costs;
CREATE POLICY "Anyone can read factory upgrade costs"
  ON factory_upgrade_costs FOR SELECT USING (true);

ALTER TABLE factory_upgrade_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own upgrade logs" ON factory_upgrade_log;
CREATE POLICY "Users can read own upgrade logs"
  ON factory_upgrade_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert upgrade logs" ON factory_upgrade_log;
CREATE POLICY "Service role can insert upgrade logs"
  ON factory_upgrade_log FOR INSERT WITH CHECK (true);

-- 1.6 Transactional RPC: upgrade_factory
CREATE OR REPLACE FUNCTION upgrade_factory(
  p_factory_id UUID,
  p_target_level INT,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- ============================================================
-- PART 2: Security Fixes
-- ============================================================

-- 2.1 CHECK constraints to prevent negative balances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_gold_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_gold_non_negative CHECK (gold >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_money_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_money_non_negative CHECK (money >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_energy_non_negative'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_energy_non_negative CHECK (energy >= 0);
  END IF;
END $$;

-- 2.2 Atomic safe deduction RPC
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

-- 2.3 Inventory and factory budget constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_inventory_quantity_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE user_inventory ADD CONSTRAINT user_inventory_quantity_non_negative CHECK (quantity >= 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'factories_budget_non_negative'
  ) THEN
    BEGIN
      ALTER TABLE factories ADD CONSTRAINT factories_budget_non_negative CHECK (budget >= 0);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;


-- ======================================================================
-- Step 10 — Sistema estrazione avanzato
-- Source: migration_extraction_system.sql
-- ======================================================================

-- ============================================================
-- MIGRATION: Advanced Resource Extraction System
-- Features: work experience, productivity formula, regional consumption,
--           tax/payout distribution, extraction analytics, daily reset
-- Depends on: migration_resources.sql (region_resources, game_settings, etc.)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 1. PLAYER RESOURCE WORK EXPERIENCE
-- Tracks per-player, per-resource experience for the productivity formula.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_resource_work_experience (
    "playerId"         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "resourceType"     TEXT    NOT NULL,
    experience         INT     NOT NULL DEFAULT 1,
    "totalExtractions" INT     NOT NULL DEFAULT 0,
    "lastWorkedAt"     TIMESTAMPTZ DEFAULT NULL,
    PRIMARY KEY ("playerId", "resourceType")
);

CREATE INDEX IF NOT EXISTS idx_prwe_player
    ON player_resource_work_experience ("playerId");

-- ────────────────────────────────────────────────────────────
-- 2. EXTRACTION DETAILED LOGS (richer than resource_extraction_logs)
-- One row per extraction action with full breakdown for analytics.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extraction_detailed_logs (
    id                 BIGSERIAL PRIMARY KEY,
    "playerId"         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "regionId"         TEXT    NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "factoryId"        UUID    NULL,
    "resourceType"     TEXT    NOT NULL,
    "grossAmount"      NUMERIC NOT NULL DEFAULT 0,
    "playerAmount"     NUMERIC NOT NULL DEFAULT 0,
    "ownerAmount"      NUMERIC NOT NULL DEFAULT 0,
    "taxAmount"        NUMERIC NOT NULL DEFAULT 0,
    "stateAmount"      NUMERIC NOT NULL DEFAULT 0,
    "autonomyAmount"   NUMERIC NOT NULL DEFAULT 0,
    "moneyGenerated"   NUMERIC NOT NULL DEFAULT 0,
    "withdrawnPoints"  NUMERIC NOT NULL DEFAULT 0,
    "playerLevel"      INT     NOT NULL DEFAULT 1,
    "factoryLevel"     INT     NOT NULL DEFAULT 1,
    "workExperience"   INT     NOT NULL DEFAULT 1,
    "resourceCoefficient" NUMERIC NOT NULL DEFAULT 0,
    "finalProductivity" NUMERIC NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edl_player_date
    ON extraction_detailed_logs ("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_region_date
    ON extraction_detailed_logs ("regionId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_edl_factory
    ON extraction_detailed_logs ("factoryId", "createdAt");

-- ────────────────────────────────────────────────────────────
-- 3. RESOURCE DEPARTMENT BONUSES (per region)
-- Stores the active resource department bonus level for a region.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_department_bonuses (
    "regionId"         TEXT    NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
    "resourceType"     TEXT    NOT NULL,
    "bonusLevel"       INT     NOT NULL DEFAULT 0,
    "updatedAt"        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY ("regionId", "resourceType")
);

-- ────────────────────────────────────────────────────────────
-- 4. ADD deep_bonus_cap COLUMN TO region_resources (if not exists)
-- Stores the current deep exploration bonus for the region's resource cap.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'region_resources'
          AND column_name = 'deepBonusCap'
    ) THEN
        ALTER TABLE region_resources ADD COLUMN "deepBonusCap" INT NOT NULL DEFAULT 0;
    END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. ADDITIONAL GAME SETTINGS for the extraction formula
-- ────────────────────────────────────────────────────────────
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

-- ────────────────────────────────────────────────────────────
-- 6. RLS POLICIES
-- ────────────────────────────────────────────────────────────

ALTER TABLE player_resource_work_experience ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prwe_read" ON player_resource_work_experience;
CREATE POLICY "prwe_read" ON player_resource_work_experience
    FOR SELECT USING (true);

ALTER TABLE extraction_detailed_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "edl_read" ON extraction_detailed_logs;
CREATE POLICY "edl_read" ON extraction_detailed_logs
    FOR SELECT USING (true);

ALTER TABLE resource_department_bonuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rdb_read" ON resource_department_bonuses;
CREATE POLICY "rdb_read" ON resource_department_bonuses
    FOR SELECT USING (true);

-- ============================================================
-- END MIGRATION
-- ============================================================


-- ======================================================================
-- Step 11 — Economia fabbriche: storage, marketplace, log
-- Source: migration_factories_v2.sql
-- ======================================================================

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


-- ======================================================================
-- Step 12 — Factory v3: colonne mancanti, cooldowns, budgets, RPCs
-- Source: migration_factories_v3.sql
-- ======================================================================

-- ============================================================
-- FACTORY SYSTEM V3 - Fill missing columns, RPCs and tables
-- ============================================================
-- This migration ensures all objects needed by the factory v2
-- backend code actually exist in the database.  It is fully
-- idempotent and safe to run multiple times.
--
-- What it adds / ensures:
--   1. Missing columns on "factories": energyCost, payoutMoney, minLevel
--   2. General-purpose "cooldowns" table (used for propaganda, etc.)
--   3. "budgets" + "budget_transactions" tables (dependency of RPCs)
--   4. add_budget_transaction() RPC
--   5. process_work_action() RPC
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════
-- 1. Missing columns on factories table
-- ═══════════════════════════════════════════════════════════

ALTER TABLE factories ADD COLUMN IF NOT EXISTS "energyCost" INT DEFAULT 10;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "payoutMoney" BIGINT DEFAULT 50;
ALTER TABLE factories ADD COLUMN IF NOT EXISTS "minLevel" INT DEFAULT 1;

-- Back-fill: set payoutMoney = wage for any rows that already exist
-- (so existing salary-mode factories keep the wage they already have)
UPDATE factories SET "payoutMoney" = wage WHERE "payoutMoney" = 50 AND wage <> 50;

-- ═══════════════════════════════════════════════════════════
-- 2. General-purpose cooldowns table
--    (propaganda, invest, and other non-factory actions)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cooldowns (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, action_type)
);

-- ═══════════════════════════════════════════════════════════
-- 3. Budget tables (dependency for add_budget_transaction)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ownerType" TEXT NOT NULL,           -- 'REGION', 'STATE', etc.
    "ownerId" TEXT NOT NULL,
    "moneyEUR" BIGINT DEFAULT 0,
    resources JSONB DEFAULT '{}'::jsonb,
    "updatedAt" BIGINT DEFAULT 0,
    UNIQUE("ownerType", "ownerId")
);

CREATE TABLE IF NOT EXISTS budget_transactions (
    id TEXT PRIMARY KEY,
    "budgetId" UUID REFERENCES budgets(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                  -- 'INCOME', 'EXPENSE'
    subtype TEXT NOT NULL,               -- 'TAX', 'RESOURCE_TAX', etc.
    "moneyDelta" BIGINT DEFAULT 0,
    "resourcesDelta" JSONB DEFAULT '{}'::jsonb,
    "createdAt" BIGINT DEFAULT 0,
    "createdByUserId" UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ═══════════════════════════════════════════════════════════
-- 4. add_budget_transaction() RPC
-- ═══════════════════════════════════════════════════════════

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
  v_tx_id := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
  INSERT INTO budget_transactions (
    id, "budgetId", type, subtype, "moneyDelta", "resourcesDelta", "createdAt", "createdByUserId", metadata
  ) VALUES (
    v_tx_id, v_budget_id, p_type, p_subtype, p_money_delta, p_resources_delta,
    EXTRACT(EPOCH FROM NOW()) * 1000, p_created_by, p_metadata
  );

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════
-- 5. process_work_action() RPC
--    Atomically deducts energy, adds earnings, updates
--    cooldown, and logs taxes for salary-mode work.
-- ═══════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════
-- 6. Atomic factory counter increment RPC
--    Prevents race conditions when multiple workers work
--    the same factory simultaneously.
-- ═══════════════════════════════════════════════════════════

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


-- ======================================================================
-- Step 13 — Fix warehouse interno fabbriche
-- Source: migration_factory_storage_fix.sql
-- ======================================================================

-- Migration: Factory Storage Fix
-- Description: Updates execute_factory_work and adds increment_factory_storage to support internal factory warehouse.

-- 1. Update execute_factory_work to use internal storage
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
      currentStorage = COALESCE(currentStorage, 0) + p_output_qty
  WHERE id = p_factory_id;

  -- 3. Update Cooldown
  INSERT INTO user_factory_cooldowns (userId, factoryId, lastUsed)
  VALUES (p_user_id, p_factory_id, NOW())
  ON CONFLICT (userId, factoryId) DO UPDATE SET lastUsed = EXCLUDED.lastUsed;
END;
$$ LANGUAGE plpgsql;

-- 2. Add increment_factory_storage RPC
CREATE OR REPLACE FUNCTION increment_factory_storage(
  p_factory_id UUID,
  p_amount INT
) RETURNS VOID AS $$
BEGIN
  UPDATE factories
  SET currentStorage = COALESCE(currentStorage, 0) + p_amount
  WHERE id = p_factory_id;
END;
$$ LANGUAGE plpgsql;


-- ======================================================================
-- Step 14 — Bugfix colonne factories, user_factory_cooldowns
-- Source: migration_bugfixes_v3.sql
-- ======================================================================

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


-- ======================================================================
-- Step 15 — Autonomia regionale: governatori, edifici, energia, tasse
-- Source: migration_regional_autonomy.sql
-- ======================================================================

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
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitGold" INT DEFAULT 2500;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitOil" INT DEFAULT 600;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitMinerals" INT DEFAULT 500;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitUranium" INT DEFAULT 60;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "dailyExtractionLimitDiamonds" INT DEFAULT 75;
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


-- ======================================================================
-- Step 16 — Indici regionali: progress tracking, classificazione, modificatori
-- Source: migration_regional_indexes.sql
-- ======================================================================

-- ══════════════════════════════════════════════════════════════════
-- Migration: Regional Indexes System
-- Adds progress tracking, regional classification, and modifier
-- columns to the regions table to support the full Regional Indexes
-- gameplay system (Health / Military / Education / Development).
-- ══════════════════════════════════════════════════════════════════

-- Progress columns (0–100 float): how far the region has progressed
-- toward the next level for each index.
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "healthProgress"      FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "militaryProgress"    FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "educationProgress"   FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "developmentProgress" FLOAT DEFAULT 0;

-- Regional classification derived automatically from developmentIndex.
-- Values: 'developed' | 'developing' | 'underdeveloped'
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "regionalClassification" TEXT DEFAULT 'underdeveloped';

-- Optional gameplay modifier columns.
-- These allow external systems (pollution, wars, crises) to apply
-- temporary adjustments to region effectiveness without touching
-- the core index values.  All default to 0 (no effect).
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "pollutionModifier" FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "warModifier"       FLOAT DEFAULT 0;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "crisisModifier"    FLOAT DEFAULT 0;

-- ── Back-fill classification for existing rows ───────────────────
-- Regions with no developmentIndex data default to 'underdeveloped'.
UPDATE regions
SET "regionalClassification" = CASE
    WHEN "developmentIndex" >= 6 THEN 'developed'
    WHEN "developmentIndex" >= 2 THEN 'developing'
    ELSE 'underdeveloped'
END
WHERE "regionalClassification" = 'underdeveloped';


-- ======================================================================
-- Step 17 — Daily Gameplay: tasks giornalieri, auto-work, academy, streaks
-- Source: migration_daily_gameplay.sql
-- ======================================================================

-- ==========================================================
-- Migration: Daily Gameplay System
-- Description: Tables for the daily tasks, auto-work farming,
--   daily damage/training, military academy, work streaks,
--   and free reward tracking system.
-- Run AFTER full_schema.sql (or after all previous migrations).
-- Fully idempotent — safe to re-run.
-- ==========================================================

-- ── 1. Daily Auto-Work Settings ──────────────────────────
-- Stores the player's auto-work farming configuration.
CREATE TABLE IF NOT EXISTS daily_auto_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL DEFAULT 'gold_ore',
  active BOOLEAN NOT NULL DEFAULT false,
  started_at BIGINT,          -- epoch ms
  duration_ms BIGINT NOT NULL DEFAULT 28800000, -- 8 hours default
  estimated_yield NUMERIC DEFAULT 0,
  energy_cost INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── 2. Daily Damage Log ──────────────────────────────────
-- Tracks when players send their daily damage and where.
CREATE TABLE IF NOT EXISTS daily_damage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,   -- 'military_training', 'revolution_defense', 'coup_defense', 'active_event'
  target_id TEXT,              -- optional: event/war ID
  damage_dealt NUMERIC NOT NULL DEFAULT 0,
  xp_gained NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_damage_log_user
  ON daily_damage_log(user_id, created_at DESC);

-- ── 3. Military Academy Claims ───────────────────────────
-- Tracks daily academy build/claim per player.
CREATE TABLE IF NOT EXISTS military_academy_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL,
  claimed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  rewards JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, claimed_date)
);

-- ── 4. Work Streaks ──────────────────────────────────────
-- Tracks consecutive daily work activity for streak rewards.
CREATE TABLE IF NOT EXISTS work_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_work_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- ── 5. Free Reward Claims ────────────────────────────────
-- Tracks all free reward claims from various sources.
CREATE TABLE IF NOT EXISTS free_reward_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,        -- 'academy', 'work_medal', 'periodic', 'streak', 'event', 'other'
  source_label TEXT,
  reward_type TEXT NOT NULL,   -- 'energy_bottles', 'gold', 'money', 'xp'
  amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_free_reward_claims_user
  ON free_reward_claims(user_id, claimed_at DESC);

-- ── 6. Daily Task Completions ────────────────────────────
-- Tracks which daily tasks a player has completed each day.
CREATE TABLE IF NOT EXISTS daily_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  completed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_task_completions_user
  ON daily_task_completions(user_id, completed_date);

-- ── 7. Periodic Reward Progress ──────────────────────────
-- Tracks cumulative progress towards periodic rewards.
CREATE TABLE IF NOT EXISTS periodic_reward_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,     -- 'periodic-weekly', 'periodic-monthly', etc.
  days_completed INTEGER NOT NULL DEFAULT 0,
  total_days_required INTEGER NOT NULL,
  claimed BOOLEAN NOT NULL DEFAULT false,
  last_counted_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_id)
);

-- ── 8. Streak Milestone Claims ───────────────────────────
-- Tracks which streak milestones have been claimed by each player.
CREATE TABLE IF NOT EXISTS streak_milestone_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_days INTEGER NOT NULL,
  reward_type TEXT NOT NULL,
  reward_amount NUMERIC NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_days)
);

-- ── RPC: Record daily work for streak tracking ───────────
-- Atomically updates the work streak when a player works.
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

-- ── RPC: Claim academy reward ────────────────────────────
-- Atomically claims the daily academy reward if not already claimed today.
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

-- ==========================================
-- Automation modes for work and hourly training damage
-- (work_auto_actions / training_auto_actions)
-- ==========================================

CREATE TABLE IF NOT EXISTS work_auto_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "factoryId" UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'standard' CHECK (mode IN ('standard')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_auto_actions_userId_key'
  ) THEN
    ALTER TABLE work_auto_actions
      ADD CONSTRAINT work_auto_actions_userId_key UNIQUE ("userId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_auto_actions_userId
  ON work_auto_actions("userId");

CREATE INDEX IF NOT EXISTS idx_work_auto_actions_isActive
  ON work_auto_actions("isActive")
  WHERE "isActive" = true;

CREATE TABLE IF NOT EXISTS training_auto_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'hourly' CHECK (mode IN ('hourly')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastFiredAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_auto_actions_userId_key'
  ) THEN
    ALTER TABLE training_auto_actions
      ADD CONSTRAINT training_auto_actions_userId_key UNIQUE ("userId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_training_auto_actions_userId
  ON training_auto_actions("userId");

CREATE INDEX IF NOT EXISTS idx_training_auto_actions_isActive
  ON training_auto_actions("isActive")
  WHERE "isActive" = true;

-- ============================================================
-- Daily auto-work / rewards RLS hardening (incremental + fail-closed)
-- Scope: public.daily_auto_work, public.periodic_reward_progress,
--        public.streak_milestone_claims
-- Rationale: same cluster as daily tracking & daily gameplay
--            hardening sprint. No direct client (anon/authenticated)
--            access has been identified in the current application code.
-- Idempotent: safe to re-run at any time.
-- ============================================================

-- 1) Enable RLS on the three tables.
ALTER TABLE IF EXISTS public.daily_auto_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.periodic_reward_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streak_milestone_claims ENABLE ROW LEVEL SECURITY;

-- 2) Drop broad/legacy policies if they exist.
DROP POLICY IF EXISTS "daily_auto_work_public_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_authenticated_read" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_read_own" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_all" ON public.daily_auto_work;
DROP POLICY IF EXISTS "daily_auto_work_insert_own" ON public.daily_auto_work;

DROP POLICY IF EXISTS "periodic_reward_progress_public_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_authenticated_read" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_read_own" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_all" ON public.periodic_reward_progress;
DROP POLICY IF EXISTS "periodic_reward_progress_insert_own" ON public.periodic_reward_progress;

DROP POLICY IF EXISTS "streak_milestone_claims_public_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_authenticated_read" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_read_own" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_all" ON public.streak_milestone_claims;
DROP POLICY IF EXISTS "streak_milestone_claims_insert_own" ON public.streak_milestone_claims;

-- 3) Fail-closed posture: no direct client privileges.
-- Current code paths do not require direct anon/authenticated table access.
REVOKE ALL PRIVILEGES ON TABLE public.daily_auto_work FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.periodic_reward_progress FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.streak_milestone_claims FROM anon, authenticated;

-- 4) No anon/authenticated SELECT/INSERT/UPDATE/DELETE policies are created.
-- Access remains backend/service-role controlled until explicit client need is proven.


-- ============================================================
-- Medium-priority RLS hardening (incremental + fail-closed)
-- Scope: public.cooldowns, public.user_factory_cooldowns,
--        public.budget_transactions
-- Rationale: endpoint-by-endpoint review found backend-mediated
--            access patterns only (service-role and backend APIs).
--            No direct client table access is required.
-- ============================================================

-- 1) Enable RLS on target tables.
ALTER TABLE IF EXISTS public.cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_factory_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.budget_transactions ENABLE ROW LEVEL SECURITY;

-- 2) Drop broad/legacy policies if they exist.
DROP POLICY IF EXISTS "cooldowns_public_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_authenticated_read" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_read_own" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_all" ON public.cooldowns;
DROP POLICY IF EXISTS "cooldowns_insert_own" ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_public_read ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_authenticated_read ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_read_own ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_all ON public.cooldowns;
DROP POLICY IF EXISTS cooldowns_insert_own ON public.cooldowns;

DROP POLICY IF EXISTS "user_factory_cooldowns_public_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_authenticated_read" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_read_own" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_all" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS "user_factory_cooldowns_insert_own" ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_public_read ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_authenticated_read ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_read_own ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_all ON public.user_factory_cooldowns;
DROP POLICY IF EXISTS user_factory_cooldowns_insert_own ON public.user_factory_cooldowns;

DROP POLICY IF EXISTS "budget_transactions_public_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_authenticated_read" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_read_own" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_all" ON public.budget_transactions;
DROP POLICY IF EXISTS "budget_transactions_insert_own" ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_public_read ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_authenticated_read ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_read_own ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_all ON public.budget_transactions;
DROP POLICY IF EXISTS budget_transactions_insert_own ON public.budget_transactions;

-- 3) Fail-closed posture for client roles.
-- Current code paths do not require direct anon/authenticated table access.
REVOKE ALL PRIVILEGES ON TABLE public.cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.user_factory_cooldowns FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.budget_transactions FROM anon, authenticated;

-- 4) Intentionally no anon/authenticated SELECT/INSERT/UPDATE/DELETE policies.
-- Access remains backend/service-role controlled.


-- ============================================================
-- War Deploy RPC — Atomic war deploy function
-- Scope: Replaces 4 independent DB writes (users, wars,
--        war_participants, action_logs) with a single
--        atomic transaction.
-- Idempotent: CREATE OR REPLACE, IF NOT EXISTS throughout.
-- ============================================================

-- 1. Index for war_participants lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_war_participants_war_user
  ON war_participants("warId", "userId");

-- 2. Atomic war deploy function
CREATE OR REPLACE FUNCTION rpc_war_deploy(
  p_user_id     UUID,
  p_war_id      UUID,
  p_side        TEXT,        -- 'attacker' | 'defender'
  p_weapon_id   TEXT,        -- 'infantry' | 'tank' | 'airstrike' | 'battleship'
  p_energy_cost INT,
  p_money_cost  NUMERIC,
  p_damage      INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user       RECORD;
  v_war        RECORD;
  v_new_score  INT;
BEGIN
  -- 1. Lock user row + verify balance
  SELECT id, energy, money INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user.energy < p_energy_cost THEN
    RETURN json_build_object('error',
      format('Energia insufficiente. Servono %s, hai %s.', p_energy_cost, v_user.energy));
  END IF;

  IF v_user.money < p_money_cost THEN
    RETURN json_build_object('error',
      format('Fondi insufficienti. Servono $%s, hai $%s.', p_money_cost, v_user.money));
  END IF;

  -- 2. Lock war row + verify active
  SELECT id, status, "attackerScore", "defenderScore"
  INTO v_war
  FROM wars
  WHERE id = p_war_id
  FOR UPDATE;

  IF NOT FOUND OR v_war.status != 'active' THEN
    RETURN json_build_object('error', 'Guerra non trovata o non attiva.');
  END IF;

  -- 3. Atomic deduct energy + money
  UPDATE users
  SET energy = energy - p_energy_cost,
      money  = money  - p_money_cost
  WHERE id = p_user_id;

  -- 4. Atomic increment war score
  IF p_side = 'attacker' THEN
    UPDATE wars
    SET "attackerScore" = "attackerScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."attackerScore" + p_damage;
  ELSE
    UPDATE wars
    SET "defenderScore" = "defenderScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."defenderScore" + p_damage;
  END IF;

  -- 5. Upsert war_participants (damage tracking)
  INSERT INTO war_participants ("warId", "userId", side, "totalDamage")
  VALUES (p_war_id, p_user_id, p_side, p_damage)
  ON CONFLICT ("warId", "userId")
  DO UPDATE SET
    "totalDamage" = war_participants."totalDamage" + p_damage;

  -- 6. Insert action log
  INSERT INTO action_logs ("userId", action, details, "createdAt")
  VALUES (
    p_user_id,
    'WAR_DEPLOY',
    json_build_object(
      'warId',    p_war_id,
      'side',     p_side,
      'weaponId', p_weapon_id,
      'damage',   p_damage,
      'cost',     json_build_object('energy', p_energy_cost, 'money', p_money_cost)
    ),
    NOW()
  );

  -- 7. Return success with updated balances
  RETURN json_build_object(
    'success',   true,
    'damage',    p_damage,
    'newScore',  v_new_score,
    'energy',    v_user.energy - p_energy_cost,
    'money',     v_user.money  - p_money_cost
  );
END;
$$;

-- 3. Security: restrict execution to service_role only
REVOKE EXECUTE ON FUNCTION rpc_war_deploy FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION rpc_war_deploy TO service_role;
