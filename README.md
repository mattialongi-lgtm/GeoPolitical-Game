<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/300c5164-3f3f-46f8-940b-7c494de9896a

## SQL da incollare su Supabase

Se ti serve il codice SQL da eseguire su Supabase, usa i file già presenti in `supabase/`:

- **🆕 File unico completo:** copia tutto il contenuto di **`supabase/migration_completa.sql`** nel SQL Editor di Supabase e premi **Run**. Questo è il file **consigliato** per un database nuovo — include tutto (schema base + tutte le migration) in un'unica esecuzione.
- **Nuovo database / reset completo (alternativa):** `supabase/full_schema.sql` contiene lo schema base ma **non** include alcune migration recenti (Factory V2/V3, Extraction System, Regional Indexes, Daily Gameplay). Per queste, usa `migration_completa.sql`.
- **Database già esistente:** esegui solo le migration necessarie presenti in `supabase/`, partendo dai file `migration_*.sql` pertinenti al problema che devi allineare, senza usare il reset completo.
- **Fix dati Italia:** usa `fix_it_region.sql` solo se devi riallineare i dati seed di Italia/regioni.

`migration_completa.sql` è il file unico "pronto da incollare" su Supabase: crea tutte le tabelle, le policy, le funzioni RPC, i CHECK constraint e i dati seed usati dal server. Include tutto il contenuto di `full_schema.sql` più tutte le migration.


### 🆕 Migration per Factory Upgrade + Security Fixes

Per applicare il sistema di upgrade fabbriche (800 livelli con costi) e le fix di sicurezza (race condition, CHECK constraints, deduzioni atomiche), esegui **un solo file**:

    supabase/migration_consolidated.sql

Questo file consolida tutto in un unica esecuzione:
- **Parte 1 — Factory Upgrade Costs:** tabella `factory_upgrade_costs` (800 livelli seed), tabella `factory_upgrade_log`, RPC `upgrade_factory()` transazionale, policy RLS
- **Parte 2 — Security Fixes:** CHECK constraints su `users.gold`, `users.money`, `users.energy` (>= 0), RPC `safe_deduct_currency()` atomica, constraint su `user_inventory.quantity` e `factories.budget`

> **Nota:** Se hai già eseguito `migration_factory_upgrades.sql` e/o `migration_security_fixes.sql` separatamente, il file consolidato è idempotente (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`) e può essere rieseguito senza errori.

### Ordine di esecuzione consigliato (database esistente)

| # | File | Cosa fa |
|---|------|---------|
| 1 | `migration_missing_tables.sql` | Tabelle mancanti (partiti, elezioni, parlamento, leggi, permessi, ecc.) |
| 2 | `migration_fix.sql` | Fix colonne e tabelle (articoli, commenti, voti) |
| 3 | `migration_fixes_v2.sql` | Fix payMode e militaryExp |
| 4 | `migration_wars_laws_fix.sql` | Fix guerre, leggi, RPCs mancanti |
| 5 | `migration_chat_xp_fix.sql` | Chat channels + XP formula |
| 6 | `migration_messages.sql` | Messaggi privati |
| 7 | `migration_travel_time.sql` | Colonne tempo di viaggio |
| 8 | `migration_resources.sql` | Sistema risorse regionali + Deep Exploration |
| 9 | **`migration_consolidated.sql`** | **Factory Upgrade (800 livelli) + Security Fixes** |
| 10 | `migration_extraction_system.sql` | Sistema estrazione avanzato: esperienza lavoro, formula produttività, analytics (⚠️ richiede step 8) |
| 11 | `migration_factories_v2.sql` | Economia fabbriche: storage, marketplace, log economia e lavoratori |
| 12 | `migration_factories_v3.sql` | Factory v3: colonne mancanti, cooldowns, budgets, RPCs (add_budget_transaction, process_work_action) |
| 13 | `migration_factory_storage_fix.sql` | Fix warehouse interno fabbriche (execute_factory_work, increment_factory_storage) |
| 14 | `migration_bugfixes_v3.sql` | Bugfix colonne factories, user_factory_cooldowns |
| 15 | `migration_regional_autonomy.sql` | Autonomia regionale: governatori, edifici, energia, indici, tasse |
| 16 | `migration_regional_indexes.sql` | Indici regionali: progress tracking, classificazione, modificatori |

> **Tutti i file sono idempotenti** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `CREATE OR REPLACE`): possono essere rieseguiti senza errori.
>
> **Per un database completamente nuovo** usa `full_schema.sql` al posto di tutti gli step sopra — include tutto in un'unica esecuzione.
>
> **Fix opzionale:** `fix_it_region.sql` — solo se devi riallineare i dati seed di Italia/regioni.

### ⚡ File unico per step 10–16: `migration_next.sql`

Se hai già eseguito gli step 1–9, puoi applicare tutti gli step rimanenti con **un solo file**:

    supabase/migration_next.sql

Contiene (nell'ordine corretto di dipendenze):
- **Part A** — Factory Economy V2 (marketplace, economy logs, worker logs)
- **Part B** — Factory System V3 (colonne mancanti, cooldowns, budgets, RPCs)
- **Part C** — Factory Storage Fix (warehouse interno)
- **Part D** — Bugfixes V3 (colonne factories, lastLogin, governance)
- **Part E** — Extraction System (work experience, produttività, analytics)
- **Part F** — Regional Autonomy (governatori, edifici, energia, tasse)
- **Part G** — Regional Indexes (progress tracking, classificazione, modificatori)

> Il file è **completamente idempotente** — nessun DROP TABLE, nessun reset. Sicuro da rieseguire.


## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Sistema Risorse Regionali

Nuova feature che aggiunge estrazione risorse, ricarica amministrativa e Deep Exploration al gioco.

### Concetti chiave

| Termine | Descrizione |
|---------|-------------|
| **Daily Available** | Quantità totale estraibile oggi in una regione per una risorsa. Si resetta ogni giorno. |
| **Daily Extracted** | Quanto è già stato estratto oggi (somma delle azioni di tutti i player). |
| **Cap per Ricarica** | Limite massimo estraibile da ogni singolo player per ciclo di ricarica. Varia per regione e risorsa. |
| **Ricarica** | Azione amministrativa (Dittatore / Ministro Economia) che resetta i contatori di ciclo. Ha cooldown (default 2h) e costa €. |
| **Deep Exploration** | Legge nazionale temporanea (7 giorni) che alza i cap effettivi per una risorsa in tutte le regioni del paese. |

### Calcolo estrazione per azione

```
extracted_amount_per_work = clamp(round(effective_cap * K), min=1, max=effective_cap)
final_amount = min(extracted_amount_per_work, remaining_cycle, remaining_daily)
```

- `K` = coefficiente di bilanciamento (default 0.02, configurabile in `game_settings`)
- `remaining_cycle` = cap effettivo − estratto nel ciclo corrente
- `remaining_daily` = daily_available − daily_extracted della regione

### Costo Deep Exploration (scalabile)

Il costo dipende da quanto i cap devono essere alzati:

```
delta_i = max(0, targetCap - baseCap_i)   per ogni regione
sumDelta = somma(delta_i)
CostoDiamanti = base + (sumDelta * per_delta) + (N_regioni * per_region)
CostoEUR      = base + (sumDelta * per_delta) + (N_regioni * per_region)
```

Se le regioni hanno cap alti, delta piccolo, costa meno.

### Migration SQL

- **Database nuovo:** tabelle incluse in `supabase/full_schema.sql`.
- **Database esistente:** esegui `supabase/migration_resources.sql` nel SQL Editor di Supabase.

### API endpoints

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| GET | `/api/regions/:id/resources` | Risorse della regione con cap effettivi |
| GET | `/api/resources/player-state?regionId=X` | Stato estrazione del player |
| POST | `/api/resources/work-extract` | Estrai risorsa (body: regionId, resourceType) |
| POST | `/api/resources/recharge` | Ricarica amministrativa (body: regionId, resourceType) |
| GET | `/api/resources/recharge-info` | Info su cooldown e costi ricarica |
| POST | `/api/resources/deep-exploration/cost` | Preview costi Deep |
| POST | `/api/resources/deep-exploration/activate` | Attiva Deep Exploration |
| GET | `/api/resources/deep-exploration/status` | Stato Deep attiva + livelli |
