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
-- 26. RLS POLICIES (Row Level Security)
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
        'production_queue', 'ministers', 'market_transactions_log'
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
-- 27. RPC: execute_factory_work (se non esiste già)
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
-- 28. RPC: get_election_votes_count
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
