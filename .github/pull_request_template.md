## PR Summary

<!-- 3-5 righe: cosa cambia e perché -->

## Security/DB Integration Review Checklist

- [ ] Questa PR tocca **authorization / access control**?
- [ ] Questa PR tocca **RPC SQL / migration / transazioni DB**?
- [ ] Questa PR tocca **flow regionali/state-based sensibili**?
- [ ] Questa PR tocca **write path critici / idempotenza / concurrency**?

Se hai risposto **sì** ad almeno una domanda:

- [ ] Ho applicato la label `needs-db-integration` **oppure** avviato il workflow manuale (`workflow_dispatch` con `force_db_integration=true`).
- [ ] Ho verificato l’esito del workflow `security-db-integration` (run strict o failure esplicita per secrets mancanti).

### Esempi rapidi (quando forzare)

- Modifica endpoint `POST/PUT/DELETE` su risorse regionali/state-based -> **forza** DB integration.
- Modifica RPC SQL / migration (`supabase/*.sql`) -> **forza** DB integration.
- Refactor di guard/authorization in `server.ts` senza toccare SQL -> in dubbio, **forza** DB integration.

## Validation Notes

<!-- Comandi/test eseguiti e risultato -->
