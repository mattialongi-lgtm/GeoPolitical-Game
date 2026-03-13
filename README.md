<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/300c5164-3f3f-46f8-940b-7c494de9896a

## SQL da incollare su Supabase

Se ti serve il codice SQL da eseguire su Supabase, usa i file già presenti in `supabase/`:

- **Nuovo database / reset completo:** copia tutto il contenuto di `supabase/full_schema.sql` nel SQL Editor di Supabase e premi **Run**.
- **Database già esistente:** esegui solo le migration necessarie presenti in `supabase/`, partendo dai file `migration_*.sql` pertinenti al problema che devi allineare, senza usare il reset completo.
- **Fix dati Italia:** usa `fix_it_region.sql` solo se devi riallineare i dati seed di Italia/regioni.

`full_schema.sql` è il file principale “pronto da incollare” su Supabase: crea tutte le tabelle, le policy e le funzioni RPC usate dal server.

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
