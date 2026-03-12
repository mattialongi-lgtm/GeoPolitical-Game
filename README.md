<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/300c5164-3f3f-46f8-940b-7c494de9896a

## SQL da incollare su Supabase

Se ti serve il codice SQL da eseguire su Supabase, usa i file già presenti in `supabase/`:

- **Nuovo database / reset completo:** copia tutto il contenuto di `/home/runner/work/GeoPolitical-Game/GeoPolitical-Game/supabase/full_schema.sql` nel SQL Editor di Supabase e premi **Run**.
- **Database già esistente:** esegui solo le migration necessarie presenti in `/home/runner/work/GeoPolitical-Game/GeoPolitical-Game/supabase/` (`migration_fix.sql`, `migration_missing_tables.sql`, `migration_chat_xp_fix.sql`, `migration_travel_time.sql`, `migration_wars_laws_fix.sql`).
- **Fix dati Italia:** usa `fix_it_region.sql` solo se devi riallineare i dati seed di Italia/regioni.

`full_schema.sql` è il file principale “pronto da incollare” su Supabase: crea tutte le tabelle, le policy e le funzioni RPC usate dal server.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
