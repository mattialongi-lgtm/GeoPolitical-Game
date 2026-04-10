# react-example — AI Context Map

> **Stack:** express | none | react | typescript

> 23 routes | 91 models | 103 components | 95 lib files | 23 env vars | 13 middleware | 10% test coverage
> **Token savings:** this file is ~13.300 tokens. Without it, AI exploration would cost ~121.100 tokens. **Saves ~107.800 tokens per conversation.**

---

# Routes

## CRUD Resources

- **`/api/articles`** GET | POST | GET/:id | PUT/:id | DELETE/:id → Article

## Other Routes

- `GET` `/test` params() ✓
- `POST` `/test` params() ✓
- `POST` `/api/register` params() [auth, db]
- `POST` `/api/login` params() [auth, db]
- `POST` `/api/logout` params() [auth, db]
- `POST` `/api/auth/firebase` params() [auth, db]
- `GET` `/api/me` params() [auth, db]
- `GET` `/api/regions` params() [auth, db]
- `GET` `/api/regions/:id` params(id) [auth, db]
- `POST` `/api/actions/work` params() [auth, db]
- `GET` `/api/factories` params() [auth, db]
- `POST` `/api/actions/propaganda` params() [auth, db]
- `POST` `/api/actions/invest` params() [auth, db]
- `POST` `/api/actions/attack` params() [auth, db]
- `GET` `/api/wars` params() [auth, db]
- `GET` `/api/wars/:id` params(id) [auth, db]
- `POST` `/api/profile/upgrade-perk` params() [auth, db]
- `GET` `/api/leaderboard` params() [auth, db]

---

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

---

# Components

- **App** — `src\App.tsx`
- **ArticleBlockRenderer** — props: blocks — `src\components\ArticleBlockRenderer.tsx`
- **ArticleEditor** — props: blocks, setBlocks — `src\components\ArticleEditor.tsx`
- **ArticleDetailView** — props: articles, user, fetchData, refreshArticles — `src\components\articles\ArticleDetailView.tsx`
- **ArticlesView** — props: articles, setSelectedArticleId, actionLoading, fetchData, refreshArticles — `src\components\articles\ArticlesView.tsx`
- **NewArticleView** — props: actionLoading, fetchData, refreshArticles — `src\components\articles\NewArticleView.tsx`
- **NewspaperDetailView** — props: user — `src\components\articles\NewspaperDetailView.tsx`
- **Auth** — props: onLogin — `src\components\auth\Auth.tsx`
- **BlocCreate** — props: currentUser, regions — `src\components\BlocCreate.tsx`
- **BlocDetail** — props: currentUser, regions — `src\components\BlocDetail.tsx`
- **BlocsList** — `src\components\BlocsList.tsx`
- **BudgetView** — props: regionId, user, isLeader — `src\components\budget\BudgetView.tsx`
- **GlobalChat** — props: currentUser — `src\components\chat\GlobalChat.tsx`
- **CountryDetailView** — props: user, handleAction, actionLoading, fetchData — `src\components\country\CountryDetailView.tsx`
- **AcademyCard** — props: academy, residenceRegionName, currentRegionName, onBuild — `src\components\daily\AcademyCard.tsx`
- **DailyMissionsCard** — props: missions, bonusClaimed, bonusReward, onClaimMission, onClaimBonus — `src\components\daily\DailyMissionsCard.tsx`
- **DailyTasksCard** — props: tasks, onTaskClick — `src\components\daily\DailyTasksCard.tsx`
- **DailyTasksPage** — props: user, regions — `src\components\daily\DailyTasksPage.tsx`
- **FarmingAutomationCard** — props: autoWork, farmingBonus, resources, onActivateAutoWork, onDeactivateAutoWork — `src\components\daily\FarmingAutomationCard.tsx`
- **FreeRewardsCard** — props: rewards, streak, periodicRewards, bottleValue, onClaimReward — `src\components\daily\FreeRewardsCard.tsx`
- **MilitaryTrainingCard** — props: damageState, onSendDamage — `src\components\daily\MilitaryTrainingCard.tsx`
- **PerksUpgradeCard** — props: perks, playerMoney, playerGold, onUpgrade — `src\components\daily\PerksUpgradeCard.tsx`
- **RewardSummaryCard** — props: rewards — `src\components\daily\RewardSummaryCard.tsx`
- **ExtractionDashboard** — props: user — `src\components\ExtractionDashboard.tsx`
- **PlayerFactoriesView** — props: user, fetchData, autoWorkFactoryId, setAutoWorkFactoryId — `src\components\factories\PlayerFactoriesView.tsx`
- **FactoryDetail** — props: user, fetchData — `src\components\FactoryDetail.tsx`
- **FactoryMarket** — props: user, fetchData — `src\components\FactoryMarket.tsx`
- **GovernmentView** — props: region, currentUser, onUpdate — `src\components\GovernmentView.tsx`
- **ChatPanel** — props: currentUser — `src\components\home\ChatPanel.tsx`
- **EventHistoryCard** — props: events — `src\components\home\EventHistoryCard.tsx`
- **HomePage** — props: user, regions, wars, worldStats, navigateToCountry, handleAction, refreshRegionsAndNations, refreshWorldStats — `src\components\home\HomePage.tsx`
- **ParliamentCard** — props: laws, governmentForm — `src\components\home\ParliamentCard.tsx`
- **PartySummaryCard** — props: party, resources, soldier — `src\components\home\PartySummaryCard.tsx`
- **QuickAccessMenu** — `src\components\home\QuickAccessMenu.tsx`
- **RegionStatsCarousel** — props: stats, userRegionId, navigateToCountry — `src\components\home\RegionStatsCarousel.tsx`
- **StateStatsCarousel** — props: stats, navigateToCountry — `src\components\home\StateStatsCarousel.tsx`
- **WarQuickPanel** — props: wars — `src\components\home\WarQuickPanel.tsx`
- **WorldStatsCarousel** — props: stats — `src\components\home\WorldStatsCarousel.tsx`
- **IndependentRegionsList** — props: regions, refreshRegionsAndNations — `src\components\IndependentRegionsList.tsx`
- **Leaderboard** — `src\components\leaderboard\Leaderboard.tsx`
- **LeaderView** — props: propRegionId, user, parentFetchData — `src\components\LeaderView.tsx`
- **MarketView** — props: user, fetchData — `src\components\market\MarketView.tsx`
- **MinistersView** — props: user, parentFetchData — `src\components\MinistersView.tsx`
- **NationView** — props: user, fetchData — `src\components\nation\NationView.tsx`
- **NationsList** — props: nations, refreshRegionsAndNations — `src\components\NationsList.tsx`
- **ElectionsTab** — props: data, user, reload — `src\components\parliament\ElectionsTab.tsx`
- **LawsTab** — props: laws, registry, user, reload, isMp, region — `src\components\parliament\LawsTab.tsx`
- **ParliamentTab** — props: members — `src\components\parliament\ParliamentTab.tsx`
- **ParliamentView** — props: user — `src\components\parliament\ParliamentView.tsx`
- **PartiesList** — `src\components\PartiesList.tsx`
- **PartyDashboard** — props: party, members, activeMembersCount, myRole, user, reload, fetchData, primariesVoteCounts, hasVotedPrimaries — `src\components\party\PartyDashboard.tsx`
- **PartyHub** — props: user, fetchData — `src\components\party\PartyHub.tsx`
- **PlayersList** — `src\components\PlayersList.tsx`
- **ProduceView** — props: user — `src\components\produce\ProduceView.tsx`
- **ProfileView** — props: user, handleUpgradePerk, handleActivateBooster, actionLoading, fetchData, regions, nations, isPublic — `src\components\profile\ProfileView.tsx`
- **PublicProfileView** — props: regions, nations — `src\components\profile\PublicProfileView.tsx`
- **ResourceHistoryView** — props: fetchData — `src\components\ResourceHistoryView.tsx`
- **ResourceIcon** — props: id, size, className — `src\components\ResourceIcon.tsx`
- **DeepExplorationPanel** — props: user, nationId — `src\components\resources\DeepExplorationPanel.tsx`
- **RechargeResourcePanel** — props: regionId, user — `src\components\resources\RechargeResourcePanel.tsx`
- **RegionResourcesTab** — props: regionId, user — `src\components\resources\RegionResourcesTab.tsx`
- **ResourceExtractView** — props: user, fetchData, autoWorkFactoryName, autoWorkResourceType, autoWorkRegionId, autoWorkExpiresAt, setAutoWorkResource — `src\components\resources\ResourceExtractView.tsx`
- **ShopPage** — props: user — `src\components\ShopPage.tsx`
- **AgreementListItem** — props: type, partnerName, partnerFlag, status, expiresAt — `src\components\state\AgreementListItem.tsx`
- **CollapsibleSection** — props: title, icon, defaultOpen, badge, emptyMessage, isEmpty — `src\components\state\CollapsibleSection.tsx`
- **DepartmentsSection** — props: nationId, user — `src\components\state\DepartmentsSection.tsx`
- **DetailRow** — props: label, value, highlight, unit — `src\components\state\DetailRow.tsx`
- **PoliticalInfoCard** — props: governmentForm, headOfState, economyMinister, foreignMinister, geopoliticalBloc — `src\components\state\PoliticalInfoCard.tsx`
- **RegionListItem** — props: name, population, mainResource, developmentLevel, governor, onClick — `src\components\state\RegionListItem.tsx`
- **StateHeader** — props: name, regionCount, population, onHelpClick — `src\components\state\StateHeader.tsx`
- **StateIdentityCard** — props: flag, flagUrl, representativeImage, stateName, onParliamentClick — `src\components\state\StateIdentityCard.tsx`
- **StatePage** — props: user, fetchData — `src\components\state\StatePage.tsx`
- **StateStatsGrid** — props: nationId, citizens, residents, parties, factories — `src\components\state\StateStatsGrid.tsx`
- **WorkDepartmentModal** — props: nationId, allDepartments, onClose, onSuccess — `src\components\state\WorkDepartmentModal.tsx`
- **StorageView** — props: user — `src\components\storage\StorageView.tsx`
- **TotalDamageView** — `src\components\TotalDamageView.tsx`
- **AppHeader** — `src\components\ui\AppHeader.tsx`
- **BottomNav** — `src\components\ui\BottomNav.tsx`
- **DarkCard** — props: className — `src\components\ui\DarkCard.tsx`
- **NationalFlag** — props: iso2, className, style — `src\components\ui\NationalFlag.tsx`
- **NationLogo** — props: iso2, logo, className, style — `src\components\ui\NationLogo.tsx`
- **PerkProgressBar** — props: startedAt, willCompleteAt — `src\components\ui\PerkProgressBar.tsx`
- **PerkTimer** — props: willCompleteAt, onComplete — `src\components\ui\PerkTimer.tsx`
- **ResourceStrip** — props: user — `src\components\ui\ResourceStrip.tsx`
- **StatCard** — props: Icon, label, value, color, subValue — `src\components\ui\StatCard.tsx`
- **StatRow** — props: label, value, Icon, onClick — `src\components\ui\StatRow.tsx`
- **TerritorialBrandLogo** — props: className, alt — `src\components\ui\TerritorialBrandLogo.tsx`
- **TravelTimer** — props: endsAt, onComplete — `src\components\ui\TravelTimer.tsx`
- **UsernameEditor** — props: username, fetchData — `src\components\ui\UsernameEditor.tsx`
- **WarTimer** — props: endsAt — `src\components\ui\WarTimer.tsx`
- **AutoAttackPanel** — props: warId, availableTroops, currentAutoAttack, onSetAutoAttack, onStopAutoAttack — `src\components\war\AutoAttackPanel.tsx`
- **RevolutionPanel** — props: regionId, userId, userGold, regionDevelopment, onStartRevolution, onStartCoup, loading — `src\components\war\RevolutionPanel.tsx`
- **TroopDeployPanel** — props: warId, side, availableTroops, userEnergy, onDeploy, deploying, sideColor — `src\components\war\TroopDeployPanel.tsx`
- **WarCreatePanel** — props: userRegionId, onCreateWar, creating — `src\components\war\WarCreatePanel.tsx`
- **WarDamageBar** — props: attackerScore, defenderScore, attackerLabel, defenderLabel, height, showPercentages — `src\components\war\WarDamageBar.tsx`
- **WarFactionBadge** — props: name, icon, align, iconSizeClass, textClassName, className — `src\components\war\WarFactionBadge.tsx`
- **WarHistoryList** — props: warId — `src\components\war\WarHistoryList.tsx`
- **WarStatsView** — props: user, nations — `src\components\wars\WarStatsView.tsx`
- **WarsView** — props: wars, user, nations, fetchData, refreshWars, actionLoading, autoWorkFactoryId, setAutoWorkFactoryId — `src\components\wars\WarsView.tsx`
- **WorkView** — `src\components\work\WorkView.tsx`
- **WorldFactoriesList** — `src\components\WorldFactoriesList.tsx`
- **DEFAULT_ENCLAVE_DATA** — props: onRegionClick, regions — `src\components\WorldMap.tsx`
- **AppRouter** — `src\router\AppRouter.tsx`

---

# Libraries

- `backend\app.ts` — function startServer: () => void, function startBackgroundJobs: () => void
- `backend\controllers\war.controller.ts` — class WarController
- `backend\errors\AppError.ts`
  - class AppError
  - class ValidationError
  - class AuthError
  - class ForbiddenError
  - class NotFoundError
  - class ConflictError
  - _...1 more_
- `backend\handlers\actions.handler.ts` — function createActionsHandlers: (deps, boosterInfo?, any>) => void
- `backend\handlers\automation.handler.ts` — function createAutomationHandlers: (deps) => void
- `backend\handlers\communication.handler.ts` — function createCommunicationHandlers: (deps) => void
- `backend\handlers\countries.handler.ts` — function createCountriesHandlers: (deps) => void
- `backend\handlers\daily.handler.ts` — function createDailyHandlers: (deps, playerLevel) => void
- `backend\handlers\factories.handler.ts` — function createFactoriesHandlers: (deps, boosterInfo?, any>) => void
- `backend\handlers\factory-market.handler.ts` — function createFactoryMarketHandlers: (deps) => void
- `backend\handlers\governance.handler.ts` — function createGovernanceHandlers: (deps) => void
- `backend\handlers\market.handler.ts` — function createMarketHandlers: (deps) => void
- `backend\handlers\media.handler.ts` — function createMediaHandlers: (deps) => void
- `backend\handlers\politics.handler.ts` — function createPoliticsHandlers: (deps) => void
- `backend\handlers\regions.handler.ts` — function createRegionsHandlers: (deps) => void
- `backend\handlers\resources.handler.ts` — function createResourcesHandlers: (deps) => void
- `backend\handlers\state.handler.ts` — function createStateHandlers: (deps) => void
- `backend\handlers\user.handler.ts` — function createUserHandlers: (deps, boosterInfo?, any>) => void
- `backend\handlers\wars-legacy.handler.ts` — function createWarsLegacyHandlers: (deps) => void
- `backend\handlers\world.handler.ts` — function createWorldHandlers: (deps) => void
- `backend\middleware\errorHandler.middleware.ts` — function errorHandler: (err, req, res, _next) => void
- `backend\middleware\validation.middleware.ts` — function validateBody: (schema) => void, function validateQuery: (schema) => void
- `backend\observability\contract-guards.ts`
  - function isWarsListResponse: (payload) => boolean
  - function isWarStatsResponse: (payload) => boolean
  - function isPlayerDamageSummaryResponse: (payload) => boolean
  - function isDailyMissionClaimSuccess: (payload) => boolean
  - function isDailyBonusClaimSuccess: (payload) => boolean
- `backend\repositories\daily-reward.repository.ts` — class DailyRewardRepository
- `backend\repositories\factory-create.repository.ts` — class FactoryCreateRepository
- `backend\repositories\factory-economy.repository.ts` — class FactoryEconomyRepository, type FactoryBudgetRow
- `backend\repositories\factory-upgrade.repository.ts` — class FactoryUpgradeRepository
- `backend\repositories\party-assets.repository.ts` — class PartyAssetsRepository
- `backend\repositories\production.repository.ts` — class ProductionRepository
- `backend\repositories\war.repository.ts` — class WarRepository
- `backend\routes\actions.routes.ts` — function registerActionsRoutes: (deps) => void
- `backend\routes\automation.routes.ts` — function registerAutomationRoutes: (deps) => void
- `backend\routes\communication.routes.ts` — function registerCommunicationRoutes: (deps) => void
- `backend\routes\countries.routes.ts` — function registerCountriesRoutes: (deps) => void
- `backend\routes\daily.routes.ts` — function registerDailyRoutes: (deps) => void
- `backend\routes\factories.routes.ts` — function registerFactoriesRoutes: (deps) => void
- `backend\routes\factory-market.routes.ts` — function registerFactoryMarketRoutes: (deps) => void
- `backend\routes\governance.routes.ts` — function registerGovernanceRoutes: (deps) => void
- `backend\routes\index.ts` — function setupRoutes: (deps) => void
- `backend\routes\market.routes.ts` — function registerMarketRoutes: (deps) => void
- `backend\routes\media.routes.ts` — function registerMediaRoutes: (deps) => void
- `backend\routes\politics.routes.ts` — function registerPoliticsRoutes: (deps) => void
- `backend\routes\regions.routes.ts` — function registerRegionsRoutes: (deps) => void
- `backend\routes\resources.routes.ts` — function registerResourcesRoutes: (deps) => void
- `backend\routes\state.routes.ts` — function registerStateRoutes: (deps) => void
- `backend\routes\user.routes.ts` — function registerUserRoutes: (deps) => void
- `backend\routes\war.routes.ts` — function registerWarRoutes: ({...}, authenticate, supabase, warDomain, }) => void
- `backend\routes\wars-legacy.routes.ts` — function registerWarsLegacyRoutes: (deps) => void
- `backend\routes\world.routes.ts` — function registerWorldRoutes: (deps) => void
- `backend\services\daily-reward.service.ts` — class DailyRewardService
- `backend\services\economy.service.ts` — class EconomyService
- `backend\services\extraction.service.ts` — class ExtractionService
- `backend\services\factory-create.service.ts` — class FactoryCreateService
- `backend\services\factory-economy.service.ts` — class FactoryEconomyService
- `backend\services\factory-economy.shared.ts`
  - function buildCriticalRollbackMessage: (prefix) => string
  - function createEconomyOperationId: (flow, entityId, userId) => void
  - function runCasRetry: (retries, runAttempt) => void
  - type EconomyFlow
  - const FACTORY_ECONOMY_CAS_RETRIES
  - const ECONOMY_ROLLBACK_NOT_CONFIRMED_SUFFIX
  - _...1 more_
- `backend\services\factory-upgrade.service.ts` — class FactoryUpgradeService
- `backend\services\governance.service.ts` — class GovernanceService
- `backend\services\http-result.mapper.ts` — function mapServiceResultToHttp: (result) => void
- `backend\services\index.ts` — function createServices: (supabase) => Services, interface Services
- `backend\services\party-assets.service.ts` — class PartyAssetsService
- `backend\services\production.service.ts` — class ProductionService
- `backend\services\service-result.ts`
  - function validationError
  - function forbiddenError
  - function notFoundError
  - function conflictError
  - function systemError
  - type ServiceResultType
  - _...4 more_
- `backend\services\user.service.ts` — class UserService
- `backend\services\war-create.usecase.ts` — function executeWarCreateUseCase: (warRepository, deps, input) => void, interface CreateWarInput
- `backend\services\war-deploy.usecase.ts` — function executeWarDeployUseCase: (warRepository, deps, input) => void, interface DeployTroopsInput
- `backend\services\war-domain.helpers.ts` — function createWarDomainDeps: (input) => WarDomainDeps, interface WarDomainDeps
- `backend\services\war-targets.usecase.ts` — function executeGetValidWarTargetsUseCase: (warRepository, input) => void, interface GetValidWarTargetsInput
- `backend\services\war-validation.usecase.ts` — function executeWarValidationUseCase: (warRepository, input) => void, interface ValidateWarTypesInput
- `backend\services\war.service.ts` — class WarService
- `backend\utils\automation-energy.ts`
  - function parseEnergyTimestamp: (value) => number | null
  - function hasEnergyDrinkCooldownExpired: (lastEnergyDrink, now, cooldownMs) => boolean
  - function resolveExtractionEnergyCost: (baseEnergyCost, resistanceLevel, exactEnergyCost?) => number
- `backend\utils\extraction-factory.ts`
  - function getFactoryResourceType: (factory, FACTORY_CONFIG) => string | null
  - function isExtractionFactoryEligible: (factory, FACTORY_CONFIG) => boolean
  - function getExtractionFactoryMeta: (factory, FACTORY_CONFIG) => void
  - function pickPreferredExtractionFactory: (factories, FACTORY_CONFIG, resourceType, preferredFactoryId?) => void
  - type ExtractionFactoryLike
- `backend\utils\geography.ts` — function haversineDistance: (lat1, lon1, lat2, lon2) => number, const WAR_NAVAL_MAX_DISTANCE_KM
- `backend\__tests__\setup.ts`
  - function createMockSupabase: () => void
  - function createMockRequest: (overrides, any>) => void
  - function createMockResponse: () => void
  - function createMockNext: () => jest.Mock
- `src\api\appClient.ts`
  - function fetchAppBootstrapData: () => Promise<AppBootstrapApiResult>
  - function fetchUserOnly: () => Promise<EndpointResult<any>>
  - function fetchRegionsAndNations: () => Promise<RegionsAndNationsResult>
  - function fetchArticlesOnly: () => Promise<EndpointResult<any[]>>
  - function fetchWarsOnly: () => Promise<EndpointResult<any>>
  - function fetchWorldStatsOnly: () => Promise<EndpointResult<any>>
  - _...3 more_
- `src\api\authClient.ts`
  - function getSupabaseSession: () => void
  - function subscribeToAuthStateChange: (callback, session) => void
  - function fetchCurrentUser: () => void
  - function setBackendAuthCookie
  - function clearBackendAuthCookie
- `src\api\dailyClient.ts`
  - function fetchDailyMissions: () => void
  - function claimDailyMission: (missionId) => Promise<boolean>
  - function claimDailyBonus: () => Promise<boolean>
- `src\api\httpClient.ts` — function httpFetch: (input, init) => Promise<Response>, function httpJson: (input, init) => Promise<T>
- `src\api\inventoryClient.ts` — function fetchInventoryHistory: (itemId) => void
- `src\api\profileClient.ts`
  - function fetchMyPlayerDamageSummary: () => Promise<PlayerDamageSummary>
  - interface PlayerDamageByWarEntry
  - interface PlayerDamageSummary
- `src\constants\flags.ts`
  - function isoToFlag
  - function getFlag
  - const COUNTRY_FLAGS: Record<string, string>
- `src\hooks\daily\useDailyMissions.ts` — function useDailyMissions: () => UseDailyMissionsResult
- `src\hooks\useAppActions.ts` — function useAppActions: (fetchData) => void
- `src\hooks\useAppBootstrapData.ts` — function useAppBootstrapData: ({...}, setRegions, setNations, setArticles, setWars, setWorldStats, setLoading, }) => void
- `src\hooks\useAuthBootstrap.ts` — function useAuthBootstrap: ({...}, onSignedOut }) => void
- `src\hooks\useDarkMode.ts` — function useDarkMode: () => void
- `src\hooks\useEnergyTimer.ts` — function useEnergyTimer: (user) => void
- `src\hooks\usePollingTask.ts` — function usePollingTask: (task) => void
- `src\services\battleResolver.ts`
  - function getResolutionEffects: (warType, winner) => ResolutionEffects
  - function resolveWar: (war) => WarResolution
  - function calculateLoot: (defenderBuildingValues) => number
  - interface ResolutionEffects
- `src\services\dailyMissionsService.ts`
  - function computeTarget: (template, playerLevel) => number
  - function resolveDescription: (template, target) => string
  - function selectDailyMissions: (dateStr, userId, playerLevel, count) => DailyMission[]
  - function isMissionComplete: (mission) => boolean
  - const MISSION_TEMPLATES: MissionTemplate[]
  - const MISSION_ACTION_MAP: Record<string, string[]>
- `src\services\damageCalculator.ts`
  - function calculateDamage: (ctx) => DamageBreakdown
  - function calculateInitialAttackDamage: (academies) => number
  - function calculateInitialDefensePoints: (buildings, number>) => number
  - function calculateDamageCap: (level, resistance, isPremium) => number
  - interface DamageContext
- `src\services\troopManager.ts`
  - function validateTroopDeployment: (troopType, quantity, warType, navalPhase, userEnergy) => TroopValidation
  - function getMaxDeployableTroops: (troopType, level, resistance, isPremium) => number
  - function getAvailableTroops: (warType, navalPhase) => TroopType[]
  - interface TroopValidation
- `src\services\warScheduler.ts`
  - function shouldAutoAttackFire: (autoType, lastFiredAt, activatedAt, now) => void
  - function getWarsToResolve: (wars) => string[]
  - function getNavalWarsForPhaseTransition: (wars) => string[]
- `src\services\warService.ts`
  - function validateWarCreation: (params) => WarValidation
  - function getWarDuration: (warType) => number
  - function calculateInitialDamages: (attackerBuildings, number>, defenderBuildings, number>) => void
  - function calculateDistancePenalty: (distanceKm, maxDistanceKm) => number
  - function determineWinner: (attackerScore, defenderScore) => WarSide
  - function shouldTransitionNavalPhase: (war) => void
  - _...1 more_
- `src\types.ts`
  - function factoryYieldMultiplier: (level) => number
  - function factoryStorageLimit: (factoryType, level) => number
  - function estimateFactoryValue: (factoryType, level, recentDailyProfit) => number
  - interface User
  - interface Perk
  - interface Region
  - _...97 more_
- `src\utils\time.ts`
  - function getTs
  - function formatDuration
  - function formatRemaining
  - function formatTime

---

# Config

## Environment Variables

- `BACKEND_BASE_URL` **required** — scripts\security-db-rls-validation.mjs
- `DB_TEST_USER_PASSWORD` **required** — scripts\security-db-rls-validation.mjs
- `DEBUG` **required** — backend\utils\logger.ts
- `DISABLE_HMR` **required** — vite.config.ts
- `ENABLE_DEV_ENDPOINTS` **required** — backend\app.ts
- `FIREBASE_CLIENT_EMAIL` **required** — server.ts
- `FIREBASE_PRIVATE_KEY` **required** — server.ts
- `FIREBASE_PROJECT_ID` **required** — server.ts
- `GEMINI_API_KEY` (has default) — .env.example
- `JWT_SECRET` (has default) — .env.example
- `NODE_ENV` **required** — backend\app.ts
- `PORT` **required** — backend\app.ts
- `REQUIRE_BACKEND_FLOW_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `REQUIRE_DB_INTEGRATION` **required** — scripts\security-db-integration.mjs
- `REQUIRE_DB_RLS_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `RUN_BACKEND_FLOW_VALIDATION` **required** — scripts\security-db-rls-validation.mjs
- `RUN_DB_INTEGRATION_TESTS` **required** — scripts\security-db-integration.mjs
- `RUN_DB_RLS_VALIDATION_TESTS` **required** — scripts\security-db-rls-validation.mjs
- `SUPABASE_ANON_KEY` (has default) — supabase\.env
- `SUPABASE_SERVICE_ROLE_KEY` (has default) — .env.example
- `SUPABASE_URL` (has default) — supabase\.env
- `VITE_SUPABASE_ANON_KEY` (has default) — .env.example
- `VITE_SUPABASE_URL` (has default) — .env.example

## Config Files

- `.env.example`
- `tsconfig.json`
- `vite.config.ts`

## Key Dependencies

- @supabase/supabase-js: ^2.99.0
- better-sqlite3: ^12.8.0
- express: ^4.22.1
- react: ^19.0.0
- zod: ^4.3.6

---

# Middleware

## logging
- errorHandler.middleware — `backend\middleware\errorHandler.middleware.ts`

## rate-limit
- rateLimiter.middleware — `backend\middleware\rateLimiter.middleware.ts`
- rateLimiter.test — `backend\__tests__\middleware\rateLimiter.test.ts`

## validation
- validation.middleware — `backend\middleware\validation.middleware.ts`
- validation.test — `backend\__tests__\middleware\validation.test.ts`

## custom
- contract-guards — `backend\observability\contract-guards.ts`
- migrate — `scripts\migrate.ts`
- migrate_resource_caps — `supabase\migrate_resource_caps.sql`
- migration_apply_atomic_pending_guard — `supabase\migration_apply_atomic_pending_guard.sql`

## error-handler
- errorHandler.test — `backend\__tests__\middleware\errorHandler.test.ts`
- errorHandler — `backend\app.ts`

## auth
- authClient — `src\api\authClient.ts`
- authenticate — `backend\routes\automation.routes.ts`

---

# Dependency Graph

## Most Imported Files (change these carefully)

- `src\types.ts` — imported by **72** files
- `backend\utils\logger.ts` — imported by **16** files
- `src\hooks\usePollingTask.ts` — imported by **12** files
- `src\components\home\mockData.ts` — imported by **11** files
- `backend\middleware\rateLimiter.middleware.ts` — imported by **8** files
- `backend\services\service-result.ts` — imported by **8** files
- `backend\__tests__\setup.ts` — imported by **8** files
- `backend\repositories\war.repository.ts` — imported by **7** files
- `src\components\ResourceIcon.tsx` — imported by **7** files
- `backend\services\war-domain.helpers.ts` — imported by **6** files
- `backend\services\http-result.mapper.ts` — imported by **5** files
- `src\api\httpClient.ts` — imported by **5** files
- `src\utils\time.ts` — imported by **5** files
- `backend\services\factory-economy.shared.ts` — imported by **4** files
- `src\lib\supabase.ts` — imported by **4** files
- `backend\services\factory-create.service.ts` — imported by **3** files
- `backend\repositories\production.repository.ts` — imported by **3** files
- `backend\services\production.service.ts` — imported by **3** files
- `backend\services\war.service.ts` — imported by **3** files
- `backend\handlers\automation.handler.ts` — imported by **3** files

## Import Map (who imports what)

- `src\types.ts` ← `backend\handlers\resources.handler.ts`, `backend\handlers\wars-legacy.handler.ts`, `backend\repositories\daily-reward.repository.ts`, `backend\routes\wars-legacy.routes.ts`, `backend\services\daily-reward.service.ts` +67 more
- `backend\utils\logger.ts` ← `backend\handlers\actions.handler.ts`, `backend\handlers\communication.handler.ts`, `backend\handlers\factories.handler.ts`, `backend\handlers\factory-market.handler.ts`, `backend\handlers\governance.handler.ts` +11 more
- `src\hooks\usePollingTask.ts` ← `src\components\articles\ArticleDetailView.tsx`, `src\components\articles\ArticlesView.tsx`, `src\components\articles\NewspaperDetailView.tsx`, `src\components\chat\GlobalChat.tsx`, `src\components\country\CountryDetailView.tsx` +7 more
- `src\components\home\mockData.ts` ← `src\App.tsx`, `src\App.tsx`, `src\components\home\EventHistoryCard.tsx`, `src\components\home\HomePage.tsx`, `src\components\home\ParliamentCard.tsx` +6 more
- `backend\middleware\rateLimiter.middleware.ts` ← `backend\app.ts`, `backend\routes\actions.routes.ts`, `backend\routes\factories.routes.ts`, `backend\routes\governance.routes.ts`, `backend\routes\market.routes.ts` +3 more
- `backend\services\service-result.ts` ← `backend\services\daily-reward.service.ts`, `backend\services\factory-create.service.ts`, `backend\services\factory-economy.service.ts`, `backend\services\factory-upgrade.service.ts`, `backend\services\http-result.mapper.ts` +3 more
- `backend\__tests__\setup.ts` ← `backend\__tests__\handlers\automation.handler.test.ts`, `backend\__tests__\handlers\resources.handler.test.ts`, `backend\__tests__\middleware\errorHandler.test.ts`, `backend\__tests__\middleware\validation.test.ts`, `backend\__tests__\services\economy.service.test.ts` +3 more
- `backend\repositories\war.repository.ts` ← `backend\routes\war.routes.ts`, `backend\services\war-create.usecase.ts`, `backend\services\war-deploy.usecase.ts`, `backend\services\war-targets.usecase.ts`, `backend\services\war-validation.usecase.ts` +2 more
- `src\components\ResourceIcon.tsx` ← `src\components\ExtractionDashboard.tsx`, `src\components\FactoryMarket.tsx`, `src\components\market\MarketView.tsx`, `src\components\produce\ProduceView.tsx`, `src\components\ResourceHistoryView.tsx` +2 more
- `backend\services\war-domain.helpers.ts` ← `backend\app.ts`, `backend\routes\war.routes.ts`, `backend\services\war-create.usecase.ts`, `backend\services\war-deploy.usecase.ts`, `backend\services\war.service.ts` +1 more

---

# Test Coverage

> **10%** of routes and models are covered by tests
> 16 test files found

## Covered Routes

- GET:/test
- POST:/test

## Covered Models

- users
- nations
- regions
- factories
- wars
- perks
- messages
- ministers
- extraction_detailed_logs

---

_Generated by [codesight](https://github.com/Houseofmvps/codesight) — see your codebase clearly_