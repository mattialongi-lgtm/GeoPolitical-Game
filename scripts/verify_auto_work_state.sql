-- Verify auto-work outcome for a single player/factory after an automation tick.
--
-- Good news: you no longer need to replace the same UUID in 6 places.
--
-- How to use:
-- 1. Edit ONLY the values inside `manual_input` below if you already know user/factory.
-- 2. If you leave them NULL, the script auto-selects the most recent active auto-work row.
-- 3. Run the whole file in Supabase SQL Editor.

drop table if exists tmp_verify_auto_work_params;

create temporary table tmp_verify_auto_work_params as
with manual_input as (
  select
    null::uuid as user_id,
    null::uuid as factory_id,
    null::text as region_id,
    null::text as nation_id
),
auto_detect as (
  select
    awa."userId" as user_id,
    awa."factoryId" as factory_id,
    f."regionId" as region_id,
    r.nation_id as nation_id,
    awa."activatedAt",
    awa."lastFiredAt"
  from work_auto_actions awa
  join factories f on f.id = awa."factoryId"
  left join regions r on r.id = f."regionId"
  where awa."isActive" = true
  order by coalesce(awa."lastFiredAt", awa."activatedAt") desc nulls last
  limit 1
)
select
  coalesce(mi.user_id, ad.user_id) as user_id,
  coalesce(mi.factory_id, ad.factory_id) as factory_id,
  coalesce(mi.region_id, ad.region_id) as region_id,
  coalesce(mi.nation_id, ad.nation_id) as nation_id
from manual_input mi
cross join auto_detect ad;

-- ============================================================================
-- Effective params used by all checks
-- ============================================================================
select
  'CONFIG' as section,
  p.user_id,
  p.factory_id,
  p.region_id,
  p.nation_id
from tmp_verify_auto_work_params p;

-- ============================================================================
-- User energy / drinks / money / gold
-- ============================================================================
select
  'USER' as section,
  u.id,
  u.energy,
  u."energyDrinks",
  u."lastEnergyDrink",
  u.money,
  u.gold,
  u.xp,
  u.level
from users u
join tmp_verify_auto_work_params p on p.user_id = u.id;

-- ============================================================================
-- Active auto-work row
-- ============================================================================
select
  'AUTO_WORK' as section,
  awa.*
from work_auto_actions awa
join tmp_verify_auto_work_params p on p.user_id = awa."userId";

-- ============================================================================
-- Cooldown update proves the work cycle actually executed
-- ============================================================================
select
  'COOLDOWN' as section,
  ufc.*
from user_factory_cooldowns ufc
join tmp_verify_auto_work_params p
  on p.user_id = ufc."userId"
 and p.factory_id = ufc."factoryId";

-- ============================================================================
-- Player inventory for the worked factory resource
-- ============================================================================
select
  'PLAYER_INVENTORY' as section,
  ui."userId",
  ui."itemId",
  ui.quantity
from tmp_verify_auto_work_params p
join factories f on f.id = p.factory_id
left join user_inventory ui
  on ui."userId" = p.user_id
 and ui."itemId" = f.type;

-- ============================================================================
-- Work experience for the correct resource type
-- ============================================================================
select
  'WORK_EXP' as section,
  pre."playerId",
  pre."resourceType",
  pre.experience,
  (2000 + (coalesce(edu.level, 0) * 1000)) as work_exp_cap,
  least(coalesce(pre.experience, 0), (2000 + (coalesce(edu.level, 0) * 1000))) as effective_work_exp_for_bonus,
  round(1 + (least(coalesce(pre.experience, 0), (2000 + (coalesce(edu.level, 0) * 1000)))::numeric / 1000), 3) as experience_multiplier,
  50 as expected_xp_gain_per_300_energy_cycle,
  pre."totalExtractions",
  pre."lastWorkedAt"
from tmp_verify_auto_work_params p
join factories f on f.id = p.factory_id
left join perks edu
  on edu."userId" = p.user_id
 and edu."perkId" = 'ISTRUZIONE'
join player_resource_work_experience pre
  on pre."playerId" = p.user_id
 and pre."resourceType" = case when f.type = 'gold' then 'gold_ore' else f.type end;

-- ============================================================================
-- Factory storage / budget snapshot
-- ============================================================================
select
  'FACTORY' as section,
  f.id,
  f.type,
  f.level,
  f."currentStorage",
  f.budget,
  f."ownerUserId",
  f."regionId"
from factories f
join tmp_verify_auto_work_params p on p.factory_id = f.id;

-- ============================================================================
-- Latest worker logs for that player/factory
-- ============================================================================
select
  'WORKER_LOG' as section,
  fwl.*
from factory_worker_logs fwl
join tmp_verify_auto_work_params p
  on p.user_id = fwl."workerId"
 and p.factory_id = fwl."factoryId"
order by fwl."workedAt" desc nulls last
limit 10;

-- ============================================================================
-- Latest fiscal transactions for THIS auto-work cycle only
-- ============================================================================
select
  'BUDGET_TX' as section,
  b."ownerType",
  b."ownerId",
  bt.subtype,
  bt."moneyDelta",
  bt."resourcesDelta",
  bt.metadata,
  bt."createdAt"
from tmp_verify_auto_work_params p
join budgets b
  on (b."ownerType" = 'STATE' and b."ownerId" = p.nation_id)
  or (b."ownerType" = 'AUTONOMY' and b."ownerId" = p.region_id)
  or (b."ownerType" = 'REGION' and b."ownerId" = p.region_id)
join budget_transactions bt on bt."budgetId" = b.id
where bt.subtype in ('INDUSTRY_TAX', 'WORK_TAX', 'RESOURCE_TAX')
  and (
    bt."createdByUserId" = p.user_id
    or bt.metadata ->> 'factoryId' = p.factory_id::text
  )
order by bt."createdAt" desc
limit 25;

-- ============================================================================
-- One-line summary
-- ============================================================================
with latest_worker_log as (
  select
    fwl."workedAt",
    fwl."resourceType",
    fwl."resourceAmount",
    fwl."earningsMoney",
    fwl."earningsGold"
  from factory_worker_logs fwl
  join tmp_verify_auto_work_params p
    on p.user_id = fwl."workerId"
   and p.factory_id = fwl."factoryId"
  order by fwl."workedAt" desc nulls last
  limit 1
),
latest_budget_tx as (
  select
    bt.subtype,
    bt."createdAt"
  from tmp_verify_auto_work_params p
  join budgets b
    on (b."ownerType" = 'STATE' and b."ownerId" = p.nation_id)
    or (b."ownerType" = 'AUTONOMY' and b."ownerId" = p.region_id)
    or (b."ownerType" = 'REGION' and b."ownerId" = p.region_id)
  join budget_transactions bt on bt."budgetId" = b.id
  where bt.subtype in ('INDUSTRY_TAX', 'WORK_TAX', 'RESOURCE_TAX')
    and (
      bt."createdByUserId" = p.user_id
      or bt.metadata ->> 'factoryId' = p.factory_id::text
    )
  order by bt."createdAt" desc
  limit 1
)
select
  'SUMMARY' as section,
  p.user_id,
  p.factory_id,
  f.type as factory_type,
  case when f.type = 'gold' then 'gold_ore' else f.type end as expected_exp_resource,
  50 as expected_work_exp_gain,
  awa."isActive" as auto_work_active,
  awa."lastFiredAt" as auto_work_last_fired_at,
  ufc."lastUsed" as cooldown_last_used,
  lwl."workedAt" as latest_worker_log_at,
  lwl."resourceType" as latest_worker_resource_type,
  lwl."resourceAmount" as latest_worker_resource_amount,
  ui.quantity as player_inventory_qty,
  pre.experience as work_experience,
  round(1 + (coalesce(pre.experience, 0)::numeric / 1000), 3) as experience_multiplier,
  lbt.subtype as latest_tax_subtype,
  lbt."createdAt" as latest_tax_created_at,
  (lwl."workedAt" is not null) as has_worker_log,
  (coalesce(lwl."resourceAmount", 0) > 0 or coalesce(lwl."earningsMoney", 0) > 0 or coalesce(lwl."earningsGold", 0) > 0) as has_real_payout,
  (pre.experience is not null) as has_work_experience_row,
  (coalesce(ui.quantity, 0) > 0) as has_inventory_row,
  (lbt.subtype is not null) as has_tax_tx
from tmp_verify_auto_work_params p
join factories f on f.id = p.factory_id
left join work_auto_actions awa on awa."userId" = p.user_id
left join user_factory_cooldowns ufc
  on ufc."userId" = p.user_id
 and ufc."factoryId" = p.factory_id
left join user_inventory ui
  on ui."userId" = p.user_id
 and ui."itemId" = f.type
left join player_resource_work_experience pre
  on pre."playerId" = p.user_id
 and pre."resourceType" = case when f.type = 'gold' then 'gold_ore' else f.type end
left join latest_worker_log lwl on true
left join latest_budget_tx lbt on true;
