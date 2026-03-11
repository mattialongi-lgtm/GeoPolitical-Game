-- SCRIPT PER FISSARE LA REGIONE IT E IMPOSTARE IL DITTATORE
-- Sostituisci l'UUID dell'utente se necessario (User ID: 8d6b20c0-6b51-4d17-81d3-02b45d971eb1)

DO $$
DECLARE
    target_user_id UUID := '8d6b20c0-6b51-4d17-81d3-02b45d971eb1';
BEGIN
    -- 0. Assicura che la colonna nation_id esista in regions (fix per schema incompleto)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='regions' AND column_name='nation_id') THEN
        ALTER TABLE regions ADD COLUMN nation_id TEXT REFERENCES nations(id);
    END IF;

    -- 1. Assicura che la nazione 'IT' esista
    INSERT INTO nations (id, name, logo, "leaderUserId", "updatedAt")
    VALUES ('IT', 'Italia', '🇮🇹', target_user_id, extract(epoch from now())::bigint)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        "leaderUserId" = EXCLUDED."leaderUserId",
        "updatedAt" = EXCLUDED."updatedAt";

    -- 2. Assicura che la regione 'IT' esista
    INSERT INTO regions (id, name, population, stability, "leaderUserId", "nation_id", "governmentForm")
    VALUES ('IT', 'Italia', 60000000, 10, target_user_id, 'IT', 'DICTATORSHIP')
    ON CONFLICT (id) DO UPDATE SET
        "leaderUserId" = EXCLUDED."leaderUserId",
        "nation_id" = EXCLUDED."nation_id",
        "governmentForm" = EXCLUDED."governmentForm";

    -- 3. Collega la regione 'IT-RM' alla nazione 'IT'
    UPDATE regions SET "nation_id" = 'IT' WHERE id = 'IT-RM';

    -- 4. Assicura che esistano i budget
    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR")
    VALUES ('REGION', 'IT', 1000000)
    ON CONFLICT DO NOTHING;

    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR")
    VALUES ('NATION', 'IT', 10000000)
    ON CONFLICT DO NOTHING;

    INSERT INTO budgets ("ownerType", "ownerId", "moneyEUR")
    VALUES ('REGION', 'IT-RM', 500000)
    ON CONFLICT DO NOTHING;

END $$;
