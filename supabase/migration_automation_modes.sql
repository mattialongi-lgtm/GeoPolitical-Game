-- Automation modes for work and hourly training damage

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
