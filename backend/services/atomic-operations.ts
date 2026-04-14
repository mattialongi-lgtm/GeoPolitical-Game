type RpcPayload = Record<string, any>;

async function callAtomicRpc<T>(supabase: any, name: string, payload: RpcPayload): Promise<T> {
  const { data, error } = await supabase.rpc(name, payload);
  if (error) {
    throw new Error(`[${name}] ${error.message || 'RPC failed'}`);
  }

  if (typeof data === 'string') {
    return JSON.parse(data) as T;
  }

  return data as T;
}

export function createAtomicOperations(supabase: any) {
  return {
    provisionInitialUser(input: {
      userId: string;
      email?: string | null;
      username?: string | null;
      defaultRegionId: string;
      lastEnergyUpdate?: number | null;
      lastLogin?: number | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_provision_user_atomic', {
        p_user_id: input.userId,
        p_email: input.email ?? null,
        p_username: input.username ?? null,
        p_default_region_id: input.defaultRegionId,
        p_last_energy_update: input.lastEnergyUpdate ?? null,
        p_last_login: input.lastLogin ?? null,
      });
    },

    startTravel(input: {
      userId: string;
      targetRegionId: string;
      travelTimeMs: number;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_start_travel_atomic', {
        p_user_id: input.userId,
        p_target_region_id: input.targetRegionId,
        p_travel_time_ms: input.travelTimeMs,
      });
    },

    attackRegion(input: {
      userId: string;
      targetRegionId: string;
      attackCooldownMs: number;
      baseEnergyCost: number;
      xpSuccess: number;
      xpFailure: number;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_attack_action_atomic', {
        p_user_id: input.userId,
        p_target_region_id: input.targetRegionId,
        p_attack_cooldown_ms: input.attackCooldownMs,
        p_base_energy_cost: input.baseEnergyCost,
        p_xp_success: input.xpSuccess,
        p_xp_failure: input.xpFailure,
      });
    },

    activateDeepExploration(input: {
      userId: string;
      nationId: string;
      resourceType: string;
      level: number;
      activationId?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_activate_deep_exploration_atomic', {
        p_user_id: input.userId,
        p_nation_id: input.nationId,
        p_resource_type: input.resourceType,
        p_level: input.level,
        p_activation_id: input.activationId ?? null,
      });
    },

    rechargeResource(input: {
      userId: string;
      regionId: string;
      resourceType: string;
      rechargeAmount?: number | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_recharge_resource_atomic', {
        p_user_id: input.userId,
        p_region_id: input.regionId,
        p_resource_type: input.resourceType,
        p_recharge_amount: input.rechargeAmount ?? null,
      });
    },
  };
}
