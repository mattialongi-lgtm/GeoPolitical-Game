--- users ---
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    firebase_uid TEXT UNIQUE,
    password TEXT,
    money INTEGER DEFAULT 1000,
    energy INTEGER DEFAULT 100,
    influence INTEGER DEFAULT 0,
    regionId TEXT DEFAULT 'IT',
    lastEnergyUpdate INTEGER,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    perkPoints INTEGER DEFAULT 0
  , gold INTEGER DEFAULT 0, avatarData TEXT, perkUpgradesJson TEXT DEFAULT '{}', boostersJson TEXT DEFAULT '{}', energyDrinks INTEGER DEFAULT 0, lastEnergyDrink INTEGER DEFAULT 0, warMedals INTEGER DEFAULT 0, lastMedalClaim INTEGER DEFAULT 0, residenceId TEXT DEFAULT 'ST', workPermitId TEXT, originalNation TEXT DEFAULT 'ST', displayedNation TEXT DEFAULT 'ST', lastOriginalNationChange INTEGER DEFAULT 0, lastLogin INTEGER DEFAULT 0)


--- perks ---
CREATE TABLE perks (
    userId TEXT,
    perkId TEXT,
    level INTEGER DEFAULT 0,
    PRIMARY KEY(userId, perkId),
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- regions ---
CREATE TABLE regions (
    id TEXT PRIMARY KEY, -- ISO Code
    name TEXT UNIQUE,
    population INTEGER DEFAULT 1000000,
    resources INTEGER DEFAULT 50,
    stability INTEGER DEFAULT 100,
    taxes INTEGER DEFAULT 10,
    ownerUserId TEXT, treasury INTEGER DEFAULT 0, economyLevel INTEGER DEFAULT 1, health INTEGER DEFAULT 1, education INTEGER DEFAULT 1, military INTEGER DEFAULT 1, workRestrictions INTEGER DEFAULT 0, marketTaxRate INTEGER DEFAULT 10, dictatorship INTEGER DEFAULT 0, foundationDate INTEGER DEFAULT 0, parliamentSize INTEGER DEFAULT 20, parliamentDuration INTEGER DEFAULT 5, residencePolicy TEXT DEFAULT 'open', travelFee INTEGER DEFAULT 0, radiation INTEGER DEFAULT 0, governmentForm TEXT DEFAULT 'PARLIAMENTARY_REPUBLIC', economicAdviserId TEXT, foreignMinisterId TEXT, dictatorshipAttempts INTEGER DEFAULT 0, leaderUserId TEXT, leaderTitle TEXT DEFAULT 'Leader', stateColor TEXT DEFAULT '#334155', stateHymn TEXT, nextLeaderElectionAt INTEGER, sanctionsActive INTEGER DEFAULT 0, sanctionsScope TEXT DEFAULT '{}', nationId TEXT,
    FOREIGN KEY(ownerUserId) REFERENCES users(id)
  )


--- articles ---
CREATE TABLE articles (
    id TEXT PRIMARY KEY,
    authorId TEXT,
    authorName TEXT,
    title TEXT,
    content TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    likeCount INTEGER DEFAULT 0,
    FOREIGN KEY(authorId) REFERENCES users(id)
  )


--- wars ---
CREATE TABLE wars (
    id TEXT PRIMARY KEY,
    attackerCountryIso2 TEXT,
    defenderCountryIso2 TEXT,
    attackerUserId TEXT,
    defenderUserId TEXT,
    status TEXT, -- 'active' | 'ended'
    startedAt INTEGER,
    endsAt INTEGER,
    attackerScore INTEGER DEFAULT 0,
    defenderScore INTEGER DEFAULT 0,
    lastEventAt INTEGER,
    FOREIGN KEY(attackerUserId) REFERENCES users(id),
    FOREIGN KEY(defenderUserId) REFERENCES users(id)
  )


--- action_logs ---
CREATE TABLE action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    action TEXT,
    details TEXT,
    timestamp INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- sqlite_sequence ---
CREATE TABLE sqlite_sequence(name,seq)


--- cooldowns ---
CREATE TABLE cooldowns (
    userId TEXT,
    actionType TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, actionType),
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- chat_messages ---
CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    username TEXT,
    regionId TEXT,
    message TEXT,
    createdAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- player_factories ---
CREATE TABLE player_factories (
    id TEXT PRIMARY KEY,
    ownerId TEXT,
    ownerName TEXT,
    name TEXT,
    icon TEXT DEFAULT '­ƒÅ¡',
    level INTEGER DEFAULT 1,
    payoutBase INTEGER DEFAULT 80,
    energyCost INTEGER DEFAULT 8,
    cooldownSec INTEGER DEFAULT 90,
    createdAt INTEGER, regionId TEXT,
    FOREIGN KEY(ownerId) REFERENCES users(id)
  )


--- applications ---
CREATE TABLE applications (
    id TEXT PRIMARY KEY,
    userId TEXT,
    username TEXT,
    regionId TEXT,
    type TEXT,       -- 'residence' or 'work_permit'
    status TEXT,     -- 'pending' or 'accepted' or 'rejected'
    createdAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id)
  )


--- user_inventory ---
CREATE TABLE user_inventory (
    userId TEXT,
    itemId TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (userId, itemId)
  )


--- state_inventory ---
CREATE TABLE state_inventory (
    regionId TEXT,
    itemId TEXT,
    quantity INTEGER DEFAULT 0,
    PRIMARY KEY (regionId, itemId)
  )


--- market_offers ---
CREATE TABLE market_offers (
    id TEXT PRIMARY KEY,
    sellerId TEXT,
    sellerName TEXT,
    itemId TEXT,
    quantity INTEGER,
    price INTEGER,
    regionId TEXT,
    taxRate INTEGER,
    createdAt INTEGER
  , originStateId TEXT)


--- market_transactions_log ---
CREATE TABLE market_transactions_log (
    id TEXT PRIMARY KEY,
    buyerId TEXT,
    isStateBuy INTEGER,
    sellerId TEXT,
    itemId TEXT,
    quantity INTEGER,
    price INTEGER,
    taxPaid INTEGER,
    timestamp INTEGER
  )


--- production_queue ---
CREATE TABLE production_queue (
    id TEXT PRIMARY KEY,
    userId TEXT,
    weaponType TEXT,
    qty INTEGER,
    status TEXT,
    startedAt INTEGER,
    willCompleteAt INTEGER,
    createdAt INTEGER
  )


--- factories ---
CREATE TABLE factories (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT, -- 'oil', 'minerals', 'uranium', 'diamonds'
    regionId TEXT,
    ownerUserId TEXT,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    wage INTEGER DEFAULT 10,
    budget INTEGER DEFAULT 0,
    createdAt INTEGER
  )


--- user_factory_cooldowns ---
CREATE TABLE user_factory_cooldowns (
    userId TEXT,
    factoryId TEXT,
    lastUsed INTEGER,
    PRIMARY KEY(userId, factoryId),
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- parties ---
CREATE TABLE parties (
    id TEXT PRIMARY KEY,
    name TEXT,
    ideology TEXT,
    tag TEXT,
    description TEXT,
    logo TEXT,
    regionId TEXT,
    leaderUserId TEXT,
    createdAt INTEGER
  )


--- party_members ---
CREATE TABLE party_members (
    userId TEXT,
    partyId TEXT,
    role TEXT, -- 'leader', 'secretary', 'member'
    joinedAt INTEGER,
    salaryCash INTEGER DEFAULT 0,
    salaryGold INTEGER DEFAULT 0,
    PRIMARY KEY(userId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  )


--- party_invites ---
CREATE TABLE party_invites (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    userId TEXT,
    invitedBy TEXT,
    status TEXT, -- 'pending', 'accepted', 'rejected'
    createdAt INTEGER
  )


--- party_primaries ---
CREATE TABLE party_primaries (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    candidateId TEXT,
    voterId TEXT,
    createdAt INTEGER
  )


--- party_logs ---
CREATE TABLE party_logs (
    id TEXT PRIMARY KEY,
    partyId TEXT,
    action TEXT,
    details TEXT,
    timestamp INTEGER
  )


--- elections ---
CREATE TABLE elections (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    status TEXT, -- 'active', 'closed'
    createdAt INTEGER,
    closesAt INTEGER
  )


--- election_votes ---
CREATE TABLE election_votes (
    id TEXT PRIMARY KEY,
    electionId TEXT,
    voterId TEXT,
    partyId TEXT,
    timestamp INTEGER,
    FOREIGN KEY(electionId) REFERENCES elections(id),
    FOREIGN KEY(voterId) REFERENCES users(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  )


--- parliament_members ---
CREATE TABLE parliament_members (
    userId TEXT PRIMARY KEY,
    regionId TEXT,
    partyId TEXT,
    electedAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(partyId) REFERENCES parties(id)
  )


--- laws ---
CREATE TABLE laws (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    proposerId TEXT,
    type TEXT, -- e.g. 'change_market_tax'
    newValue TEXT,
    status TEXT, -- 'pending', 'passed', 'rejected'
    createdAt INTEGER,
    expiresAt INTEGER, params TEXT, targetStateId TEXT, decidedAt INTEGER,
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(proposerId) REFERENCES users(id)
  )


--- law_votes ---
CREATE TABLE law_votes (
    id TEXT PRIMARY KEY,
    lawId TEXT,
    voterId TEXT,
    vote TEXT, -- 'yes', 'no'
    timestamp INTEGER,
    FOREIGN KEY(lawId) REFERENCES laws(id),
    FOREIGN KEY(voterId) REFERENCES users(id)
  )


--- budgets ---
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    ownerType TEXT, -- 'REGION', 'AUTONOMY', 'STATE'
    ownerId TEXT,
    moneyEUR INTEGER DEFAULT 0,
    resources TEXT DEFAULT '{}',
    updatedAt INTEGER
  )


--- budget_transactions ---
CREATE TABLE budget_transactions (
    id TEXT PRIMARY KEY,
    budgetId TEXT,
    type TEXT, -- 'INCOME', 'EXPENSE', 'TRANSFER', 'WAR_LOOT', 'SYSTEM_TICK'
    subtype TEXT,
    moneyDelta INTEGER DEFAULT 0,
    resourcesDelta TEXT DEFAULT '{}',
    createdAt INTEGER,
    createdByUserId TEXT,
    metadata TEXT DEFAULT '{}',
    FOREIGN KEY(budgetId) REFERENCES budgets(id)
  )


--- blocs ---
CREATE TABLE blocs (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE,
    logo TEXT,
    description TEXT,
    ownerStateId TEXT,
    createdAt INTEGER
  )


--- bloc_memberships ---
CREATE TABLE bloc_memberships (
    blocId TEXT,
    stateId TEXT,
    status TEXT,
    joinedAt INTEGER,
    PRIMARY KEY(blocId, stateId),
    FOREIGN KEY(blocId) REFERENCES blocs(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  )


--- bloc_applications ---
CREATE TABLE bloc_applications (
    id TEXT PRIMARY KEY,
    blocId TEXT,
    stateId TEXT,
    createdAt INTEGER,
    status TEXT,
    FOREIGN KEY(blocId) REFERENCES blocs(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  )


--- bloc_votes ---
CREATE TABLE bloc_votes (
    targetId TEXT,
    voterStateId TEXT,
    choice INTEGER,
    createdAt INTEGER,
    PRIMARY KEY(targetId, voterStateId)
  )


--- bloc_regulations ---
CREATE TABLE bloc_regulations (
    blocId TEXT PRIMARY KEY,
    openBorders INTEGER DEFAULT 0,
    defaultMilitaryAgreement INTEGER DEFAULT 0, migrationOpen INTEGER DEFAULT 0,
    FOREIGN KEY(blocId) REFERENCES blocs(id)
  )


--- bloc_regulation_proposals ---
CREATE TABLE bloc_regulation_proposals (
    id TEXT PRIMARY KEY,
    blocId TEXT,
    type TEXT,
    proposedValue INTEGER,
    createdAt INTEGER,
    status TEXT,
    FOREIGN KEY(blocId) REFERENCES blocs(id)
  )


--- leader_orders ---
CREATE TABLE leader_orders (
    id TEXT PRIMARY KEY,
    regionId TEXT,
    authorUserId TEXT,
    title TEXT,
    body TEXT,
    createdAt INTEGER,
    audience TEXT, -- 'CITIZENS', 'NEW_PLAYERS', 'ALL'
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(authorUserId) REFERENCES users(id)
  )


--- leader_candidates ---
CREATE TABLE leader_candidates (
    regionId TEXT,
    userId TEXT,
    votes INTEGER DEFAULT 0,
    PRIMARY KEY(regionId, userId),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- leader_votes ---
CREATE TABLE leader_votes (
    regionId TEXT,
    voterId TEXT,
    candidateId TEXT,
    PRIMARY KEY(regionId, voterId),
    FOREIGN KEY(regionId) REFERENCES regions(id),
    FOREIGN KEY(voterId) REFERENCES users(id)
  )


--- ministers ---
CREATE TABLE ministers (
    id TEXT PRIMARY KEY,
    stateId TEXT,
    userId TEXT,
    role TEXT, -- 'economics', 'foreign'
    title TEXT,
    assignedByUserId TEXT,
    assignedAt INTEGER,
    status TEXT DEFAULT 'ACTIVE',
    FOREIGN KEY(stateId) REFERENCES regions(id),
    FOREIGN KEY(userId) REFERENCES users(id)
  )


--- minister_wage_logs ---
CREATE TABLE minister_wage_logs (
    id TEXT PRIMARY KEY,
    userId TEXT,
    stateId TEXT,
    role TEXT,
    amountGold INTEGER,
    paidAt INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(stateId) REFERENCES regions(id)
  )


--- migration_agreements ---
CREATE TABLE migration_agreements (
    id TEXT PRIMARY KEY,
    fromStateId TEXT,
    toStateId TEXT,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED'
    type TEXT,   -- 'UNILATERAL', 'BILATERAL'
    createdAt INTEGER,
    updatedAt INTEGER, activatedAt INTEGER, revokedAt INTEGER, sourceLawId TEXT,
    UNIQUE(fromStateId, toStateId)
  )


--- nations ---
CREATE TABLE nations (
    id TEXT PRIMARY KEY,
    name TEXT,
    logo TEXT DEFAULT '­ƒÅø´©Å',
    capitalRegionId TEXT,
    leaderUserId TEXT,
    createdAt INTEGER,
    updatedAt INTEGER,
    FOREIGN KEY(capitalRegionId) REFERENCES regions(id),
    FOREIGN KEY(leaderUserId) REFERENCES users(id)
  )


--- sanctions ---
CREATE TABLE sanctions (
    id TEXT PRIMARY KEY,
    fromStateId TEXT,
    targetStateId TEXT,
    status TEXT DEFAULT 'ACTIVE',
    createdAt INTEGER,
    createdByUserId TEXT,
    revokedAt INTEGER,
    revokedByUserId TEXT,
    FOREIGN KEY(fromStateId) REFERENCES regions(id),
    FOREIGN KEY(targetStateId) REFERENCES regions(id)
  )


