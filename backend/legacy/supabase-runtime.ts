import { createClient } from "@supabase/supabase-js";
import { createAtomicOperations } from "../services/atomic-operations";
import { EconomyService } from "../services/economy.service";
import { FactoryCreateRepository } from "../repositories/factory-create.repository";
import { FactoryCreateService } from "../services/factory-create.service";
import { FactoryEconomyRepository } from "../repositories/factory-economy.repository";
import { FactoryEconomyService } from "../services/factory-economy.service";
import { FactoryUpgradeRepository } from "../repositories/factory-upgrade.repository";
import { FactoryUpgradeService } from "../services/factory-upgrade.service";
import { PartyAssetsRepository } from "../repositories/party-assets.repository";
import { PartyAssetsService } from "../services/party-assets.service";
import { ProductionRepository } from "../repositories/production.repository";
import { ProductionService } from "../services/production.service";

export function createSupabaseRuntime() {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL or SUPABASE_SERVICE_ROLE_KEY missing in Environment Variables.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  return {
    supabase,
    atomicOperations: createAtomicOperations(supabase),
    factoryEconomyService: new FactoryEconomyService(new FactoryEconomyRepository(supabase)),
    factoryUpgradeService: new FactoryUpgradeService(new FactoryUpgradeRepository(supabase)),
    factoryCreateService: new FactoryCreateService(new FactoryCreateRepository(supabase)),
    partyAssetsService: new PartyAssetsService(new PartyAssetsRepository(supabase)),
    productionService: new ProductionService(new ProductionRepository(supabase)),
    economyService: new EconomyService(supabase),
  };
}
