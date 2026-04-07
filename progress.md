Original prompt: lo storico dei guadagni di gold dal lavoro non viene visionato. risolvi

- Analisi iniziale: la schermata `Gestione Scorte > Oro` legge `/api/inventory/history/:itemId`.
- Problema trovato: per l'oro la route storico legge solo `factory_worker_logs`, mentre l'estrazione avanzata non persistiva il `gold` premium in una sorgente consultabile dallo storico.
- Piano: salvare `goldGenerated` nei log estrazione, unificare la lettura dello storico oro, e rendere piu robusta la gestione dei timestamp.
- Implementazione: la route storico ora unisce `factory_worker_logs` e `resource_extraction_logs` per l'oro, con timestamp normalizzati.
- Compatibilita: l'inserimento del nuovo campo `goldGenerated` fa fallback automatico al payload legacy se la migrazione DB non e ancora stata applicata.
- Verifica: `npm.cmd run lint` completato con successo.

- Nuovo prompt: l'auto-lavoro risulta attivo ma non consuma energia e non accredita payout.
- Analisi: l'endpoint di attivazione impostava `lastFiredAt` subito a `now`, quindi il primo ciclo automatico non era eleggibile al tick successivo e sembrava fermo.
- Hardening: nel job scheduler l'energia automatica ora normalizza `lastEnergyUpdate` anche se arriva come stringa ISO o numero serializzato.
- Compatibilita fix: il tick backend tratta anche le vecchie righe auto-work con `lastFiredAt ~= activatedAt` come "mai eseguite", cosi recuperano senza stop/start manuale.
- Fix progetto: `server.ts` non importa piu staticamente `firebase-admin`; ora lo carica in modo opzionale e il login Firebase risponde `503` se il modulo non e disponibile invece di rompere il typecheck.
- Verifica: `npm.cmd run lint` ora passa.
