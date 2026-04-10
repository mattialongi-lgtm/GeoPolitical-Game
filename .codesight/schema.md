# Schema

### users
- id: uuid (pk)
- email: text (unique)
- money: bigint (default)
- gold: bigint (default)
- energy: integer (default)
- influence: bigint (default)
- regionId: text (default, fk)
- residenceId: text (default, fk)
- workPermitId: text (fk)
- originalNation: text (default)
- displayedNation: text (default)
- lastOriginalNationChange: bigint (default)
- lastEnergyUpdate: bigint
- xp: bigint (default)
- level: integer (default)
- perkPoints: integer (default)
- avatarData: text
- energyDrinks: integer (default)
- lastEnergyDrink: bigint (default)
- warMedals: integer (default)
- lastMedalClaim: bigint (default)
- lastLogin: bigint (default)
- perkUpgradesJson: text (default)
- boostersJson: text (default)
- travelingTo: text (default)
- travelingUntil: bigint (default)
- travelingFrom: text (default)
- travelDurationMs: bigint (default)
- militaryExp: integer (default)

### nations
- id: text (pk)
- name: text
- logo: text (default)
- leaderUserId: uuid (fk)

### regions
- id: text (pk)

### budgets
- id: uuid (pk)
- ownerType: text
- resources: jsonb (default)

### budget_transactions
- id: text (pk)
- budgetId: uuid (fk)
- type: text
- subtype: text
- moneyDelta: bigint (default)
- resourcesDelta: jsonb (default)
- createdByUserId: uuid (fk)
- metadata: jsonb (default)

### regional_buildings
- id: uuid (pk)
- regionId: text (required, fk)
- buildingType: text (required)
- quantity: integer (default)
- level: integer (default)

### regional_parliament_members
- id: uuid (pk)
- regionId: text (required, fk)
- userId: uuid (required, fk)
- partyId: uuid (fk)
- electedAt: timestamp(tz) (default)
- termEndsAt: timestamp(tz)

### regional_laws
- id: text (pk)
- regionId: text (required, fk)
- proposerId: uuid (required, fk)
- type: text (required)
- params: jsonb (default)
- status: text (default)
- expiresAt: timestamp(tz)

### regional_law_votes
- lawId: text (required, fk)
- voterId: uuid (required, fk)
- vote: text (required)

### regional_budget_transactions
- id: uuid (pk)
- regionId: text (required, fk)
- type: text (required)
- subtype: text
- moneyDelta: bigint (default)
- description: text
- createdByUserId: uuid (fk)
- metadata: jsonb (default)

### autonomy_history
- id: uuid (pk)
- regionId: text (required, fk)
- action: text (required)
- performedByUserId: uuid (fk)
- details: jsonb (default)

### factories
- id: uuid (pk)
- name: text
- type: text
- regionId: text (fk)
- ownerUserId: uuid (fk)
- wage: bigint (default)
- budget: bigint (default)
- payMode: text (default)

### user_factory_cooldowns
- userId: uuid (fk)
- factoryId: uuid (fk)
- lastUsed: timestamp(tz) (default)

### work_auto_actions
- id: uuid (pk)
- userId: uuid (required, fk)
- factoryId: uuid (required, fk)
- mode: text (required)
- isActive: boolean (required)
- lastFiredAt: timestamp(tz)
- activatedAt: timestamp(tz) (required)
- expiresAt: timestamp(tz)

### training_auto_actions
- id: uuid (pk)
- userId: uuid (required, fk)
- mode: text (required)
- isActive: boolean (required)
- lastFiredAt: timestamp(tz)
- activatedAt: timestamp(tz) (required)
- expiresAt: timestamp(tz)

### market_offers
- id: text (pk)
- sellerId: uuid (fk)
- sellerName: text
- itemId: text (fk)
- quantity: integer
- price: bigint
- regionId: text (fk)
- taxRate: integer (default)
- originStateId: text (fk)

### cooldowns
- user_id: uuid (fk)
- action_type: text
- last_used: timestamp(tz) (default)

### applications
- id: text (pk)
- userId: uuid (fk)
- username: text
- regionId: text (fk)
- type: text
- status: text (default)

### wars
- id: text (pk)
- attackerCountryIso2: text
- defenderCountryIso2: text
- attackerUserId: uuid (fk)
- defenderUserId: uuid (fk)
- status: text
- startedAt: timestamp(tz) (default)
- endsAt: timestamp(tz) (default)
- attackerScore: bigint (default)
- defenderScore: bigint (default)
- lastEventAt: timestamp(tz)

### leader_orders
- id: integer(auto) (pk)
- regionId: text (fk)
- leaderId: uuid (fk)
- title: text
- content: text

### migration_agreements
- id: uuid (pk)
- fromStateId: text (fk)
- toStateId: text (fk)
- status: text (default)
- activatedAt: timestamp(tz) (default)

### perks
- userId: uuid (fk)
- perkId: text (required, fk)
- level: integer (default)

### chat_messages
- id: uuid (pk)
- userId: uuid (fk)
- username: text
- regionId: text (fk)
- channel: text (default)
- message: text (required)

### articles
- id: text (pk)
- authorId: uuid (fk)
- authorName: text
- title: text (required)
- content: text (required)
- section: text (default)
- likeCount: integer (default)

### article_comments
- id: uuid (pk)
- articleId: text (required, fk)
- authorId: uuid (required, fk)
- authorName: text (required)
- content: text (required)

### article_votes
- id: uuid (pk)
- articleId: text (required, fk)
- userId: uuid (required, fk)
- vote: text (required)

### parties
- id: text (pk)
- name: text (required)
- ideology: text (default)
- tag: text (default)
- description: text (default)
- logo: text (default)
- regionId: text (fk)
- leaderUserId: uuid (fk)

### party_members
- userId: uuid (fk)
- partyId: text (fk)
- role: text (default)
- salaryCash: bigint (default)
- salaryGold: bigint (default)
- joinedAt: bigint

### party_logs
- id: text (pk)
- partyId: text (fk)
- action: text
- details: text
- timestamp: bigint

### party_invites
- id: text (pk)
- partyId: text (fk)
- userId: uuid (fk)
- invitedBy: uuid (fk)
- status: text (default)

### party_primaries
- id: text (pk)
- partyId: text (fk)
- candidateId: uuid (fk)
- voterId: uuid (fk)

### user_inventory
- userId: uuid (fk)
- itemId: text (required, fk)
- quantity: integer (default)

### messages
- id: uuid (pk)
- senderId: uuid (fk)
- senderName: text (required)
- receiverId: uuid (fk)
- receiverName: text (required)
- subject: text (default)
- body: text (required)
- read: boolean (default)

### elections
- id: text (pk)
- regionId: text (fk)
- status: text (default)
- closesAt: timestamp(tz)

### election_votes
- id: text (pk)
- electionId: text (fk)
- voterId: uuid (fk)
- partyId: text (fk)
- timestamp: timestamp(tz) (default)

### parliament_members
- userId: uuid (fk)
- regionId: text (fk)
- partyId: text (fk)
- electedAt: timestamp(tz) (default)

### laws
- id: text (pk)
- regionId: text (fk)
- proposerId: uuid (fk)
- type: text
- params: jsonb (default)
- status: text (default)
- expiresAt: timestamp(tz)

### law_votes
- lawId: text (fk)
- voterId: uuid (fk)
- vote: text

### leader_candidates
- regionId: text (fk)
- userId: uuid (fk)
- votes: integer (default)

### leader_votes
- regionId: text (fk)
- voterId: uuid (fk)
- candidateId: uuid (fk)

### work_permits
- id: uuid (pk)
- userId: uuid (fk)
- regionId: text (fk)

### sanctions
- id: text (pk)
- fromStateId: text (fk)
- targetStateId: text (fk)
- status: text (default)
- createdByUserId: uuid (fk)
- revokedAt: timestamp(tz)
- revokedByUserId: uuid (fk)

### blocs
- id: text (pk)
- name: text (unique)
- logo: text (default)
- description: text (default)
- ownerStateId: text (fk)
- ownerUserId: uuid (fk)

### bloc_memberships
- blocId: text (fk)
- stateId: text (fk)
- status: text (default)
- joinedAt: timestamp(tz) (default)

### bloc_applications
- id: text (pk)
- blocId: text (fk)
- stateId: text (fk)
- status: text (default)

### bloc_regulations
- blocId: text (pk, fk)
- openBorders: integer (default)
- defaultMilitaryAgreement: integer (default)
- migrationOpen: integer (default)

### bloc_regulation_proposals
- id: text (pk)
- blocId: text (fk)
- type: text
- proposedValue: integer
- status: text (default)

### bloc_votes
- targetId: text (required, fk)
- voterStateId: text (fk)
- choice: integer (default)

### production_queue
- id: text (pk)
- userId: uuid (fk)
- weaponType: text
- qty: integer (default)
- status: text (default)
- startedAt: timestamp(tz)
- willCompleteAt: timestamp(tz)

### ministers
- id: text (pk)
- stateId: text (fk)
- userId: uuid (fk)
- role: text
- title: text
- assignedByUserId: uuid (fk)
- assignedAt: bigint
- status: text (default)

### market_transactions_log
- id: text (pk)
- buyerId: text (fk)
- isStateBuy: integer (default)
- sellerId: text (fk)
- itemId: text (fk)
- quantity: integer
- price: bigint
- taxPaid: bigint (default)
- timestamp: bigint

### game_settings
- value: jsonb (required)
- description: text

### deep_levels
- level: integer (pk)
- targetCap: integer (required)
- enabled: boolean (default)
- description: text

### region_resources
- regionId: text (fk)
- resourceType: text (required)
- dailyAvailable: integer (required)

### player_extraction_state
- playerId: uuid (fk)
- regionId: text (fk)
- resourceType: text (required)
- extractedSinceLastRecharge: integer (required)

### resource_recharges
- regionId: text (fk)
- resourceType: text (required)
- lastRechargeAt: timestamp(tz) (default)
- rechargedByUserId: uuid (fk)

### deep_explorations
- id: text (pk)
- nationId: text (required, fk)
- resourceType: text (required)
- level: integer (required)
- targetCap: integer (required)
- activatedByUserId: uuid (fk)
- startsAt: timestamp(tz) (required)
- endsAt: timestamp(tz) (required)
- isActive: boolean (required)
- costDiamonds: integer (default)
- costEur: integer (default)
- costGold: integer (default)

### resource_extraction_logs
- id: bigint(auto) (pk)
- playerId: uuid (fk)
- regionId: text (fk)
- resourceType: text (required)
- amount: integer (required)

### revolution_lobbies
- id: uuid (pk)
- regionId: text (required, fk)
- lobbyType: text (required)
- creatorId: uuid (required, fk)
- requiredPlayers: integer (required)
- status: text (required)
- goldCostPerPlayer: integer (required)
- expiresAt: timestamp(tz)

### factory_upgrade_costs
- level_to: integer (pk)
- upgrade_cost: integer (required)
- aggregate_cost: integer (required)
- currency: text (required)

### factory_upgrade_log
- id: uuid (pk)
- factory_id: uuid (fk)
- user_id: uuid (fk)
- level_before: integer
- level_after: integer
- gold_cost: integer

### player_resource_work_experience
- playerId: uuid (required, fk)
- resourceType: text (required)
- experience: integer (required)
- totalExtractions: integer (required)
- lastWorkedAt: timestamp(tz) (default)

### extraction_detailed_logs
- id: bigint(auto) (pk)
- playerId: uuid (required, fk)
- regionId: text (required, fk)
- factoryId: uuid (fk)
- resourceType: text (required)
- grossAmount: numeric (required)
- playerAmount: numeric (required)
- ownerAmount: numeric (required)
- taxAmount: numeric (required)
- stateAmount: numeric (required)
- autonomyAmount: numeric (required)
- moneyGenerated: numeric (required)
- withdrawnPoints: numeric (required)
- playerLevel: integer (required)
- factoryLevel: integer (required)
- workExperience: integer (required)
- resourceCoefficient: numeric (required)
- finalProductivity: numeric (required)

### resource_department_bonuses
- regionId: text (required, fk)
- resourceType: text (required)
- bonusLevel: integer (required)

### factory_market_listings
- id: uuid (pk)
- factoryId: uuid (required, fk)
- sellerId: uuid (required, fk)
- askingPrice: bigint (required)
- listedAt: timestamp(tz) (default)
- status: text (default)
- buyerId: uuid (fk)
- soldAt: timestamp(tz)

### factory_economy_logs
- id: uuid (pk)
- factoryId: uuid (required, fk)
- logDate: date (required)
- workerCount: integer (default)
- grossIncome: bigint (default)
- taxesPaid: bigint (default)
- ownerProfit: bigint (default)
- production: bigint (default)

### factory_worker_logs
- id: uuid (pk)
- factoryId: uuid (required, fk)
- workerId: uuid (required, fk)
- workedAt: timestamp(tz) (default)
- earningsMoney: bigint (default)
- earningsGold: numeric(12
- resourceType: text
- resourceAmount: bigint (default)
- ownerCut: bigint (default)

### daily_auto_work
- id: uuid (pk)
- user_id: uuid (required, fk)
- resource_type: text (required)
- active: boolean (required)
- started_at: bigint
- energy_cost: integer (default)

### daily_damage_log
- id: uuid (pk)
- user_id: uuid (required, fk)
- target_type: text (required)
- active_event: target_id text
- xp_gained: numeric (required)

### military_academy_claims
- id: uuid (pk)
- user_id: uuid (required, fk)
- region_id: text (required, fk)
- claimed_date: date (required)
- rewards: jsonb (required)

### work_streaks
- id: uuid (pk)
- user_id: uuid (required, fk)
- current_streak: integer (required)
- longest_streak: integer (required)
- last_work_date: date

### free_reward_claims
- id: uuid (pk)
- user_id: uuid (required, fk)
- source: text (required)
- other: source_label text
- reward_type: text (required)
- xp: amount numeric (required)
- claimed_at: timestamp(tz) (required)

### daily_task_completions
- id: uuid (pk)
- user_id: uuid (required, fk)
- task_id: text (required, fk)
- completed_date: date (required)
- completed_at: timestamp(tz) (required)

### periodic_reward_progress
- id: uuid (pk)
- user_id: uuid (required, fk)
- reward_id: text (required, fk)
- total_days_required: integer (required)
- claimed: boolean (required)
- last_counted_date: date

### streak_milestone_claims
- id: uuid (pk)
- user_id: uuid (required, fk)
- milestone_days: integer (required)
- reward_type: text (required)
- reward_amount: numeric (required)
- claimed_at: timestamp(tz) (required)

### daily_missions
- id: uuid (pk, default)
- user_id: uuid (required, fk)
- mission_key: text (required)
- title: text (required)
- description: text (required)
- category: text (required)
- icon: text (required)
- target: integer (required)
- progress: integer (required)
- status: text (required)
- reward: jsonb (required)
- route: text
- reset_date: date (required)

### daily_mission_bonus_claims
- id: uuid (pk, default)
- user_id: uuid (required, fk)
- claim_date: date (required)
- reward: jsonb (required)
- claimed_at: timestamp(tz) (required)

### state_department_scores
- nation_id: text (required, fk)
- department: text (required)
- score: bigint (required)

### player_department_contributions
- id: uuid (required)
- player_id: text (required, fk)
- nation_id: text (required, fk)
- contributions: jsonb (required)

### newspapers
- id: text (pk)
- name: text (required)
- description: text
- logoUrl: text
- ownerId: uuid (fk)

### newspaper_members
- id: uuid (pk)
- newspaperId: text (fk)
- userId: uuid (fk)
- role: text (required)
- status: text (default)
- joinedAt: timestamp(tz) (default)

### military_agreements
- id: uuid (pk)
- nation_id: text (required, fk)
- partner_nation_id: text (required, fk)
- agreement_type: text (required)
- coalition: status text (required)
- expires_at: timestamp(tz)
- created_by_user_id: uuid (fk)

### action_logs
- id: bigint(auto) (pk)
- userId: uuid (fk)
- action: text (required)
- details: text
- but: text matches sqlite

### war_participants
- id: uuid (pk)
- warId: text (required, fk)
- userId: uuid (required, fk)
- side: text (required)
- totalDamage: bigint (default)
- troopsDeployed: jsonb (default)
- joinedAt: timestamp(tz) (default)

### war_deployments
- id: uuid (pk)
- warId: text (required, fk)
- userId: uuid (required, fk)
- side: text (required)
- troopType: text (required)
- quantity: integer (required)
- baseDamage: bigint (required)
- finalDamage: bigint (required)
- bonuses: jsonb (default)
- deployedAt: timestamp(tz) (default)

### war_auto_attacks
- id: uuid (pk)
- warId: text (required, fk)
- userId: uuid (required, fk)
- side: text (required)
- autoType: text (required)
- troopType: text (required)
- isActive: boolean (default)
- lastFiredAt: timestamp(tz)
- activatedAt: timestamp(tz) (default)
- expiresAt: timestamp(tz)

### revolutions
- id: uuid (pk)
- regionId: text (required, fk)
- goldCost: integer (required)
- status: text (required)
- warId: text (fk)
- cooldownUntil: timestamp(tz)
- resolvedAt: timestamp(tz)

### coups
- id: uuid (pk)
- regionId: text (required, fk)
- status: text (required)
- warId: text (fk)
- resolvedAt: timestamp(tz)

### war_military_agreements
- id: uuid (pk)
- stateA: text (required)
- stateB: text (required)
- agreementType: text (required)
- initiatorState: text (required)
- status: text (required)
- expiresAt: timestamp(tz)

### war_departments
- id: uuid (pk)
- stateId: text (required, fk)
- departmentType: text (required)
- level: integer (required)
- bonusPercent: numeric(5
- ranking: integer (default)

### war_history
- id: uuid (pk)
- warId: text (required, fk)
- eventType: text (required)
- eventData: jsonb (default)
