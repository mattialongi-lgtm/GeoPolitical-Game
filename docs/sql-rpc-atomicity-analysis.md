# Analisi SQL/RPC Atomicità — Priorità Reali

> **Data:** 2026-03-28  
> **Scope:** Valutazione pragmatica dei flussi critici consolidati per decidere dove introdurre atomicità DB reale (SQL/RPC Supabase) vs. continuare con compensazione applicativa.

---

## 1. Valutazione Sintetica dei Flussi Candidati

### 1.1 War Deploy (`POST /api/wars/deploy`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🔴 **CRITICO** — Nessuna atomicità, nessuna compensazione, nessun CAS |
| **Compensazione applicativa** | ❌ Nessuna. Se un UPDATE fallisce, gli altri non vengono annullati |
| **Operazioni DB** | 4 UPDATE/INSERT indipendenti: `users` (energy+money), `wars` (score), `war_participants` (damage), `action_logs` (log) |
| **Problema concreto** | L'energy/money viene dedotta con `user.energy - weapon.energy` calcolato in JS e applicato senza `WHERE energy >= X`. Race condition reale: due deploy concorrenti possono portare il saldo negativo |
| **Impatto RPC** | ✅ **Alto** — Una singola RPC eliminerebbe 4 failure point indipendenti + garantirebbe saldo non-negativo |
| **Complessità RPC** | **Media** — 4 tabelle, logica lineare, nessun branching complesso |

**Codice attuale critico (server.ts:2972-2975):**
```typescript
await supabase.from('users').update({
  energy: user.energy - weapon.energy,
  money: user.money - weapon.cash
}).eq('id', user.id);  // ⚠️ Nessun check saldo nel WHERE!
```

### 1.2 Produce (`POST /api/produce`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🟠 **ALTO** — Compensazione presente ma complessa e fragile |
| **Compensazione applicativa** | ✅ Presente: `restoreAfterResourceFailure()` con rollback multi-step (delete queue + refund money + refund resources) |
| **Operazioni DB** | 3+ step: `users` (money), `production_queue` (insert), `user_inventory` (N deduzioni risorse), cleanup items |
| **Problema concreto** | Se la deduzione della 3a risorsa fallisce, serve rollback di: queue + money + risorse 1-2. Se un rollback CAS fallisce dopo 5 tentativi → stato inconsistente permanente |
| **Impatto RPC** | ✅ **Alto** — Eliminerebbe catena di compensazione complessa, garantirebbe atomicità money+queue+risorse |
| **Complessità RPC** | **Alta** — Numero variabile di risorse, lookup da `user_inventory`, logica condizionale |

### 1.3 Factories/Deposit (`POST /api/factories/deposit`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🟠 **MEDIO-ALTO** — CAS presente ma sotto stress concorrente |
| **Compensazione applicativa** | ✅ Presente: `tryRefundUserMoney()` con CAS retry (5 tentativi) |
| **Operazioni DB** | 2 step: `users` (money via RPC `safe_deduct_currency`), `factories` (budget via CAS) |
| **Problema concreto** | Depositi concorrenti sulla stessa fabbrica: la CAS sulla colonna `budget` può fallire ripetutamente se c'è alta contesa. Se 5 retry esauriti → refund money. Se refund fallisce → money persa |
| **Impatto RPC** | ✅ **Medio** — Semplificherebbe il flow, ma il rischio pratico è basso (contesa rara) |
| **Complessità RPC** | **Bassa** — 2 tabelle, logica lineare, già esiste pattern simile |

### 1.4 Factories/Create (`POST /api/factories/create`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🟡 **MEDIO** — Money deducted via RPC, factory insert è singolo |
| **Compensazione applicativa** | ✅ Presente: `tryRefundUserMoney()` se insert fallisce |
| **Operazioni DB** | 2 step: `users` (money via RPC), `factories` (insert) |
| **Problema concreto** | Se l'INSERT fabbrica fallisce (constraint violation, rete), parte il refund CAS. Rischio reale basso: INSERT fallisce raramente |
| **Impatto RPC** | 🟡 **Basso** — Il pattern attuale funziona bene nella pratica |
| **Complessità RPC** | **Bassa** — Ma ROI basso |

### 1.5 Factories/Upgrade (`POST /api/factories/upgrade`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🟢 **BASSO** — RPC `upgrade_factory` già atomica con `FOR UPDATE` locks |
| **Compensazione applicativa** | Solo nel fallback JS (se RPC non disponibile) |
| **Operazioni DB** | RPC path: atomico. Fallback: 3 step con CAS |
| **Problema concreto** | Già risolto. L'RPC è il pattern gold-standard del progetto |
| **Impatto RPC** | ✅ Già fatto |
| **Complessità RPC** | N/A |

### 1.6 Parties/Contribute (`POST /api/parties/contribute`)

| Aspetto | Valutazione |
|---|---|
| **Rischio residuo** | 🟡 **MEDIO** — Compensazione presente, 2 path (currency / inventory) |
| **Compensazione applicativa** | ✅ Presente: refund sender se credit receiver fallisce |
| **Operazioni DB** | Currency path: `users` debit (RPC) + `users` credit (CAS) + `party_logs` insert. Inventory path: `user_inventory` debit (CAS) + `user_inventory` credit (CAS) + `party_logs` insert |
| **Problema concreto** | Transfer sender→receiver: se il credit fallisce, il refund CAS può fallire. Ma nella pratica la contesa è bassa (trasferimenti non frequentissimi) |
| **Impatto RPC** | 🟡 **Medio-Basso** — Migliorerebbe la garanzia, ma il rischio pratico è basso |
| **Complessità RPC** | **Media** — Due path diversi (currency/inventory), branching |

---

## 2. Top 3 Candidati SQL/RPC — Ordinati per ROI

### 🥇 #1 — War Deploy RPC

**ROI: MASSIMO**

- **Rischio attuale:** Critico. È l'unico flusso ad alta frequenza senza NESSUNA protezione atomica
- **Frequenza:** Altissima durante le guerre (ogni giocatore deploya più volte)
- **Invarianti violabili:** Saldo negativo energy/money, score desincronizzato, war_participants inconsistente
- **Complessità RPC:** Media (4 tabelle, logica lineare)
- **Semplificazione backend:** Elimina 4 UPDATE indipendenti, elimina il rischio di race condition sul saldo, elimina il check pre-deduct in JS

### 🥈 #2 — Produce RPC

**ROI: ALTO**

- **Rischio attuale:** Alto. Compensazione presente ma catena fragile (money + queue + N risorse)
- **Frequenza:** Media-alta (produzione armi è frequente)
- **Invarianti violabili:** Risorse dedotte parzialmente, queue orfana, money non rimborsata
- **Complessità RPC:** Alta (N risorse variabili, lookup inventory, calcolo tempi)
- **Semplificazione backend:** Eliminerebbe `restoreAfterResourceFailure()`, `tryDeductResource()`, `tryRefundResource()`, `tryRefundMoney()` — circa 120 righe di compensazione

### 🥉 #3 — Factories/Deposit RPC

**ROI: MEDIO**

- **Rischio attuale:** Medio. CAS + compensazione funzionano, ma sotto alta contesa possono fallire
- **Frequenza:** Media (depositi nelle fabbriche)
- **Invarianti violabili:** Money dedotta ma budget non incrementato
- **Complessità RPC:** Bassa (2 tabelle, operazione semplice)
- **Semplificazione backend:** Eliminerebbe CAS retry su budget + refund logic — circa 50 righe

---

## 3. Scelta: UNA Sola Priorità SQL

### ✅ **War Deploy RPC** (`rpc_war_deploy`)

---

## 4. Motivazione Forte

| Criterio | War Deploy | Produce | Deposit |
|---|---|---|---|
| **Rischio residuo** | 🔴 Critico (zero protezioni) | 🟠 Alto (compensazione fragile) | 🟡 Medio (CAS+refund) |
| **Frequenza** | ⬆️ Altissima in wartime | ⬆️ Alta | ➡️ Media |
| **Compensazione oggi** | ❌ Nessuna | ✅ Presente (ma fragile) | ✅ Presente (funziona) |
| **Complessità RPC** | Media | Alta | Bassa |
| **Righe backend eliminate** | ~30 (inlines sostituiti) | ~120 (compensazione) | ~50 (CAS+refund) |
| **Race condition attiva** | ✅ SÌ — saldo negativo possibile | ⚠️ Possibile su inventory | ⚠️ Possibile su budget |

**War Deploy è la scelta netta perché:**

1. **È l'unico flusso critico senza alcuna protezione.** Tutti gli altri hanno almeno CAS + compensazione. War deploy fa 4 UPDATE indipendenti senza controllo.

2. **Ha una race condition attiva e sfruttabile.** Il saldo energy/money viene calcolato in JS (`user.energy - weapon.energy`) e applicato con un UPDATE senza WHERE clause sul saldo. Due deploy concorrenti possono entrambi "vedere" energy=10, spendere 8, e il saldo va a 2 invece che a -6 (o peggio, entrambi passano).

3. **È il flusso a più alta frequenza.** Durante una guerra, decine di giocatori deployano contemporaneamente. È il caso d'uso con più alta probabilità di concorrenza reale.

4. **La complessità della RPC è gestibile.** 4 tabelle, logica lineare, nessun branching. Il pattern è simile a `upgrade_factory` che è già in produzione.

5. **Non richiede refactoring del backend.** Basta sostituire le 4 query con una sola chiamata RPC + gestire il fallback JS come già fa `upgrade_factory`.

---

## 5. Bozza Pratica della Futura RPC

### 5.1 Nome e Signature

```sql
CREATE OR REPLACE FUNCTION rpc_war_deploy(
  p_user_id     UUID,
  p_war_id      UUID,
  p_side        TEXT,        -- 'attacker' | 'defender'
  p_weapon_id   TEXT,        -- 'infantry' | 'tank' | 'airstrike' | 'battleship'
  p_energy_cost INT,
  p_money_cost  NUMERIC,
  p_damage      INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user       RECORD;
  v_war        RECORD;
  v_new_score  INT;
BEGIN
  -- 1. Lock user row + verify saldo
  SELECT id, energy, money INTO v_user
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Utente non trovato.');
  END IF;

  IF v_user.energy < p_energy_cost THEN
    RETURN json_build_object('error',
      format('Energia insufficiente. Servono %s, hai %s.', p_energy_cost, v_user.energy));
  END IF;

  IF v_user.money < p_money_cost THEN
    RETURN json_build_object('error',
      format('Fondi insufficienti. Servono $%s, hai $%s.', p_money_cost, v_user.money));
  END IF;

  -- 2. Lock war row + verify active
  SELECT id, status, "attackerScore", "defenderScore"
  INTO v_war
  FROM wars
  WHERE id = p_war_id
  FOR UPDATE;

  IF NOT FOUND OR v_war.status != 'active' THEN
    RETURN json_build_object('error', 'Guerra non trovata o non attiva.');
  END IF;

  -- 3. Atomic deduct energy + money
  UPDATE users
  SET energy = energy - p_energy_cost,
      money  = money  - p_money_cost
  WHERE id = p_user_id;

  -- 4. Atomic increment war score
  IF p_side = 'attacker' THEN
    UPDATE wars
    SET "attackerScore" = "attackerScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."attackerScore" + p_damage;
  ELSE
    UPDATE wars
    SET "defenderScore" = "defenderScore" + p_damage,
        "updatedAt"     = NOW()
    WHERE id = p_war_id;
    v_new_score := v_war."defenderScore" + p_damage;
  END IF;

  -- 5. Upsert war_participants (damage tracking)
  INSERT INTO war_participants ("warId", "oddsPlayerId", side, damage, deploys)
  VALUES (p_war_id, p_user_id, p_side, p_damage, 1)
  ON CONFLICT ("warId", "oddsPlayerId")
  DO UPDATE SET
    damage  = war_participants.damage + p_damage,
    deploys = war_participants.deploys + 1;

  -- 6. Insert action log
  INSERT INTO action_logs ("userId", action, details, "createdAt")
  VALUES (
    p_user_id,
    'WAR_DEPLOY',
    json_build_object(
      'warId',    p_war_id,
      'side',     p_side,
      'weaponId', p_weapon_id,
      'damage',   p_damage,
      'cost',     json_build_object('energy', p_energy_cost, 'money', p_money_cost)
    ),
    NOW()
  );

  -- 7. Return success con saldi aggiornati
  RETURN json_build_object(
    'success',   true,
    'damage',    p_damage,
    'newScore',  v_new_score,
    'energy',    v_user.energy - p_energy_cost,
    'money',     v_user.money  - p_money_cost
  );
END;
$$;
```

### 5.2 Tabelle Toccate

| Tabella | Operazione | Lock |
|---|---|---|
| `users` | UPDATE (energy, money) | `FOR UPDATE` |
| `wars` | UPDATE (attackerScore/defenderScore) | `FOR UPDATE` |
| `war_participants` | UPSERT (damage, deploys) | Implicit via INSERT ON CONFLICT |
| `action_logs` | INSERT | Nessun lock necessario |

### 5.3 Invarianti Garantite

1. **Saldo non-negativo:** `WHERE energy >= X AND money >= X` nel lock pre-check. Impossibile energy < 0 o money < 0.
2. **Atomicità completa:** Se qualsiasi step fallisce, l'intera transazione fa rollback. Nessun stato parziale.
3. **Score consistente:** Il war score viene incrementato dentro la stessa transazione della deduzione risorse. Impossibile "spendere senza fare danno".
4. **War_participants accurato:** Il tracking del danno è sempre sincronizzato con lo score reale.
5. **Concorrenza sicura:** `FOR UPDATE` serializza i deploy sulla stessa guerra e lo stesso utente. No race conditions.
6. **Action log veritiero:** Il log viene scritto solo se la transazione completa con successo.

### 5.4 Cosa Semplificherebbe nel Backend

**Prima (server.ts ~60 righe, 4 round-trip DB):**
```
1. Check energy >= cost        (JS, già letto da authenticate)
2. Check money >= cost         (JS, già letto da authenticate)
3. UPDATE users                (DB round-trip 1 — senza WHERE check)
4. UPDATE wars                 (DB round-trip 2)
5. INSERT/UPDATE war_participants (DB round-trip 3)
6. INSERT action_logs          (DB round-trip 4)
```

**Dopo (~15 righe, 1 round-trip DB):**
```
1. Calcola damage in JS (perks, bonus, ecc.)
2. Chiama rpc_war_deploy       (DB round-trip 1 — tutto atomico)
3. Se errore → restituisci errore al client
4. Se success → restituisci risultato
```

**Risparmio concreto:**
- Da 4 a 1 round-trip DB
- Eliminati check JS pre-deduct (la RPC li fa atomicamente)
- Eliminata la race condition sul saldo
- Zero compensazione necessaria (transazione atomica)
- Pattern identico a `upgrade_factory` già funzionante

### 5.5 Migration File Suggerito

```
supabase/migration_war_deploy_rpc.sql
```

Contenuto:
1. `CREATE OR REPLACE FUNCTION rpc_war_deploy(...)` come sopra
2. Eventuali indici se necessari per performance:
   - `CREATE INDEX IF NOT EXISTS idx_war_participants_war_player ON war_participants("warId", "oddsPlayerId");`
3. Nessuna modifica a tabelle esistenti — solo nuova RPC

### 5.6 Integrazione Backend (Schema di Massima)

```typescript
// Nel deploy endpoint - pattern identico a upgrade_factory
try {
  const { data } = await supabase.rpc('rpc_war_deploy', {
    p_user_id: user.id,
    p_war_id: warId,
    p_side: side,
    p_weapon_id: weaponId,
    p_energy_cost: weapon.energy,
    p_money_cost: weapon.cash,
    p_damage: totalDamage
  });

  const result = typeof data === 'string' ? JSON.parse(data) : data;
  if (result.error) return res.status(400).json({ error: result.error });

  return res.json({ success: true, damage: result.damage, ... });

} catch (rpcError) {
  // Fallback JS (come upgrade_factory)
  // Usare safe_deduct_currency + CAS per gli altri step
}
```

---

## 6. Cosa NON Toccherei Ancora

### ❌ Produce RPC — Non ora

Motivazione: La compensazione applicativa (`restoreAfterResourceFailure`) funziona ed è ben testata. La complessità della RPC è alta (N risorse variabili, calcolo tempi queue). Il rischio pratico è medio perché la compensazione copre i casi comuni. **Candidato per il prossimo step dopo War Deploy.**

### ❌ Factories/Deposit RPC — Non ora

Motivazione: CAS + refund funzionano nella pratica. La contesa sui depositi è bassa (un solo proprietario deposita alla volta). Il pattern attuale è sufficiente. **Potrebbe diventare priorità solo se emergono segnalazioni di depositi persi.**

### ❌ Factories/Create — Non ora

Motivazione: Rischio basso. L'INSERT di una fabbrica raramente fallisce. Il refund CAS copre il caso edge. Non vale l'investimento.

### ❌ Factories/Upgrade — Già fatto

L'RPC `upgrade_factory` è già in produzione con `FOR UPDATE` locks. È il benchmark per come dovrebbero funzionare le altre RPC.

### ❌ Parties/Contribute — Non ora

Motivazione: Frequenza bassa, compensazione presente, rischio pratico minimo. Non giustifica l'effort.

### ❌ Refactor dell'architettura CAS/retry generale — Non ora

Il pattern CAS con 5 retry funziona come safety net per tutti i flussi che hanno compensazione. Non ha senso cambiare l'infrastruttura quando il prossimo step è aggiungere RPC ai flussi specifici che ne hanno bisogno.

---

## Riepilogo Decisionale

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIORITÀ UNICA                           │
│                                                             │
│   🎯  War Deploy RPC (rpc_war_deploy)                      │
│                                                             │
│   Perché: Unico flusso critico ad alta frequenza            │
│           senza NESSUNA protezione atomica                  │
│                                                             │
│   ROI: Massimo (rischio critico → zero rischio)             │
│   Effort: Medio (1 RPC, 4 tabelle, logica lineare)         │
│   Pattern: Identico a upgrade_factory già in produzione     │
│                                                             │
│   Prossimo step dopo questo: Produce RPC                    │
└─────────────────────────────────────────────────────────────┘
```
