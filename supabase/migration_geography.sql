-- ==========================================
-- MIGRAZIONE: Dati Geografici Regioni
-- DESCRIZIONE: Aggiunge coordinate, confini e costa alle regioni
-- ISTRUZIONI: Eseguire su Supabase SQL Editor
-- ==========================================

ALTER TABLE regions ADD COLUMN IF NOT EXISTS "borders" TEXT[] DEFAULT '{}';
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "coastline" BOOLEAN DEFAULT false;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "lat" FLOAT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "lng" FLOAT;

-- Creazione indice per ricerca geografica
CREATE INDEX IF NOT EXISTS idx_regions_borders ON regions USING GIN ("borders");
CREATE INDEX IF NOT EXISTS idx_regions_coastline ON regions("coastline");
