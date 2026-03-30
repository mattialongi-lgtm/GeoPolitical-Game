-- ============================================================
-- Migration: Sistema Dipartimenti di Stato
-- 
-- Crea due tabelle:
--   1. state_department_scores  → punteggio aggregato per nazione/dipartimento
--   2. player_department_contributions → contributo giornaliero del player (anti-duplice)
-- ============================================================

-- 1. Punteggi per Stato per dipartimento (aggregato)
CREATE TABLE IF NOT EXISTS state_department_scores (
  nation_id   TEXT        NOT NULL,
  department  TEXT        NOT NULL,
  score       BIGINT      NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (nation_id, department)
);

-- Indice per query di ranking globale per dipartimento
CREATE INDEX IF NOT EXISTS idx_sds_department_score
  ON state_department_scores (department, score DESC);

-- 2. Contributi giornalieri del player
CREATE TABLE IF NOT EXISTS player_department_contributions (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  player_id      TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nation_id      TEXT        NOT NULL,
  contributions  JSONB       NOT NULL,    -- es. {"oil": 7, "tank": 3}
  day_key        TEXT        NOT NULL,    -- es. '2026-03-30' (UTC date string YYYY-MM-DD)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  -- Anti-duplice: un solo submit al giorno per player (a prescindere dalla nazione)
  UNIQUE (player_id, day_key)
);

-- Indice per query rapida "ha già lavorato oggi?"
CREATE INDEX IF NOT EXISTS idx_pdc_player_day
  ON player_department_contributions (player_id, day_key);

-- Indice per query analytics per nazione
CREATE INDEX IF NOT EXISTS idx_pdc_nation_day
  ON player_department_contributions (nation_id, day_key);
