import {
  getExtractionFactoryMeta,
  isExtractionFactoryEligible,
  pickPreferredExtractionFactory,
} from '../utils/extraction-factory';

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
  FACTORY_CONFIG: any;
}) {
  const { supabase, FACTORY_CONFIG } = deps;

  const getFactoryMeta = (factory: any) => getExtractionFactoryMeta(factory, FACTORY_CONFIG);

  const resolveFactoryFromResource = async (regionId: string, resourceType: string) => {
    const factoryTypeCandidates = Object.entries(FACTORY_CONFIG?.TYPES || {})
      .filter(([, def]: any) => def?.resource === resourceType)
      .map(([type]) => type);

    if (factoryTypeCandidates.length === 0) {
      return { factory: null, error: "Nessuna fabbrica compatibile per questa risorsa." };
    }

    const { data: factories, error } = await supabase
      .from('factories')
      .select('id, name, type, level, regionId, isActive, payMode')
      .eq('regionId', regionId)
      .in('type', factoryTypeCandidates)
      .eq('isActive', true)
      .eq('payMode', 'resource')
      .order('level', { ascending: false });

    if (error) throw error;
    return { factory: pickPreferredExtractionFactory(factories, FACTORY_CONFIG, resourceType), error: null };
  };

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

    if (!autoWork?.factoryId) {
      return res.json({ autoWork: null });
    }

    const { data: factory, error: factoryError } = await supabase
      .from('factories')
      .select('id, name, type, level, regionId, isActive, payMode')
      .eq('id', autoWork.factoryId)
      .maybeSingle();

    const factoryMeta = getFactoryMeta(factory);
    if (factoryError || !factory || factory.isActive === false || !factoryMeta) {
      await supabase.from('work_auto_actions').update({ isActive: false }).eq('id', autoWork.id);
      return res.json({
        autoWork: null,
        warning: "Auto-lavoro disattivato: la risorsa selezionata non è più collegata a una fabbrica attiva.",
      });
    }

    res.json({
      autoWork: {
        ...autoWork,
        ...factoryMeta,
      },
    });
  }

  // POST /api/automation/work
  async function setAutoWork(req: any, res: any) {
    try {
      const { factoryId, resourceType, regionId, enabled } = req.body || {};
      if (enabled === false) {
        const { error: disableError } = await supabase.from('work_auto_actions')
          .update({ isActive: false })
          .eq('userId', req.user.id)
          .eq('isActive', true);
        if (disableError) throw disableError;
        return res.json({ success: true, message: "Auto-lavoro disattivato." });
      }

      let targetFactory = null as any;
      if (factoryId) {
        const { data: factory, error: factoryError } = await supabase
          .from('factories')
          .select('id, name, type, level, regionId, isActive, payMode')
          .eq('id', factoryId)
          .maybeSingle();
        if (factoryError) throw factoryError;
        targetFactory = factory;
      } else {
        const targetRegionId = String(regionId || req.user?.regionId || '').trim().toUpperCase();
        const targetResourceType = String(resourceType || '').trim();
        if (!targetRegionId || !targetResourceType) {
          return res.status(400).json({ error: "resourceType e regionId sono obbligatori per l'auto-lavoro estrattivo." });
        }
        if (String(req.user?.regionId || '').trim().toUpperCase() !== targetRegionId) {
          return res.status(400).json({ error: "Puoi attivare l'auto-lavoro solo nella tua regione corrente." });
        }

        const resolved = await resolveFactoryFromResource(targetRegionId, targetResourceType);
        if (resolved.error) {
          return res.status(400).json({ error: resolved.error });
        }
        targetFactory = resolved.factory;
      }

      if (targetFactory && !isExtractionFactoryEligible(targetFactory, FACTORY_CONFIG)) {
        return res.status(400).json({ error: "Auto-lavoro estrattivo disponibile solo su fabbriche attive in Modalita Risorse." });
      }

      const factoryMeta = getFactoryMeta(targetFactory);
      if (!targetFactory || targetFactory.isActive === false || !factoryMeta) {
        return res.status(404).json({ error: "Nessuna fabbrica attiva collegata a questa risorsa nella regione selezionata." });
      }

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
        factoryId: targetFactory.id,
        mode: 'standard',
        isActive: true,
        activatedAt: new Date().toISOString(),
        // Keep the first execution eligible on the next scheduler pass.
        lastFiredAt: null,
        expiresAt,
      }, { onConflict: 'userId' });
      if (upsertError) throw upsertError;

      res.json({
        success: true,
        expiresAt,
        autoWork: {
          ...factoryMeta,
          expiresAt,
        },
      });
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
