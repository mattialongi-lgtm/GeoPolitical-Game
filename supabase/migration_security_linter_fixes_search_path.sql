-- ==========================================================
-- Migration: Security Linter Fixes - Function Search Path Hardening
-- Detects and fixes 'Function Search Path Mutable' issues
-- for create_market_offer and upgrade_factory.
-- ==========================================================

-- 1. Hardening create_market_offer
-- Note: We re-apply the full function to ensure SET search_path is set.
DO $$
BEGIN
  IF to_regprocedure('public.create_market_offer(text, text, integer, bigint, text, integer, text)') IS NOT NULL THEN
    ALTER FUNCTION public.create_market_offer(text, text, integer, bigint, text, integer, text) SET search_path = public;
  END IF;
END $$;

-- 2. Hardening purchase_market_offer (Good practice to secure both)
DO $$
BEGIN
  IF to_regprocedure('public.purchase_market_offer(text, text, integer, boolean, text)') IS NOT NULL THEN
    ALTER FUNCTION public.purchase_market_offer(text, text, integer, boolean, text) SET search_path = public;
  END IF;
END $$;

-- 3. Hardening upgrade_factory
DO $$
BEGIN
  IF to_regprocedure('public.upgrade_factory(uuid, integer, uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.upgrade_factory(uuid, integer, uuid) SET search_path = public;
  END IF;
END $$;

-- Summary: This migration file ensures the specified functions have a fixed search_path,
-- resolving the 'Function Search Path Mutable' security warning.
