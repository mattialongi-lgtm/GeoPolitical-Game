-- ==========================================
-- MIGRAZIONE: Sistema di Guerra Completo
-- DESCRIZIONE: Tabelle, indici, RLS e funzioni RPC per il sistema bellico
-- ISTRUZIONI: Eseguire su Supabase SQL Editor — idempotente, sicuro da rieseguire
-- ==========================================

-- ════════════════════════════════════════════
-- SEZIONE 1: ALTER wars — nuove colonne
-- Aggiunge campi per tipo guerra, regioni, fasi navali, risultato, ecc.
-- ════════════════════════════════════════════

ALTER TABLE wars ADD COLUMN IF NOT EXISTS "warType" TEXT NOT NULL DEFAULT 'land';
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "attackerRegionId" TEXT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "defenderRegionId" TEXT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "navalPhase" INTEGER DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "phase1AttackerScore" BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "phase1DefenderScore" BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "initialAttackDamage" BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "initialDefenseDamage" BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "distancePenalty" NUMERIC(5,4) DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "winnerId" TEXT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "lootValue" BIGINT DEFAULT 0;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "chainWarId" TEXT;
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE wars ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Commento: "warType" ammette 'training','land','naval','space','lunar','revolution','coup'
-- "navalPhase" — 0=non navale, 1=fase1(navi da guerra), 2=fase2(sbarco)
-- "winnerId"  — 'attacker' o 'defender'
-- "chainWarId" — riferimento a wars(id) se guerra concatenata


-- ════════════════════════════════════════════
-- SEZIONE 2: war_participants — chi partecipa e da che lato
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "warId" TEXT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id),
  side TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  "totalDamage" BIGINT DEFAULT 0,
  "troopsDeployed" JSONB DEFAULT '{}',
  "joinedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Vincolo di unicità: un utente per guerra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'war_participants_warId_userId_key'
  ) THEN
    ALTER TABLE war_participants
      ADD CONSTRAINT war_participants_warId_userId_key UNIQUE ("warId", "userId");
  END IF;
END $$;


-- ════════════════════════════════════════════
-- SEZIONE 3: war_deployments — log singoli dispiegamenti
-- Ogni azione di deploy registrata qui per storico e calcoli
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "warId" TEXT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id),
  side TEXT NOT NULL CHECK (side IN ('attacker', 'defender')),
  "troopType" TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  "baseDamage" BIGINT NOT NULL DEFAULT 0,
  "finalDamage" BIGINT NOT NULL DEFAULT 0,
  "bonuses" JSONB DEFAULT '{}',
  "deployedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Commento: "troopType" ammette 'tank','aircraft','missile','bomber','battleship','lunar_tank','space_station'
-- "bonuses" contiene breakdown dei bonus applicati (patriot, perks, regional, dept, ecc.)


-- ════════════════════════════════════════════
-- SEZIONE 4: war_auto_attacks — attacchi automatici programmati
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_auto_attacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "warId" TEXT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
  "userId" UUID NOT NULL REFERENCES users(id),
  side TEXT NOT NULL,
  "autoType" TEXT NOT NULL DEFAULT 'hourly' CHECK ("autoType" IN ('hourly', 'maximum')),
  "troopType" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "lastFiredAt" TIMESTAMPTZ,
  "activatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ
);

-- Vincolo: un auto-attack per utente per guerra
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'war_auto_attacks_warId_userId_key'
  ) THEN
    ALTER TABLE war_auto_attacks
      ADD CONSTRAINT war_auto_attacks_warId_userId_key UNIQUE ("warId", "userId");
  END IF;
END $$;


-- ════════════════════════════════════════════
-- SEZIONE 5: revolutions — rivoluzioni regionali
-- 3 iniziatori, costo in oro, collegata a guerra
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS revolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "regionId" TEXT NOT NULL,
  "initiatorIds" UUID[] NOT NULL,
  "goldCost" INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'succeeded', 'failed', 'expired')),
  "warId" TEXT REFERENCES wars(id),
  "cooldownUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ
);


-- ════════════════════════════════════════════
-- SEZIONE 6: coups — colpi di stato
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "regionId" TEXT NOT NULL,
  "initiatorIds" UUID[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'succeeded', 'failed')),
  "warId" TEXT REFERENCES wars(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ
);


-- ════════════════════════════════════════════
-- SEZIONE 7: war_military_agreements — accordi militari tra stati (versione war system)
-- Differente dalla military_agreements esistente: usa camelCase e schema guerra
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_military_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stateA" TEXT NOT NULL,
  "stateB" TEXT NOT NULL,
  "agreementType" TEXT NOT NULL DEFAULT 'bilateral'
    CHECK ("agreementType" IN ('bilateral', 'unilateral')),
  "initiatorState" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Vincolo unicità coppia stati
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'war_military_agreements_stateA_stateB_key'
  ) THEN
    ALTER TABLE war_military_agreements
      ADD CONSTRAINT war_military_agreements_stateA_stateB_key UNIQUE ("stateA", "stateB");
  END IF;
END $$;


-- ════════════════════════════════════════════
-- SEZIONE 8: war_departments — dipartimenti militari per stato
-- Land, Naval, Space — livello 1-10 con bonus percentuale
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "stateId" TEXT NOT NULL,
  "departmentType" TEXT NOT NULL
    CHECK ("departmentType" IN ('land', 'naval', 'space')),
  level INTEGER NOT NULL DEFAULT 1
    CHECK (level >= 1 AND level <= 10),
  "bonusPercent" NUMERIC(5,2) DEFAULT 0,
  "ranking" INTEGER DEFAULT 0,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Vincolo: un dipartimento per tipo per stato
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'war_departments_stateId_departmentType_key'
  ) THEN
    ALTER TABLE war_departments
      ADD CONSTRAINT war_departments_stateId_departmentType_key UNIQUE ("stateId", "departmentType");
  END IF;
END $$;


-- ════════════════════════════════════════════
-- SEZIONE 9: war_history — log completo eventi di guerra
-- Ogni evento significativo registrato per replay e analytics
-- ════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "warId" TEXT NOT NULL REFERENCES wars(id),
  "eventType" TEXT NOT NULL,
  "eventData" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Commento: "eventType" ammette 'war_started','war_ended','phase_change','deployment',
--   'resolution','building_destroyed','territory_transferred','loot'


-- ════════════════════════════════════════════
-- SEZIONE 10: INDICI — performance per query frequenti
-- ════════════════════════════════════════════

-- wars: ricerche per tipo, stato, regioni coinvolte
CREATE INDEX IF NOT EXISTS idx_wars_warType          ON wars("warType");
CREATE INDEX IF NOT EXISTS idx_wars_status           ON wars(status);
CREATE INDEX IF NOT EXISTS idx_wars_attackerRegionId ON wars("attackerRegionId");
CREATE INDEX IF NOT EXISTS idx_wars_defenderRegionId ON wars("defenderRegionId");

-- war_participants: lookup per guerra e per utente
CREATE INDEX IF NOT EXISTS idx_war_participants_warId  ON war_participants("warId");
CREATE INDEX IF NOT EXISTS idx_war_participants_userId ON war_participants("userId");

-- war_deployments: lookup per guerra, utente, ordinamento temporale
CREATE INDEX IF NOT EXISTS idx_war_deployments_warId      ON war_deployments("warId");
CREATE INDEX IF NOT EXISTS idx_war_deployments_userId     ON war_deployments("userId");
CREATE INDEX IF NOT EXISTS idx_war_deployments_deployedAt ON war_deployments("deployedAt" DESC);

-- war_auto_attacks: trovare auto-attack attivi per guerra
CREATE INDEX IF NOT EXISTS idx_war_auto_attacks_warId    ON war_auto_attacks("warId");
CREATE INDEX IF NOT EXISTS idx_war_auto_attacks_isActive ON war_auto_attacks("isActive")
  WHERE "isActive" = true;

-- revolutions: ricerca per regione e stato
CREATE INDEX IF NOT EXISTS idx_revolutions_regionId ON revolutions("regionId");
CREATE INDEX IF NOT EXISTS idx_revolutions_status   ON revolutions(status);

-- coups: ricerca per regione e stato
CREATE INDEX IF NOT EXISTS idx_coups_regionId ON coups("regionId");
CREATE INDEX IF NOT EXISTS idx_coups_status   ON coups(status);

-- war_military_agreements: ricerca per stati e stato accordo
CREATE INDEX IF NOT EXISTS idx_war_military_agreements_stateA ON war_military_agreements("stateA");
CREATE INDEX IF NOT EXISTS idx_war_military_agreements_stateB ON war_military_agreements("stateB");
CREATE INDEX IF NOT EXISTS idx_war_military_agreements_status ON war_military_agreements(status);

-- war_departments: ricerca per stato
CREATE INDEX IF NOT EXISTS idx_war_departments_stateId ON war_departments("stateId");

-- war_history: ricerca per guerra e tipo evento
CREATE INDEX IF NOT EXISTS idx_war_history_warId     ON war_history("warId");
CREATE INDEX IF NOT EXISTS idx_war_history_eventType ON war_history("eventType");


-- ════════════════════════════════════════════
-- SEZIONE 11: ROW LEVEL SECURITY — public read + server manage
-- Pattern standard: DROP IF EXISTS prima di CREATE POLICY
-- ════════════════════════════════════════════

-- ── wars (RLS già abilitato, aggiungiamo solo se mancano) ──
ALTER TABLE wars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Wars public read" ON wars;
CREATE POLICY "Wars public read" ON wars FOR SELECT USING (true);

DROP POLICY IF EXISTS "Wars server manage" ON wars;
CREATE POLICY "Wars server manage" ON wars FOR ALL USING (true);

-- ── war_participants ──
ALTER TABLE war_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War participants public read" ON war_participants;
CREATE POLICY "War participants public read"
  ON war_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "War participants server manage" ON war_participants;
CREATE POLICY "War participants server manage"
  ON war_participants FOR ALL USING (true);

-- ── war_deployments ──
ALTER TABLE war_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War deployments public read" ON war_deployments;
CREATE POLICY "War deployments public read"
  ON war_deployments FOR SELECT USING (true);

DROP POLICY IF EXISTS "War deployments server manage" ON war_deployments;
CREATE POLICY "War deployments server manage"
  ON war_deployments FOR ALL USING (true);

-- ── war_auto_attacks ──
ALTER TABLE war_auto_attacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War auto attacks public read" ON war_auto_attacks;
CREATE POLICY "War auto attacks public read"
  ON war_auto_attacks FOR SELECT USING (true);

DROP POLICY IF EXISTS "War auto attacks server manage" ON war_auto_attacks;
CREATE POLICY "War auto attacks server manage"
  ON war_auto_attacks FOR ALL USING (true);

-- ── revolutions ──
ALTER TABLE revolutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Revolutions public read" ON revolutions;
CREATE POLICY "Revolutions public read"
  ON revolutions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Revolutions server manage" ON revolutions;
CREATE POLICY "Revolutions server manage"
  ON revolutions FOR ALL USING (true);

-- ── coups ──
ALTER TABLE coups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coups public read" ON coups;
CREATE POLICY "Coups public read"
  ON coups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Coups server manage" ON coups;
CREATE POLICY "Coups server manage"
  ON coups FOR ALL USING (true);

-- ── war_military_agreements ──
ALTER TABLE war_military_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War military agreements public read" ON war_military_agreements;
CREATE POLICY "War military agreements public read"
  ON war_military_agreements FOR SELECT USING (true);

DROP POLICY IF EXISTS "War military agreements server manage" ON war_military_agreements;
CREATE POLICY "War military agreements server manage"
  ON war_military_agreements FOR ALL USING (true);

-- ── war_departments ──
ALTER TABLE war_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War departments public read" ON war_departments;
CREATE POLICY "War departments public read"
  ON war_departments FOR SELECT USING (true);

DROP POLICY IF EXISTS "War departments server manage" ON war_departments;
CREATE POLICY "War departments server manage"
  ON war_departments FOR ALL USING (true);

-- ── war_history ──
ALTER TABLE war_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "War history public read" ON war_history;
CREATE POLICY "War history public read"
  ON war_history FOR SELECT USING (true);

DROP POLICY IF EXISTS "War history server manage" ON war_history;
CREATE POLICY "War history server manage"
  ON war_history FOR ALL USING (true);


-- ════════════════════════════════════════════
-- SEZIONE 12: RPC — resolve_war(p_war_id TEXT)
-- Risolve una guerra terminata: determina vincitore, applica conseguenze
-- Se vince attaccante: edifici difensore -50%, trasferimento territorio
-- Se vince difensore: nessuna modifica al territorio
-- ════════════════════════════════════════════

CREATE OR REPLACE FUNCTION resolve_war(p_war_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_war RECORD;
  v_winner TEXT;
  v_attacker_total BIGINT;
  v_defender_total BIGINT;
  v_loot BIGINT := 0;
  v_result JSONB;
BEGIN
  -- 1. Recupera la guerra e verifica che esista
  SELECT * INTO v_war FROM wars WHERE id = p_war_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guerra non trovata: %', p_war_id;
  END IF;

  -- 2. Controlla che la guerra sia scaduta
  IF v_war."endsAt" > NOW() THEN
    RAISE EXCEPTION 'Guerra non ancora terminata (endsAt: %)', v_war."endsAt";
  END IF;

  -- 3. Controlla che non sia già risolta
  IF v_war.status = 'ended' THEN
    RAISE EXCEPTION 'Guerra già risolta: %', p_war_id;
  END IF;

  -- 4. Calcola punteggi totali (score base + eventuali fase1 per navali)
  v_attacker_total := COALESCE(v_war."attackerScore", 0)
                    + COALESCE(v_war."phase1AttackerScore", 0);
  v_defender_total := COALESCE(v_war."defenderScore", 0)
                    + COALESCE(v_war."phase1DefenderScore", 0);

  -- 5. Determina vincitore — in caso di pareggio vince il difensore (vantaggio difesa)
  IF v_attacker_total > v_defender_total THEN
    v_winner := 'attacker';
  ELSE
    v_winner := 'defender';
  END IF;

  -- 6. Se vince l'attaccante: conseguenze territoriali
  IF v_winner = 'attacker' THEN

    -- 6a. Riduci edifici della regione difensore del 50%
    IF v_war."defenderRegionId" IS NOT NULL THEN
      UPDATE regional_buildings
      SET level = GREATEST(0, FLOOR(level * 0.5)::INTEGER)
      WHERE "regionId" = v_war."defenderRegionId";
    END IF;

    -- 6b. Trasferisci proprietà della regione difensore all'attaccante
    IF v_war."defenderRegionId" IS NOT NULL
       AND v_war."attackerCountryIso2" IS NOT NULL THEN
      UPDATE regions
      SET "ownerUserId" = v_war."attackerUserId",
          "nation_id"   = v_war."attackerCountryIso2"
      WHERE id = v_war."defenderRegionId";
    END IF;

    -- 6c. Calcola valore loot (somma livelli edifici distrutti × 1000)
    SELECT COALESCE(SUM(level) * 1000, 0) INTO v_loot
    FROM regional_buildings
    WHERE "regionId" = v_war."defenderRegionId";

  END IF;
  -- Se vince il difensore: nessuna modifica al territorio

  -- 7. Aggiorna lo stato della guerra
  UPDATE wars
  SET status       = 'ended',
      "winnerId"   = v_winner,
      "resolvedAt" = NOW(),
      "lootValue"  = v_loot,
      "updatedAt"  = NOW()
  WHERE id = p_war_id;

  -- 8. Registra evento nello storico
  INSERT INTO war_history ("warId", "eventType", "eventData")
  VALUES (
    p_war_id,
    'war_ended',
    jsonb_build_object(
      'winner', v_winner,
      'attackerTotal', v_attacker_total,
      'defenderTotal', v_defender_total,
      'lootValue', v_loot,
      'defenderRegionId', v_war."defenderRegionId",
      'attackerCountryIso2', v_war."attackerCountryIso2"
    )
  );

  -- 9. Costruisci e restituisci risultato
  v_result := jsonb_build_object(
    'warId', p_war_id,
    'winner', v_winner,
    'attackerTotal', v_attacker_total,
    'defenderTotal', v_defender_total,
    'lootValue', v_loot,
    'status', 'ended'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════
-- SEZIONE 13: RPC — calculate_war_damage(...)
-- Calcola il danno pre-deploy per anteprima / conferma utente
-- Formula: baseDamage × quantity × (1 + patriotBonus + perkBonus + deptBonus − distancePenalty)
-- ════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_war_damage(
  p_user_id UUID,
  p_war_id TEXT,
  p_troop_type TEXT,
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_war RECORD;
  v_user RECORD;
  v_side TEXT;
  v_base_damage BIGINT;
  v_patriot_bonus NUMERIC := 0;
  v_perk_bonus NUMERIC := 0;
  v_dept_bonus NUMERIC := 0;
  v_distance_penalty NUMERIC := 0;
  v_multiplier NUMERIC;
  v_final_damage BIGINT;
  v_dept RECORD;
  v_nation_iso TEXT;
  v_bonuses JSONB;
BEGIN
  -- 1. Recupera la guerra
  SELECT * INTO v_war FROM wars WHERE id = p_war_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guerra non trovata: %', p_war_id;
  END IF;

  -- 2. Recupera l'utente
  SELECT * INTO v_user FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato: %', p_user_id;
  END IF;

  -- 3. Determina il lato dell'utente nella guerra
  IF v_war."attackerUserId" = p_user_id THEN
    v_side := 'attacker';
  ELSIF v_war."defenderUserId" = p_user_id THEN
    v_side := 'defender';
  ELSE
    -- Controlla nei partecipanti
    SELECT side INTO v_side
    FROM war_participants
    WHERE "warId" = p_war_id AND "userId" = p_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Utente % non partecipa alla guerra %', p_user_id, p_war_id;
    END IF;
  END IF;

  -- 4. Danno base per tipo truppa
  v_base_damage := CASE p_troop_type
    WHEN 'tank'           THEN 1000
    WHEN 'aircraft'       THEN 5000
    WHEN 'missile'        THEN 8000
    WHEN 'bomber'         THEN 12000
    WHEN 'battleship'     THEN 15000
    WHEN 'lunar_tank'     THEN 20000
    WHEN 'space_station'  THEN 50000
    ELSE 100  -- fanteria / default
  END;

  -- 5. Bonus patriota (+10% se nazione originale == nazione del lato)
  v_nation_iso := CASE
    WHEN v_side = 'attacker' THEN v_war."attackerCountryIso2"
    ELSE v_war."defenderCountryIso2"
  END;

  IF v_user."regionId" IS NOT NULL THEN
    DECLARE
      v_user_nation TEXT;
    BEGIN
      SELECT "nation_id" INTO v_user_nation
      FROM regions WHERE id = v_user."regionId";
      IF v_user_nation = v_nation_iso THEN
        v_patriot_bonus := 0.10;
      END IF;
    END;
  END IF;

  -- 6. Bonus dipartimento militare dello stato
  SELECT "bonusPercent" INTO v_dept_bonus
  FROM war_departments
  WHERE "stateId" = v_nation_iso
    AND "departmentType" = CASE
      WHEN p_troop_type IN ('battleship') THEN 'naval'
      WHEN p_troop_type IN ('lunar_tank', 'space_station') THEN 'space'
      ELSE 'land'
    END;
  IF NOT FOUND THEN
    v_dept_bonus := 0;
  ELSE
    -- bonusPercent è salvato come percentuale (es. 5.00 = 5%), convertiamo in decimale
    v_dept_bonus := v_dept_bonus / 100.0;
  END IF;

  -- 7. Penalità distanza dalla guerra
  v_distance_penalty := COALESCE(v_war."distancePenalty", 0);

  -- 8. Calcola moltiplicatore totale (minimo 0.1 per evitare danno zero/negativo)
  v_multiplier := GREATEST(0.1, 1.0 + v_patriot_bonus + v_perk_bonus + v_dept_bonus - v_distance_penalty);

  -- 9. Danno finale = baseDamage × quantity × multiplier
  v_final_damage := FLOOR(v_base_damage * p_quantity * v_multiplier);

  -- 10. Costruisci breakdown dei bonus per UI
  v_bonuses := jsonb_build_object(
    'baseDamage', v_base_damage,
    'quantity', p_quantity,
    'patriotBonus', v_patriot_bonus,
    'perkBonus', v_perk_bonus,
    'departmentBonus', v_dept_bonus,
    'distancePenalty', v_distance_penalty,
    'multiplier', v_multiplier,
    'side', v_side
  );

  RETURN jsonb_build_object(
    'finalDamage', v_final_damage,
    'bonuses', v_bonuses,
    'troopType', p_troop_type,
    'warId', p_war_id,
    'userId', p_user_id
  );
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════
-- FINE MIGRAZIONE — Sistema di Guerra Completo
-- ════════════════════════════════════════════
