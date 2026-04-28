-- ============================================================
-- Read-heavy rollups: player counts + extraction 24h aggregates
-- Goal: remove full scans + heavy JS aggregation from request path.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Player count rollups (incremental, trigger-maintained)
--    - region_player_counts: count users by users."regionId"
--    - nation_player_counts: count users by users."originalNation"
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.region_player_counts (
  "regionId" TEXT PRIMARY KEY,
  "playerCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.nation_player_counts (
  "nationId" TEXT PRIMARY KEY,
  "playerCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public._bump_region_player_count(p_region_id TEXT, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(trim(p_region_id), '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.region_player_counts ("regionId", "playerCount", "updatedAt")
  VALUES (p_region_id, GREATEST(0, COALESCE(p_delta, 0)), NOW())
  ON CONFLICT ("regionId") DO UPDATE
  SET
    "playerCount" = GREATEST(0, public.region_player_counts."playerCount" + COALESCE(EXCLUDED."playerCount", 0)),
    "updatedAt" = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public._bump_nation_player_count(p_nation_id TEXT, p_delta INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(trim(p_nation_id), '') = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.nation_player_counts ("nationId", "playerCount", "updatedAt")
  VALUES (p_nation_id, GREATEST(0, COALESCE(p_delta, 0)), NOW())
  ON CONFLICT ("nationId") DO UPDATE
  SET
    "playerCount" = GREATEST(0, public.nation_player_counts."playerCount" + COALESCE(EXCLUDED."playerCount", 0)),
    "updatedAt" = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_users_player_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._bump_region_player_count(NEW."regionId", 1);
    PERFORM public._bump_nation_player_count(NEW."originalNation", 1);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public._bump_region_player_count(OLD."regionId", -1);
    PERFORM public._bump_nation_player_count(OLD."originalNation", -1);
    RETURN OLD;
  END IF;

  -- UPDATE: apply delta only when keys change
  IF (NEW."regionId" IS DISTINCT FROM OLD."regionId") THEN
    PERFORM public._bump_region_player_count(OLD."regionId", -1);
    PERFORM public._bump_region_player_count(NEW."regionId", 1);
  END IF;

  IF (NEW."originalNation" IS DISTINCT FROM OLD."originalNation") THEN
    PERFORM public._bump_nation_player_count(OLD."originalNation", -1);
    PERFORM public._bump_nation_player_count(NEW."originalNation", 1);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_player_counts ON public.users;
CREATE TRIGGER trg_users_player_counts
AFTER INSERT OR UPDATE OF "regionId", "originalNation" OR DELETE
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.trg_users_player_counts();

CREATE OR REPLACE FUNCTION public.rpc_rebuild_player_counts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  TRUNCATE TABLE public.region_player_counts;
  TRUNCATE TABLE public.nation_player_counts;

  INSERT INTO public.region_player_counts ("regionId", "playerCount", "updatedAt")
  SELECT "regionId", COUNT(*)::INT, NOW()
  FROM public.users
  WHERE "regionId" IS NOT NULL AND trim("regionId") <> ''
  GROUP BY "regionId";

  INSERT INTO public.nation_player_counts ("nationId", "playerCount", "updatedAt")
  SELECT "originalNation", COUNT(*)::INT, NOW()
  FROM public.users
  WHERE "originalNation" IS NOT NULL AND trim("originalNation") <> ''
  GROUP BY "originalNation";

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_rebuild_player_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rebuild_player_counts() TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2) Extraction 24h rollups (materialized views + refresh RPC)
--    - mv_extraction_region_resource_24h: analytics24h per region/resource
--    - mv_extraction_player_region_24h: leaderboard per region (top extractors)
-- ─────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS public.mv_extraction_region_resource_24h;
CREATE MATERIALIZED VIEW public.mv_extraction_region_resource_24h AS
SELECT
  "regionId"        AS "regionId",
  "resourceType"    AS "resourceType",
  COUNT(*)::BIGINT  AS "extractionCount",
  SUM(COALESCE("grossAmount", 0))::NUMERIC       AS "totalExtracted",
  SUM(COALESCE("playerAmount", 0))::NUMERIC      AS "totalPlayerAmount",
  SUM(COALESCE("taxAmount", 0))::NUMERIC         AS "totalTaxAmount",
  SUM(COALESCE("stateAmount", 0))::NUMERIC       AS "totalStateAmount",
  SUM(COALESCE("autonomyAmount", 0))::NUMERIC    AS "totalAutonomyAmount",
  SUM(COALESCE("moneyGenerated", 0))::NUMERIC    AS "totalMoneyGenerated",
  SUM(COALESCE("withdrawnPoints", 0))::NUMERIC   AS "totalWithdrawnPoints",
  MAX("createdAt") AS "lastEventAt",
  NOW()            AS "refreshedAt"
FROM public.extraction_detailed_logs
WHERE "createdAt" >= (NOW() - INTERVAL '24 hours')
GROUP BY "regionId", "resourceType";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_extraction_region_resource_24h_pk
ON public.mv_extraction_region_resource_24h ("regionId", "resourceType");

CREATE INDEX IF NOT EXISTS idx_mv_extraction_region_resource_24h_region
ON public.mv_extraction_region_resource_24h ("regionId");

DROP MATERIALIZED VIEW IF EXISTS public.mv_extraction_player_region_24h;
CREATE MATERIALIZED VIEW public.mv_extraction_player_region_24h AS
SELECT
  "regionId"       AS "regionId",
  "playerId"       AS "playerId",
  SUM(COALESCE("playerAmount", 0))::NUMERIC AS "totalPlayerAmount",
  MAX("createdAt") AS "lastEventAt",
  NOW()            AS "refreshedAt"
FROM public.extraction_detailed_logs
WHERE "createdAt" >= (NOW() - INTERVAL '24 hours')
GROUP BY "regionId", "playerId";

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_extraction_player_region_24h_pk
ON public.mv_extraction_player_region_24h ("regionId", "playerId");

CREATE INDEX IF NOT EXISTS idx_mv_extraction_player_region_24h_region_total
ON public.mv_extraction_player_region_24h ("regionId", "totalPlayerAmount" DESC);

CREATE OR REPLACE FUNCTION public.rpc_refresh_extraction_rollups_24h(p_concurrently BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(p_concurrently, TRUE) THEN
    BEGIN
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_extraction_region_resource_24h;
      REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_extraction_player_region_24h;
      RETURN jsonb_build_object('success', TRUE, 'mode', 'concurrently');
    EXCEPTION
      WHEN OTHERS THEN
        -- Fallback: non-concurrent refresh
        NULL;
    END;
  END IF;

  REFRESH MATERIALIZED VIEW public.mv_extraction_region_resource_24h;
  REFRESH MATERIALIZED VIEW public.mv_extraction_player_region_24h;

  RETURN jsonb_build_object('success', TRUE, 'mode', 'standard');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_refresh_extraction_rollups_24h(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_refresh_extraction_rollups_24h(BOOLEAN) TO service_role;

