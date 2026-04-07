/**
 * Automation Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers:
 *   GET  /api/automation/work
 *   POST /api/automation/work
 *   GET  /api/automation/training
 *   GET  /api/automation/war-attacks
 *   POST /api/automation/training
 */

/* ------------------------------------------------------------------ */
/*  Automation constants & helpers (server.ts lines 4316-4370)         */
/* ------------------------------------------------------------------ */

const AUTOMATION_EXPIRE_MS = 24 * 60 * 60 * 1000;

const isAutomationExpired = (activatedAt?: string | null, expiresAt?: string | null, now = Date.now()) => {
  if (expiresAt) return new Date(expiresAt).getTime() <= now;
  if (!activatedAt) return false;
  return (now - new Date(activatedAt).getTime()) >= AUTOMATION_EXPIRE_MS;
};

const isAutoAttackCompatibleWithAutoWork = (autoType: any): boolean => autoType === 'hourly';

const autoWorkIncompatibleMessage = "Auto-Work è compatibile solo con il Danno Orario, non con l'Auto-War standard.";

/* ------------------------------------------------------------------ */
/*  Factory                                                            */
/* ------------------------------------------------------------------ */

export function createAutomationHandlers(deps: {
  supabase: any;
  GAME_CONFIG: any;
}) {
  const { supabase } = deps;

  // GET /api/automation/work
  async function getAutoWork(req: any, res: any) {
    const { data: autoWork, error: readError } = await supabase
      .from('work_auto_actions')
      .select('*')
      .eq('userId', req.user.id)
      .eq('isActive', true)
      .maybeSingle();

    if (readError) {
      if (readError.code === 'PGRST205') {
        return res.json({
          autoWork: null,
          disabled: true,
          warning: "Tabella automazioni mancante: applica supabase/migration_automation_modes.sql nel SQL Editor di Supabase.",
        });
      }
      return res.status(500).json({ error: "Errore nel caricamento dell'auto-lavoro." });
    }

    if (autoWork && isAutomationExpired(autoWork.activatedAt, autoWork.expiresAt)) {
      await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', autoWork.id);
      return res.json({ autoWork: null });
    }

    res.json({ autoWork: autoWork || null });
  }

  // POST /api/automation/work
  async function setAutoWork(req: any, res: any) {
    try {
      const { factoryId, enabled } = req.body || {};
      if (enabled === false) {
        const { error: disableError } = await supabase.from('work_auto_actions')
          .update({ isActive: false })
          .eq('userId', req.user.id)
          .eq('isActive', true);
        if (disableError) throw disableError;
        return res.json({ success: true, message: "Auto-lavoro disattivato." });
      }

      if (!factoryId) return res.status(400).json({ error: "Factory mancante per auto-lavoro." });

      const { data: activeAutoAttacks, error: autoAttacksError } = await supabase
        .from('war_auto_attacks')
        .select('id, autoType, activatedAt, expiresAt')
        .eq('userId', req.user.id)
        .eq('isActive', true);
      if (autoAttacksError) throw autoAttacksError;

      for (const attack of activeAutoAttacks || []) {
        if (isAutomationExpired(attack.activatedAt, attack.expiresAt)) {
          await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', attack.id);
          continue;
        }

        if (!isAutoAttackCompatibleWithAutoWork(attack.autoType)) {
          return res.status(400).json({ error: autoWorkIncompatibleMessage });
        }
      }

      const expiresAt = new Date(Date.now() + AUTOMATION_EXPIRE_MS).toISOString();
      const { error: upsertError } = await supabase.from('work_auto_actions').upsert({
        userId: req.user.id,
        factoryId,
        mode: 'standard',
        isActive: true,
        activatedAt: new Date().toISOString(),
        // Keep the first execution eligible on the next scheduler pass.
        lastFiredAt: null,
        expiresAt,
      }, { onConflict: 'userId' });
      if (upsertError) throw upsertError;

      res.json({ success: true, expiresAt });
    } catch (err: any) {
      if (err?.code === 'PGRST205') {
        return res.status(503).json({ error: "Automazioni non disponibili: applica supabase/migration_automation_modes.sql nel DB (manca work_auto_actions)." });
      }
      res.status(500).json({ error: "Errore nell'impostazione dell'auto-lavoro." });
    }
  }

  // GET /api/automation/training
  async function getAutoTraining(req: any, res: any) {
    const { data: autoTraining, error: readError } = await supabase
      .from('training_auto_actions')
      .select('*')
      .eq('userId', req.user.id)
      .eq('isActive', true)
      .maybeSingle();

    if (readError) {
      if (readError.code === 'PGRST205') {
        return res.json({
          autoTraining: null,
          disabled: true,
          warning: "Tabella automazioni mancante: applica supabase/migration_automation_modes.sql nel SQL Editor di Supabase.",
        });
      }
      return res.status(500).json({ error: "Errore nel caricamento del danno orario." });
    }

    if (autoTraining && isAutomationExpired(autoTraining.activatedAt, autoTraining.expiresAt)) {
      await supabase.from('training_auto_actions').update({ isActive: false }).eq('id', autoTraining.id);
      return res.json({ autoTraining: null });
    }

    res.json({ autoTraining: autoTraining || null });
  }

  // GET /api/automation/war-attacks
  async function getAutoWarAttacks(req: any, res: any) {
    const { data: autoAttacks } = await supabase
      .from('war_auto_attacks')
      .select('*')
      .eq('userId', req.user.id)
      .eq('isActive', true)
      .order('activatedAt', { ascending: false });

    const activeRows = [];
    for (const attack of autoAttacks || []) {
      if (isAutomationExpired(attack.activatedAt, attack.expiresAt)) {
        await supabase.from('war_auto_attacks').update({ isActive: false }).eq('id', attack.id);
        continue;
      }
      activeRows.push(attack);
    }

    res.json({ autoAttacks: activeRows });
  }

  // POST /api/automation/training
  async function setAutoTraining(req: any, res: any) {
    try {
      const { mode, enabled } = req.body || {};
      if (enabled === false) {
        await supabase.from('training_auto_actions').update({ isActive: false }).eq('userId', req.user.id);
        return res.json({ success: true, message: "Danno orario disattivato." });
      }

      if (mode !== 'hourly') {
        return res.status(400).json({ error: "La modalità addestramento automatica supporta solo il danno orario." });
      }

      const expiresAt = new Date(Date.now() + AUTOMATION_EXPIRE_MS).toISOString();
      await supabase.from('training_auto_actions').upsert({
        userId: req.user.id,
        mode,
        isActive: true,
        activatedAt: new Date().toISOString(),
        lastFiredAt: new Date().toISOString(),
        expiresAt,
      }, { onConflict: 'userId' });

      res.json({ success: true, expiresAt, mode });
    } catch (err: any) {
      if (err?.code === 'PGRST205') {
        return res.status(503).json({ error: "Automazioni non disponibili: applica supabase/migration_automation_modes.sql nel DB (manca training_auto_actions)." });
      }
      res.status(500).json({ error: "Errore nell'impostazione del danno orario." });
    }
  }

  return {
    getAutoWork,
    setAutoWork,
    getAutoTraining,
    getAutoWarAttacks,
    setAutoTraining,
  };
}
