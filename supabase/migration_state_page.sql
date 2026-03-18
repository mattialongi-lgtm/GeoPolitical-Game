-- ==========================================================
-- Migration: State Page Support
-- Description: Extends the nations table with treasury, detail
--   fields, and adds military_agreements table to support the
--   new State page UI.
-- Run AFTER full_schema.sql (or after all previous migrations).
-- Fully idempotent — safe to re-run.
-- ==========================================================

-- ── 1. Extend nations table with treasury fields ──────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'treasury_balance'
  ) THEN
    ALTER TABLE nations ADD COLUMN treasury_balance BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'treasury_daily_income'
  ) THEN
    ALTER TABLE nations ADD COLUMN treasury_daily_income BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'treasury_daily_expenses'
  ) THEN
    ALTER TABLE nations ADD COLUMN treasury_daily_expenses BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'gold_reserve'
  ) THEN
    ALTER TABLE nations ADD COLUMN gold_reserve BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'special_funds'
  ) THEN
    ALTER TABLE nations ADD COLUMN special_funds BIGINT DEFAULT 0;
  END IF;
END $$;

-- ── 2. Extend nations table with state detail fields ──────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'government_form'
  ) THEN
    ALTER TABLE nations ADD COLUMN government_form TEXT DEFAULT 'PARLIAMENTARY_REPUBLIC';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'economy_minister_id'
  ) THEN
    ALTER TABLE nations ADD COLUMN economy_minister_id UUID REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'foreign_minister_id'
  ) THEN
    ALTER TABLE nations ADD COLUMN foreign_minister_id UUID REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'geopolitical_bloc'
  ) THEN
    ALTER TABLE nations ADD COLUMN geopolitical_bloc TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'work_permits'
  ) THEN
    ALTER TABLE nations ADD COLUMN work_permits INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'mandate_start'
  ) THEN
    ALTER TABLE nations ADD COLUMN mandate_start TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'next_elections'
  ) THEN
    ALTER TABLE nations ADD COLUMN next_elections TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'autonomies'
  ) THEN
    ALTER TABLE nations ADD COLUMN autonomies INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'entry_tax'
  ) THEN
    ALTER TABLE nations ADD COLUMN entry_tax BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'borders_status'
  ) THEN
    ALTER TABLE nations ADD COLUMN borders_status TEXT DEFAULT 'open';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'residence_to_work'
  ) THEN
    ALTER TABLE nations ADD COLUMN residence_to_work TEXT DEFAULT 'Non necessaria';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'residence_policy'
  ) THEN
    ALTER TABLE nations ADD COLUMN residence_policy TEXT DEFAULT 'Aperta';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'energy_production'
  ) THEN
    ALTER TABLE nations ADD COLUMN energy_production BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'energy_consumption'
  ) THEN
    ALTER TABLE nations ADD COLUMN energy_consumption BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'foundation_date'
  ) THEN
    ALTER TABLE nations ADD COLUMN foundation_date TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'leader_salary'
  ) THEN
    ALTER TABLE nations ADD COLUMN leader_salary BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'minister_salary'
  ) THEN
    ALTER TABLE nations ADD COLUMN minister_salary BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'representative_image'
  ) THEN
    ALTER TABLE nations ADD COLUMN representative_image TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'best_department_name'
  ) THEN
    ALTER TABLE nations ADD COLUMN best_department_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nations' AND column_name = 'best_department_value'
  ) THEN
    ALTER TABLE nations ADD COLUMN best_department_value BIGINT DEFAULT 0;
  END IF;
END $$;

-- ── 3. Military Agreements table ──────────────────────────
-- Stores military alliances, defense pacts, bilateral agreements, coalitions.

CREATE TABLE IF NOT EXISTS military_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nation_id TEXT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
  partner_nation_id TEXT NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL DEFAULT 'alliance',
    -- 'alliance', 'defense_pact', 'bilateral', 'coalition'
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES users(id),
  UNIQUE(nation_id, partner_nation_id, agreement_type)
);

CREATE INDEX IF NOT EXISTS idx_military_agreements_nation
  ON military_agreements(nation_id);
CREATE INDEX IF NOT EXISTS idx_military_agreements_partner
  ON military_agreements(partner_nation_id);

-- ── 4. RLS Policies ──────────────────────────────────────

ALTER TABLE military_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Military agreements public read" ON military_agreements;
CREATE POLICY "Military agreements public read"
  ON military_agreements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Military agreements server manage" ON military_agreements;
CREATE POLICY "Military agreements server manage"
  ON military_agreements FOR ALL USING (true);

-- ── 5. Indexes for state page queries ─────────────────────

CREATE INDEX IF NOT EXISTS idx_nations_leader
  ON nations("leaderUserId");
CREATE INDEX IF NOT EXISTS idx_nations_economy_minister
  ON nations(economy_minister_id);
CREATE INDEX IF NOT EXISTS idx_nations_foreign_minister
  ON nations(foreign_minister_id);

-- ==========================================================
-- END OF MIGRATION
-- ==========================================================
