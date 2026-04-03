-- ══════════════════════════════════════════════════════════════════
-- migration_migration_agreements_fix.sql
-- Adds missing columns to migration_agreements table.
-- The full_schema.sql defined only 5 columns but the server code
-- inserts 9 fields; the missing ones caused every upsert to fail
-- silently, so no agreement was ever persisted.
-- IDEMPOTENT — safe to run multiple times.
-- ══════════════════════════════════════════════════════════════════

-- Add missing columns
ALTER TABLE migration_agreements ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'UNILATERAL';
ALTER TABLE migration_agreements ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE migration_agreements ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE migration_agreements ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMPTZ;
ALTER TABLE migration_agreements ADD COLUMN IF NOT EXISTS "sourceLawId" TEXT;

-- Ensure RLS allows server-side reads/writes (service_role bypasses RLS,
-- but explicit policies guard anon/authenticated access)
ALTER TABLE migration_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "migration_agreements_read" ON migration_agreements;
CREATE POLICY "migration_agreements_read" ON migration_agreements
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "migration_agreements_write" ON migration_agreements;
CREATE POLICY "migration_agreements_write" ON migration_agreements
    FOR ALL USING (true);
