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

- Nuovo prompt: ricollegare urgentemente l'auto-lavoro al sistema di estrazione reale nella pagina Lavoro, con fix completo del flusso oro.
- Backend fix: `processAutomationTick()` esegue ora `executeExtractionWork(...)` invece del vecchio `performWorkAction(...)`, caricando lo stato utente corrente e i perk prima del tick.
- Robustezza estrazione: `executeExtractionWork(...)` valida la regione corrente, usa campi utente camelCase coerenti con `authenticate`, supporta auto-drink opzionale e usa `safe_deduct_currency()` anche per le estrazioni non-gold cosi consumo energia e payout restano atomici/sincronizzati.
- API automazione: `/api/automation/work` accetta ora anche `resourceType + regionId`, risolve la fabbrica attiva reale per quella risorsa e restituisce metadati (`resourceType`, `regionId`, `factoryId`) per la UI.
- UI fix: `/api/regions/:id/resources` espone il collegamento backend della risorsa (fabbrica attiva associata). `ResourceExtractView` usa quel binding per disabilitare lavoro/auto-lavoro quando manca una fabbrica reale, mostra il target backend e sposta i controlli di auto-work dentro il blocco di estrazione.
- Pulizia UX: `WorkView` non mostra piu il vecchio pannello auto-work scollegato dalle risorse; la lista fabbriche resta visibile ma senza i toggle automatici in quella pagina.
- Verifica: `npm.cmd run lint` OK. Test mirato: `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand backend/__tests__/services/extraction.service.test.ts` OK (11/11).
