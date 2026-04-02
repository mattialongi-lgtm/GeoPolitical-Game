-- ============================================================
-- MIGRATION: Warehouse Resource History Performance & Schema
-- Description: Adds indexes for quick retrieval of item transaction history
--              from factory logs, market logs, and action logs.
-- ============================================================

-- 0. Ensure base action_logs table exists (Migrated from local SQLite schema)
CREATE TABLE IF NOT EXISTS public.action_logs (
    id BIGSERIAL PRIMARY KEY,
    "userId" UUID REFERENCES public.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details TEXT, -- Stores JSON metadata as a string (or JSONB if preferred, but TEXT matches SQLite)
    timestamp BIGINT NOT NULL
);

-- 1. Optimization for Factory Worker Logs (Extraction/Work history)
-- Ensures fast lookup by worker and resource type for the history view.
CREATE INDEX IF NOT EXISTS idx_factory_worker_history 
ON public.factory_worker_logs ("workerId", "resourceType", "workedAt" DESC);

-- 2. Optimization for Market Transactions Log (Purchase history)
-- Ensures fast lookup by buyer and item for the history view.
CREATE INDEX IF NOT EXISTS idx_market_buyer_history 
ON public.market_transactions_log ("buyerId", "itemId", "timestamp" DESC);

-- 3. Optimization for Action Logs (Withdrawals history)
-- Note: Action logs often store JSON in details/metadata. 
-- This index helps narrow down by user and action type.
CREATE INDEX IF NOT EXISTS idx_action_logs_user_history 
ON public.action_logs ("userId", "action", "timestamp" DESC);

-- 4. Ensure RLS policies allow reading these logs (Security hardening)
-- (These tables usually already have read policies, but we ensure them here)
ALTER TABLE IF EXISTS public.factory_worker_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_read_factory_logs" ON public.factory_worker_logs;
CREATE POLICY "history_read_factory_logs" ON public.factory_worker_logs 
FOR SELECT USING (auth.uid() = "workerId");

ALTER TABLE IF EXISTS public.market_transactions_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_read_market_logs" ON public.market_transactions_log;
CREATE POLICY "history_read_market_logs" ON public.market_transactions_log 
FOR SELECT USING (auth.uid()::text = "buyerId");

ALTER TABLE IF EXISTS public.action_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_read_action_logs" ON public.action_logs;
CREATE POLICY "history_read_action_logs" ON public.action_logs 
FOR SELECT USING (auth.uid()::text = "userId");
