-- ==========================================
-- MIGRAZIONE: Stati attivi vs Regioni indipendenti (state-machine)
-- DESCRIZIONE:
--  - Introduce `nations.isActiveState` per distinguere Stati reali da placeholder/semi-entità
--  - Introduce `regions.territoryStatus` + timestamp per l'evoluzione delle regioni indipendenti
--  - Backfill: rende "attivo" solo lo Stato con almeno 1 player reale e trasforma il resto in regioni indipendenti
-- ISTRUZIONI: Eseguire su Supabase SQL Editor
-- ==========================================

-- 1) Stati reali (nations)
ALTER TABLE nations ADD COLUMN IF NOT EXISTS "isActiveState" BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_nations_is_active_state ON nations("isActiveState");

-- 2) Stato politico territorio (regions)
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "territoryStatus" TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "independentAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "parliamentaryElectionStartedAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "presidentialElectionStartedAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "presidentialElectionClosesAt" TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "stateActivatedAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_regions_territory_status ON regions("territoryStatus");
CREATE INDEX IF NOT EXISTS idx_regions_independent_at ON regions("independentAt");

-- 3) Backfill: marca come "Stati reali" solo le nazioni con almeno 1 player reale
UPDATE nations n
SET "isActiveState" = true
WHERE n.id IN (
  SELECT DISTINCT "originalNation"
  FROM users
  WHERE "originalNation" IS NOT NULL
    AND username NOT ILIKE 'app_%'
    AND username NOT ILIKE 'mgr_%'
    AND username NOT ILIKE 'out_%'
    AND username NOT ILIKE 'res_%'
);

-- 4) Trasforma in regioni indipendenti tutte le regioni non appartenenti a Stati reali
UPDATE regions r
SET
  nation_id = NULL,
  "territoryStatus" = COALESCE(r."territoryStatus", 'INDEPENDENT_REGION'),
  "independentAt" = COALESCE(r."independentAt", NOW()),
  "parliamentaryElectionStartedAt" = NULL,
  "presidentialElectionStartedAt" = NULL,
  "presidentialElectionClosesAt" = NULL,
  "stateActivatedAt" = NULL
WHERE r.nation_id IS NOT NULL
  AND r.nation_id NOT IN (SELECT id FROM nations WHERE "isActiveState" = true);

-- 5) Normalizza stato per regioni già indipendenti
UPDATE regions r
SET
  "territoryStatus" = 'INDEPENDENT_REGION',
  "independentAt" = COALESCE(r."independentAt", NOW())
WHERE r.nation_id IS NULL
  AND (r."territoryStatus" IS NULL OR r."territoryStatus" = '');

-- 6) Normalizza stato per regioni dentro Stati reali
UPDATE regions r
SET
  "territoryStatus" = 'STATE_ACTIVE'
WHERE r.nation_id IS NOT NULL
  AND (r."territoryStatus" IS NULL OR r."territoryStatus" = '');

