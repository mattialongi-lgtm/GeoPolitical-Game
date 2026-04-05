Original prompt: lo storico dei guadagni di gold dal lavoro non viene visionato. risolvi

- Analisi iniziale: la schermata `Gestione Scorte > Oro` legge `/api/inventory/history/:itemId`.
- Problema trovato: per l'oro la route storico legge solo `factory_worker_logs`, mentre l'estrazione avanzata non persistiva il `gold` premium in una sorgente consultabile dallo storico.
- Piano: salvare `goldGenerated` nei log estrazione, unificare la lettura dello storico oro, e rendere piu robusta la gestione dei timestamp.
- Implementazione: la route storico ora unisce `factory_worker_logs` e `resource_extraction_logs` per l'oro, con timestamp normalizzati.
- Compatibilita: l'inserimento del nuovo campo `goldGenerated` fa fallback automatico al payload legacy se la migrazione DB non e ancora stata applicata.
- Verifica: `npm.cmd run lint` completato con successo.
