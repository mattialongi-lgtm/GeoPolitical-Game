# Verifica fix auto-work (lavoro automatico)

Questa procedura serve a verificare che il lavoro automatico:

- ricarichi energia usando bibite fino a `300`
- consumi `300` energia per singolo lavoro
- accrediti correttamente risorse/payout al giocatore
- versi correttamente le tasse (split Stato/Autonomia quando previsto)

## Prerequisiti

- `VITE_SUPABASE_URL` valorizzata
- `SUPABASE_SERVICE_ROLE_KEY` (consigliata) oppure `VITE_SUPABASE_ANON_KEY`
- tabella `work_auto_actions` presente (migrazione: `supabase/migration_automation_modes.sql`)

## Setup rapido (script)

Lo script prepara un utente con energia/bibite e attiva l’auto-work su una specifica fabbrica.

```bash
node scripts/setup_auto_work_test.mjs --userId <uuid> --factoryId <uuid> --energy 0 --drinks 1 --apply
```

Note:

- `--energy 0` forza il consumo di una bibita all’esecuzione dell’auto-work.
- `--drinks 1` garantisce che l’automazione possa ricaricare la barra almeno una volta.

## Verifica attesa (checklist)

1. Attendi il tick server (di solito entro ~60s; la modalità `standard` lavora ogni ~10 minuti a seconda di `shouldRecurringAutomationFire`).
2. Controlla che:
   - `users.energy` sia diminuita di `300` dopo l’esecuzione (o sia stata ricaricata a 300 e poi consumata).
   - `users.energyDrinks` sia diminuito di `1` se l’energia era < 300.
   - il giocatore abbia ricevuto il payout:
     - miniere d’oro: `users.money` aumenta e `users.gold` aumenta (solo unità intere).
     - risorse: `user_inventory.quantity` aumenta per `itemId = factory.type`.
   - siano state inserite transazioni in `budget_transactions`:
     - ownerType `STATE` per regioni non autonome
     - split `STATE` + `AUTONOMY` per regioni autonome con `regionalProfitSharePercent > 0`

## Query utili (Supabase SQL Editor)

Sostituisci `:userId`, `:factoryId`, `:nationId`, `:regionId`.

```sql
select id, energy, "energyDrinks", "lastEnergyDrink", money, gold
from users
where id = :userId;
```

```sql
select *
from work_auto_actions
where "userId" = :userId;
```

```sql
select *
from user_inventory
where "userId" = :userId
order by "itemId";
```

```sql
select bt.*
from budget_transactions bt
join budgets b on b.id = bt."budgetId"
where (b."ownerType", b."ownerId") in (('STATE', :nationId), ('AUTONOMY', :regionId), ('REGION', :regionId))
order by bt."createdAt" desc
limit 50;
```

