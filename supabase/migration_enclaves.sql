-- ==========================================
-- MIGRAZIONE: Sistema Enclavi / Micro-Regioni
-- DESCRIZIONE: Aggiunge flag e coordinate marker per regioni enclave
-- ISTRUZIONI: Eseguire su Supabase SQL Editor
-- ==========================================

-- 1. Aggiunta colonne enclave alla tabella regions
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "isEnclave" BOOLEAN DEFAULT FALSE;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "enclaveMarkerLat" FLOAT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "enclaveMarkerLng" FLOAT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS "enclaveMarkerSize" FLOAT DEFAULT 6;

-- 2. Indice per ricerca rapida enclavi
CREATE INDEX IF NOT EXISTS idx_regions_is_enclave ON regions("isEnclave") WHERE "isEnclave" = TRUE;

-- 3. Seed dati enclavi note (micro-stati e città-stato)
-- Vatican City
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 41.90, "enclaveMarkerLng" = 12.45, "enclaveMarkerSize" = 6 WHERE id = 'VA';
-- San Marino
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 43.94, "enclaveMarkerLng" = 12.46, "enclaveMarkerSize" = 6 WHERE id = 'SM';
-- Monaco
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 43.73, "enclaveMarkerLng" = 7.42, "enclaveMarkerSize" = 6 WHERE id = 'MC';
-- Liechtenstein
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 47.14, "enclaveMarkerLng" = 9.55, "enclaveMarkerSize" = 6 WHERE id = 'LI';
-- Andorra
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 42.54, "enclaveMarkerLng" = 1.58, "enclaveMarkerSize" = 6 WHERE id = 'AD';
-- Malta
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 35.94, "enclaveMarkerLng" = 14.40, "enclaveMarkerSize" = 6 WHERE id = 'MT';
-- Luxembourg
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 49.82, "enclaveMarkerLng" = 6.13, "enclaveMarkerSize" = 6 WHERE id = 'LU';
-- Bahrain
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 26.07, "enclaveMarkerLng" = 50.55, "enclaveMarkerSize" = 6 WHERE id = 'BH';
-- Singapore
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 1.35, "enclaveMarkerLng" = 103.82, "enclaveMarkerSize" = 6 WHERE id = 'SG';
-- Macao
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 22.20, "enclaveMarkerLng" = 113.54, "enclaveMarkerSize" = 6 WHERE id = 'MO';
-- Hong Kong
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 22.32, "enclaveMarkerLng" = 114.17, "enclaveMarkerSize" = 6 WHERE id = 'HK';
-- Brunei
UPDATE regions SET "isEnclave" = TRUE, "enclaveMarkerLat" = 4.94, "enclaveMarkerLng" = 114.95, "enclaveMarkerSize" = 6 WHERE id = 'BN';
