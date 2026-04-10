# Database

> **Navigation aid.** Schema shapes and field types extracted via AST. Read the actual schema source files before writing migrations or query logic.

**unknown** — 91 models

### users

pk: `id` (uuid) · fk: regionId, residenceId, workPermitId

- `id`: uuid _(pk)_
- `email`: text _(unique)_
- `money`: bigint _(default)_
- `gold`: bigint _(default)_
- `energy`: integer _(default)_
- `influence`: bigint _(default)_
- `regionId`: text _(default, fk)_
- `residenceId`: text _(default, fk)_
- `workPermitId`: text _(fk)_
- `originalNation`: text _(default)_
- `displayedNation`: text _(default)_
- `lastOriginalNationChange`: bigint _(default)_
- `lastEnergyUpdate`: bigint
- `xp`: bigint _(default)_
- `level`: integer _(default)_
- `perkPoints`: integer _(default)_
- `avatarData`: text
- `energyDrinks`: integer _(default)_
- `lastEnergyDrink`: bigint _(default)_
- `warMedals`: integer _(default)_
- `lastMedalClaim`: bigint _(default)_
- `lastLogin`: bigint _(default)_
- `perkUpgradesJson`: text _(default)_
- `boostersJson`: text _(default)_
- `travelingTo`: text _(default)_
- `travelingUntil`: bigint _(default)_
- `travelingFrom`: text _(default)_
- `travelDurationMs`: bigint _(default)_
- `militaryExp`: integer _(default)_

### nations

pk: `id` (text) · fk: leaderUserId

- `id`: text _(pk)_
- `name`: text
- `logo`: text _(default)_
- `leaderUserId`: uuid _(fk)_

### regions

pk: `id` (text)

- `id`: text _(pk)_

### budgets

pk: `id` (uuid)

- `id`: uuid _(pk)_
- `ownerType`: text
- `resources`: jsonb _(default)_

### budget_transactions

pk: `id` (text) · fk: budgetId, createdByUserId

- `id`: text _(pk)_
- `budgetId`: uuid _(fk)_
- `type`: text
- `subtype`: text
- `moneyDelta`: bigint _(default)_
- `resourcesDelta`: jsonb _(default)_
- `createdByUserId`: uuid _(fk)_
- `metadata`: jsonb _(default)_

### regional_buildings

pk: `id` (uuid) · fk: regionId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `buildingType`: text _(required)_
- `quantity`: integer _(default)_
- `level`: integer _(default)_

### regional_parliament_members

pk: `id` (uuid) · fk: regionId, userId, partyId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `userId`: uuid _(required, fk)_
- `partyId`: uuid _(fk)_
- `electedAt`: timestamp(tz) _(default)_
- `termEndsAt`: timestamp(tz)

### regional_laws

pk: `id` (text) · fk: regionId, proposerId

- `id`: text _(pk)_
- `regionId`: text _(required, fk)_
- `proposerId`: uuid _(required, fk)_
- `type`: text _(required)_
- `params`: jsonb _(default)_
- `status`: text _(default)_
- `expiresAt`: timestamp(tz)

### regional_law_votes

fk: lawId, voterId

- `lawId`: text _(required, fk)_
- `voterId`: uuid _(required, fk)_
- `vote`: text _(required)_

### regional_budget_transactions

pk: `id` (uuid) · fk: regionId, createdByUserId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `type`: text _(required)_
- `subtype`: text
- `moneyDelta`: bigint _(default)_
- `description`: text
- `createdByUserId`: uuid _(fk)_
- `metadata`: jsonb _(default)_

### autonomy_history

pk: `id` (uuid) · fk: regionId, performedByUserId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `action`: text _(required)_
- `performedByUserId`: uuid _(fk)_
- `details`: jsonb _(default)_

### factories

pk: `id` (uuid) · fk: regionId, ownerUserId

- `id`: uuid _(pk)_
- `name`: text
- `type`: text
- `regionId`: text _(fk)_
- `ownerUserId`: uuid _(fk)_
- `wage`: bigint _(default)_
- `budget`: bigint _(default)_
- `payMode`: text _(default)_

### user_factory_cooldowns

fk: userId, factoryId

- `userId`: uuid _(fk)_
- `factoryId`: uuid _(fk)_
- `lastUsed`: timestamp(tz) _(default)_

### work_auto_actions

pk: `id` (uuid) · fk: userId, factoryId

- `id`: uuid _(pk)_
- `userId`: uuid _(required, fk)_
- `factoryId`: uuid _(required, fk)_
- `mode`: text _(required)_
- `isActive`: boolean _(required)_
- `lastFiredAt`: timestamp(tz)
- `activatedAt`: timestamp(tz) _(required)_
- `expiresAt`: timestamp(tz)

### training_auto_actions

pk: `id` (uuid) · fk: userId

- `id`: uuid _(pk)_
- `userId`: uuid _(required, fk)_
- `mode`: text _(required)_
- `isActive`: boolean _(required)_
- `lastFiredAt`: timestamp(tz)
- `activatedAt`: timestamp(tz) _(required)_
- `expiresAt`: timestamp(tz)

### market_offers

pk: `id` (text) · fk: sellerId, itemId, regionId, originStateId

- `id`: text _(pk)_
- `sellerId`: uuid _(fk)_
- `sellerName`: text
- `itemId`: text _(fk)_
- `quantity`: integer
- `price`: bigint
- `regionId`: text _(fk)_
- `taxRate`: integer _(default)_
- `originStateId`: text _(fk)_

### cooldowns

fk: user_id

- `user_id`: uuid _(fk)_
- `action_type`: text
- `last_used`: timestamp(tz) _(default)_

### applications

pk: `id` (text) · fk: userId, regionId

- `id`: text _(pk)_
- `userId`: uuid _(fk)_
- `username`: text
- `regionId`: text _(fk)_
- `type`: text
- `status`: text _(default)_

### wars

pk: `id` (text) · fk: attackerUserId, defenderUserId

- `id`: text _(pk)_
- `attackerCountryIso2`: text
- `defenderCountryIso2`: text
- `attackerUserId`: uuid _(fk)_
- `defenderUserId`: uuid _(fk)_
- `status`: text
- `startedAt`: timestamp(tz) _(default)_
- `endsAt`: timestamp(tz) _(default)_
- `attackerScore`: bigint _(default)_
- `defenderScore`: bigint _(default)_
- `lastEventAt`: timestamp(tz)

### leader_orders

pk: `id` (integer(auto)) · fk: regionId, leaderId

- `id`: integer(auto) _(pk)_
- `regionId`: text _(fk)_
- `leaderId`: uuid _(fk)_
- `title`: text
- `content`: text

### migration_agreements

pk: `id` (uuid) · fk: fromStateId, toStateId

- `id`: uuid _(pk)_
- `fromStateId`: text _(fk)_
- `toStateId`: text _(fk)_
- `status`: text _(default)_
- `activatedAt`: timestamp(tz) _(default)_

### perks

fk: userId, perkId

- `userId`: uuid _(fk)_
- `perkId`: text _(required, fk)_
- `level`: integer _(default)_

### chat_messages

pk: `id` (uuid) · fk: userId, regionId

- `id`: uuid _(pk)_
- `userId`: uuid _(fk)_
- `username`: text
- `regionId`: text _(fk)_
- `channel`: text _(default)_
- `message`: text _(required)_

### articles

pk: `id` (text) · fk: authorId

- `id`: text _(pk)_
- `authorId`: uuid _(fk)_
- `authorName`: text
- `title`: text _(required)_
- `content`: text _(required)_
- `section`: text _(default)_
- `likeCount`: integer _(default)_

### article_comments

pk: `id` (uuid) · fk: articleId, authorId

- `id`: uuid _(pk)_
- `articleId`: text _(required, fk)_
- `authorId`: uuid _(required, fk)_
- `authorName`: text _(required)_
- `content`: text _(required)_

### article_votes

pk: `id` (uuid) · fk: articleId, userId

- `id`: uuid _(pk)_
- `articleId`: text _(required, fk)_
- `userId`: uuid _(required, fk)_
- `vote`: text _(required)_

### parties

pk: `id` (text) · fk: regionId, leaderUserId

- `id`: text _(pk)_
- `name`: text _(required)_
- `ideology`: text _(default)_
- `tag`: text _(default)_
- `description`: text _(default)_
- `logo`: text _(default)_
- `regionId`: text _(fk)_
- `leaderUserId`: uuid _(fk)_

### party_members

fk: userId, partyId

- `userId`: uuid _(fk)_
- `partyId`: text _(fk)_
- `role`: text _(default)_
- `salaryCash`: bigint _(default)_
- `salaryGold`: bigint _(default)_
- `joinedAt`: bigint

### party_logs

pk: `id` (text) · fk: partyId

- `id`: text _(pk)_
- `partyId`: text _(fk)_
- `action`: text
- `details`: text
- `timestamp`: bigint

### party_invites

pk: `id` (text) · fk: partyId, userId, invitedBy

- `id`: text _(pk)_
- `partyId`: text _(fk)_
- `userId`: uuid _(fk)_
- `invitedBy`: uuid _(fk)_
- `status`: text _(default)_

### party_primaries

pk: `id` (text) · fk: partyId, candidateId, voterId

- `id`: text _(pk)_
- `partyId`: text _(fk)_
- `candidateId`: uuid _(fk)_
- `voterId`: uuid _(fk)_

### user_inventory

fk: userId, itemId

- `userId`: uuid _(fk)_
- `itemId`: text _(required, fk)_
- `quantity`: integer _(default)_

### messages

pk: `id` (uuid) · fk: senderId, receiverId

- `id`: uuid _(pk)_
- `senderId`: uuid _(fk)_
- `senderName`: text _(required)_
- `receiverId`: uuid _(fk)_
- `receiverName`: text _(required)_
- `subject`: text _(default)_
- `body`: text _(required)_
- `read`: boolean _(default)_

### elections

pk: `id` (text) · fk: regionId

- `id`: text _(pk)_
- `regionId`: text _(fk)_
- `status`: text _(default)_
- `closesAt`: timestamp(tz)

### election_votes

pk: `id` (text) · fk: electionId, voterId, partyId

- `id`: text _(pk)_
- `electionId`: text _(fk)_
- `voterId`: uuid _(fk)_
- `partyId`: text _(fk)_
- `timestamp`: timestamp(tz) _(default)_

### parliament_members

fk: userId, regionId, partyId

- `userId`: uuid _(fk)_
- `regionId`: text _(fk)_
- `partyId`: text _(fk)_
- `electedAt`: timestamp(tz) _(default)_

### laws

pk: `id` (text) · fk: regionId, proposerId

- `id`: text _(pk)_
- `regionId`: text _(fk)_
- `proposerId`: uuid _(fk)_
- `type`: text
- `params`: jsonb _(default)_
- `status`: text _(default)_
- `expiresAt`: timestamp(tz)

### law_votes

fk: lawId, voterId

- `lawId`: text _(fk)_
- `voterId`: uuid _(fk)_
- `vote`: text

### leader_candidates

fk: regionId, userId

- `regionId`: text _(fk)_
- `userId`: uuid _(fk)_
- `votes`: integer _(default)_

### leader_votes

fk: regionId, voterId, candidateId

- `regionId`: text _(fk)_
- `voterId`: uuid _(fk)_
- `candidateId`: uuid _(fk)_

### work_permits

pk: `id` (uuid) · fk: userId, regionId

- `id`: uuid _(pk)_
- `userId`: uuid _(fk)_
- `regionId`: text _(fk)_

### sanctions

pk: `id` (text) · fk: fromStateId, targetStateId, createdByUserId, revokedByUserId

- `id`: text _(pk)_
- `fromStateId`: text _(fk)_
- `targetStateId`: text _(fk)_
- `status`: text _(default)_
- `createdByUserId`: uuid _(fk)_
- `revokedAt`: timestamp(tz)
- `revokedByUserId`: uuid _(fk)_

### blocs

pk: `id` (text) · fk: ownerStateId, ownerUserId

- `id`: text _(pk)_
- `name`: text _(unique)_
- `logo`: text _(default)_
- `description`: text _(default)_
- `ownerStateId`: text _(fk)_
- `ownerUserId`: uuid _(fk)_

### bloc_memberships

fk: blocId, stateId

- `blocId`: text _(fk)_
- `stateId`: text _(fk)_
- `status`: text _(default)_
- `joinedAt`: timestamp(tz) _(default)_

### bloc_applications

pk: `id` (text) · fk: blocId, stateId

- `id`: text _(pk)_
- `blocId`: text _(fk)_
- `stateId`: text _(fk)_
- `status`: text _(default)_

### bloc_regulations

pk: `blocId` (text) · fk: blocId

- `blocId`: text _(pk, fk)_
- `openBorders`: integer _(default)_
- `defaultMilitaryAgreement`: integer _(default)_
- `migrationOpen`: integer _(default)_

### bloc_regulation_proposals

pk: `id` (text) · fk: blocId

- `id`: text _(pk)_
- `blocId`: text _(fk)_
- `type`: text
- `proposedValue`: integer
- `status`: text _(default)_

### bloc_votes

fk: targetId, voterStateId

- `targetId`: text _(required, fk)_
- `voterStateId`: text _(fk)_
- `choice`: integer _(default)_

### production_queue

pk: `id` (text) · fk: userId

- `id`: text _(pk)_
- `userId`: uuid _(fk)_
- `weaponType`: text
- `qty`: integer _(default)_
- `status`: text _(default)_
- `startedAt`: timestamp(tz)
- `willCompleteAt`: timestamp(tz)

### ministers

pk: `id` (text) · fk: stateId, userId, assignedByUserId

- `id`: text _(pk)_
- `stateId`: text _(fk)_
- `userId`: uuid _(fk)_
- `role`: text
- `title`: text
- `assignedByUserId`: uuid _(fk)_
- `assignedAt`: bigint
- `status`: text _(default)_

### market_transactions_log

pk: `id` (text) · fk: buyerId, sellerId, itemId

- `id`: text _(pk)_
- `buyerId`: text _(fk)_
- `isStateBuy`: integer _(default)_
- `sellerId`: text _(fk)_
- `itemId`: text _(fk)_
- `quantity`: integer
- `price`: bigint
- `taxPaid`: bigint _(default)_
- `timestamp`: bigint

### game_settings

- `value`: jsonb _(required)_
- `description`: text

### deep_levels

pk: `level` (integer)

- `level`: integer _(pk)_
- `targetCap`: integer _(required)_
- `enabled`: boolean _(default)_
- `description`: text

### region_resources

fk: regionId

- `regionId`: text _(fk)_
- `resourceType`: text _(required)_
- `dailyAvailable`: integer _(required)_

### player_extraction_state

fk: playerId, regionId

- `playerId`: uuid _(fk)_
- `regionId`: text _(fk)_
- `resourceType`: text _(required)_
- `extractedSinceLastRecharge`: integer _(required)_

### resource_recharges

fk: regionId, rechargedByUserId

- `regionId`: text _(fk)_
- `resourceType`: text _(required)_
- `lastRechargeAt`: timestamp(tz) _(default)_
- `rechargedByUserId`: uuid _(fk)_

### deep_explorations

pk: `id` (text) · fk: nationId, activatedByUserId

- `id`: text _(pk)_
- `nationId`: text _(required, fk)_
- `resourceType`: text _(required)_
- `level`: integer _(required)_
- `targetCap`: integer _(required)_
- `activatedByUserId`: uuid _(fk)_
- `startsAt`: timestamp(tz) _(required)_
- `endsAt`: timestamp(tz) _(required)_
- `isActive`: boolean _(required)_
- `costDiamonds`: integer _(default)_
- `costEur`: integer _(default)_
- `costGold`: integer _(default)_

### resource_extraction_logs

pk: `id` (bigint(auto)) · fk: playerId, regionId

- `id`: bigint(auto) _(pk)_
- `playerId`: uuid _(fk)_
- `regionId`: text _(fk)_
- `resourceType`: text _(required)_
- `amount`: integer _(required)_

### revolution_lobbies

pk: `id` (uuid) · fk: regionId, creatorId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `lobbyType`: text _(required)_
- `creatorId`: uuid _(required, fk)_
- `requiredPlayers`: integer _(required)_
- `status`: text _(required)_
- `goldCostPerPlayer`: integer _(required)_
- `expiresAt`: timestamp(tz)

### factory_upgrade_costs

pk: `level_to` (integer)

- `level_to`: integer _(pk)_
- `upgrade_cost`: integer _(required)_
- `aggregate_cost`: integer _(required)_
- `currency`: text _(required)_

### factory_upgrade_log

pk: `id` (uuid) · fk: factory_id, user_id

- `id`: uuid _(pk)_
- `factory_id`: uuid _(fk)_
- `user_id`: uuid _(fk)_
- `level_before`: integer
- `level_after`: integer
- `gold_cost`: integer

### player_resource_work_experience

fk: playerId

- `playerId`: uuid _(required, fk)_
- `resourceType`: text _(required)_
- `experience`: integer _(required)_
- `totalExtractions`: integer _(required)_
- `lastWorkedAt`: timestamp(tz) _(default)_

### extraction_detailed_logs

pk: `id` (bigint(auto)) · fk: playerId, regionId, factoryId

- `id`: bigint(auto) _(pk)_
- `playerId`: uuid _(required, fk)_
- `regionId`: text _(required, fk)_
- `factoryId`: uuid _(fk)_
- `resourceType`: text _(required)_
- `grossAmount`: numeric _(required)_
- `playerAmount`: numeric _(required)_
- `ownerAmount`: numeric _(required)_
- `taxAmount`: numeric _(required)_
- `stateAmount`: numeric _(required)_
- `autonomyAmount`: numeric _(required)_
- `moneyGenerated`: numeric _(required)_
- `withdrawnPoints`: numeric _(required)_
- `playerLevel`: integer _(required)_
- `factoryLevel`: integer _(required)_
- `workExperience`: integer _(required)_
- `resourceCoefficient`: numeric _(required)_
- `finalProductivity`: numeric _(required)_

### resource_department_bonuses

fk: regionId

- `regionId`: text _(required, fk)_
- `resourceType`: text _(required)_
- `bonusLevel`: integer _(required)_

### factory_market_listings

pk: `id` (uuid) · fk: factoryId, sellerId, buyerId

- `id`: uuid _(pk)_
- `factoryId`: uuid _(required, fk)_
- `sellerId`: uuid _(required, fk)_
- `askingPrice`: bigint _(required)_
- `listedAt`: timestamp(tz) _(default)_
- `status`: text _(default)_
- `buyerId`: uuid _(fk)_
- `soldAt`: timestamp(tz)

### factory_economy_logs

pk: `id` (uuid) · fk: factoryId

- `id`: uuid _(pk)_
- `factoryId`: uuid _(required, fk)_
- `logDate`: date _(required)_
- `workerCount`: integer _(default)_
- `grossIncome`: bigint _(default)_
- `taxesPaid`: bigint _(default)_
- `ownerProfit`: bigint _(default)_
- `production`: bigint _(default)_

### factory_worker_logs

pk: `id` (uuid) · fk: factoryId, workerId

- `id`: uuid _(pk)_
- `factoryId`: uuid _(required, fk)_
- `workerId`: uuid _(required, fk)_
- `workedAt`: timestamp(tz) _(default)_
- `earningsMoney`: bigint _(default)_
- `earningsGold`: numeric(12
- `resourceType`: text
- `resourceAmount`: bigint _(default)_
- `ownerCut`: bigint _(default)_

### daily_auto_work

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `resource_type`: text _(required)_
- `active`: boolean _(required)_
- `started_at`: bigint
- `energy_cost`: integer _(default)_

### daily_damage_log

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `target_type`: text _(required)_
- `active_event`: target_id text
- `xp_gained`: numeric _(required)_

### military_academy_claims

pk: `id` (uuid) · fk: user_id, region_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `region_id`: text _(required, fk)_
- `claimed_date`: date _(required)_
- `rewards`: jsonb _(required)_

### work_streaks

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `current_streak`: integer _(required)_
- `longest_streak`: integer _(required)_
- `last_work_date`: date

### free_reward_claims

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `source`: text _(required)_
- `other`: source_label text
- `reward_type`: text _(required)_
- `xp`: amount numeric _(required)_
- `claimed_at`: timestamp(tz) _(required)_

### daily_task_completions

pk: `id` (uuid) · fk: user_id, task_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `task_id`: text _(required, fk)_
- `completed_date`: date _(required)_
- `completed_at`: timestamp(tz) _(required)_

### periodic_reward_progress

pk: `id` (uuid) · fk: user_id, reward_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `reward_id`: text _(required, fk)_
- `total_days_required`: integer _(required)_
- `claimed`: boolean _(required)_
- `last_counted_date`: date

### streak_milestone_claims

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk)_
- `user_id`: uuid _(required, fk)_
- `milestone_days`: integer _(required)_
- `reward_type`: text _(required)_
- `reward_amount`: numeric _(required)_
- `claimed_at`: timestamp(tz) _(required)_

### daily_missions

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk, default)_
- `user_id`: uuid _(required, fk)_
- `mission_key`: text _(required)_
- `title`: text _(required)_
- `description`: text _(required)_
- `category`: text _(required)_
- `icon`: text _(required)_
- `target`: integer _(required)_
- `progress`: integer _(required)_
- `status`: text _(required)_
- `reward`: jsonb _(required)_
- `route`: text
- `reset_date`: date _(required)_

### daily_mission_bonus_claims

pk: `id` (uuid) · fk: user_id

- `id`: uuid _(pk, default)_
- `user_id`: uuid _(required, fk)_
- `claim_date`: date _(required)_
- `reward`: jsonb _(required)_
- `claimed_at`: timestamp(tz) _(required)_

### state_department_scores

fk: nation_id

- `nation_id`: text _(required, fk)_
- `department`: text _(required)_
- `score`: bigint _(required)_

### player_department_contributions

fk: player_id, nation_id

- `id`: uuid _(required)_
- `player_id`: text _(required, fk)_
- `nation_id`: text _(required, fk)_
- `contributions`: jsonb _(required)_

### newspapers

pk: `id` (text) · fk: ownerId

- `id`: text _(pk)_
- `name`: text _(required)_
- `description`: text
- `logoUrl`: text
- `ownerId`: uuid _(fk)_

### newspaper_members

pk: `id` (uuid) · fk: newspaperId, userId

- `id`: uuid _(pk)_
- `newspaperId`: text _(fk)_
- `userId`: uuid _(fk)_
- `role`: text _(required)_
- `status`: text _(default)_
- `joinedAt`: timestamp(tz) _(default)_

### military_agreements

pk: `id` (uuid) · fk: nation_id, partner_nation_id, created_by_user_id

- `id`: uuid _(pk)_
- `nation_id`: text _(required, fk)_
- `partner_nation_id`: text _(required, fk)_
- `agreement_type`: text _(required)_
- `coalition`: status text _(required)_
- `expires_at`: timestamp(tz)
- `created_by_user_id`: uuid _(fk)_

### action_logs

pk: `id` (bigint(auto)) · fk: userId

- `id`: bigint(auto) _(pk)_
- `userId`: uuid _(fk)_
- `action`: text _(required)_
- `details`: text
- `but`: text matches sqlite

### war_participants

pk: `id` (uuid) · fk: warId, userId

- `id`: uuid _(pk)_
- `warId`: text _(required, fk)_
- `userId`: uuid _(required, fk)_
- `side`: text _(required)_
- `totalDamage`: bigint _(default)_
- `troopsDeployed`: jsonb _(default)_
- `joinedAt`: timestamp(tz) _(default)_

### war_deployments

pk: `id` (uuid) · fk: warId, userId

- `id`: uuid _(pk)_
- `warId`: text _(required, fk)_
- `userId`: uuid _(required, fk)_
- `side`: text _(required)_
- `troopType`: text _(required)_
- `quantity`: integer _(required)_
- `baseDamage`: bigint _(required)_
- `finalDamage`: bigint _(required)_
- `bonuses`: jsonb _(default)_
- `deployedAt`: timestamp(tz) _(default)_

### war_auto_attacks

pk: `id` (uuid) · fk: warId, userId

- `id`: uuid _(pk)_
- `warId`: text _(required, fk)_
- `userId`: uuid _(required, fk)_
- `side`: text _(required)_
- `autoType`: text _(required)_
- `troopType`: text _(required)_
- `isActive`: boolean _(default)_
- `lastFiredAt`: timestamp(tz)
- `activatedAt`: timestamp(tz) _(default)_
- `expiresAt`: timestamp(tz)

### revolutions

pk: `id` (uuid) · fk: regionId, warId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `goldCost`: integer _(required)_
- `status`: text _(required)_
- `warId`: text _(fk)_
- `cooldownUntil`: timestamp(tz)
- `resolvedAt`: timestamp(tz)

### coups

pk: `id` (uuid) · fk: regionId, warId

- `id`: uuid _(pk)_
- `regionId`: text _(required, fk)_
- `status`: text _(required)_
- `warId`: text _(fk)_
- `resolvedAt`: timestamp(tz)

### war_military_agreements

pk: `id` (uuid)

- `id`: uuid _(pk)_
- `stateA`: text _(required)_
- `stateB`: text _(required)_
- `agreementType`: text _(required)_
- `initiatorState`: text _(required)_
- `status`: text _(required)_
- `expiresAt`: timestamp(tz)

### war_departments

pk: `id` (uuid) · fk: stateId

- `id`: uuid _(pk)_
- `stateId`: text _(required, fk)_
- `departmentType`: text _(required)_
- `level`: integer _(required)_
- `bonusPercent`: numeric(5
- `ranking`: integer _(default)_

### war_history

pk: `id` (uuid) · fk: warId

- `id`: uuid _(pk)_
- `warId`: text _(required, fk)_
- `eventType`: text _(required)_
- `eventData`: jsonb _(default)_

## Schema Source Files

Search for ORM schema declarations:
- Drizzle: `pgTable` / `mysqlTable` / `sqliteTable`
- Prisma: `prisma/schema.prisma`
- TypeORM: `@Entity()` decorator
- SQLAlchemy: class inheriting `Base`

---
_Back to [overview.md](./overview.md)_