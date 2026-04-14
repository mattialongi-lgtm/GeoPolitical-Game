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

    listFactoryMarket(input: {
      factoryId: string;
      sellerId: string;
      askingPrice: number;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_factory_market_list_atomic', {
        p_factory_id: input.factoryId,
        p_seller_id: input.sellerId,
        p_asking_price: input.askingPrice,
        p_operation_key: input.operationKey ?? null,
      });
    },

    cancelFactoryMarket(input: {
      listingId: string;
      sellerId: string;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_factory_market_cancel_atomic', {
        p_listing_id: input.listingId,
        p_seller_id: input.sellerId,
        p_operation_key: input.operationKey ?? null,
      });
    },

    createParty(input: {
      userId: string;
      username?: string | null;
      regionId?: string | null;
      name: string;
      ideology?: string | null;
      tag?: string | null;
      description?: string | null;
      logo?: string | null;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_create_party_atomic', {
        p_user_id: input.userId,
        p_username: input.username ?? null,
        p_region_id: input.regionId ?? null,
        p_name: input.name,
        p_ideology: input.ideology ?? '',
        p_tag: input.tag ?? '',
        p_description: input.description ?? '',
        p_logo: input.logo ?? '',
        p_operation_key: input.operationKey ?? null,
      });
    },

    joinParty(input: {
      inviteId: string;
      userId: string;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_join_party_atomic', {
        p_invite_id: input.inviteId,
        p_user_id: input.userId,
        p_operation_key: input.operationKey ?? null,
      });
    },

    createBloc(input: {
      userId: string;
      stateId: string;
      name: string;
      description?: string | null;
      logo?: string | null;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_create_bloc_atomic', {
        p_user_id: input.userId,
        p_state_id: input.stateId,
        p_name: input.name,
        p_description: input.description ?? '',
        p_logo: input.logo ?? '',
        p_operation_key: input.operationKey ?? null,
      });
    },

    applyToBloc(input: {
      blocId: string;
      userId: string;
      stateId: string;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_apply_to_bloc_atomic', {
        p_bloc_id: input.blocId,
        p_user_id: input.userId,
        p_state_id: input.stateId,
        p_operation_key: input.operationKey ?? null,
      });
    },

    voteBlocApplication(input: {
      applicationId: string;
      voterUserId: string;
      voterStateId: string;
      choice: number;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_vote_bloc_application_atomic', {
        p_application_id: input.applicationId,
        p_voter_user_id: input.voterUserId,
        p_voter_state_id: input.voterStateId,
        p_choice: input.choice,
        p_operation_key: input.operationKey ?? null,
      });
    },

    proposeBlocRegulation(input: {
      blocId: string;
      proposerUserId: string;
      proposerStateId: string;
      type: string;
      proposedValue: number;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_propose_bloc_regulation_atomic', {
        p_bloc_id: input.blocId,
        p_proposer_user_id: input.proposerUserId,
        p_proposer_state_id: input.proposerStateId,
        p_type: input.type,
        p_proposed_value: input.proposedValue,
        p_operation_key: input.operationKey ?? null,
      });
    },

    voteBlocRegulation(input: {
      proposalId: string;
      voterUserId: string;
      voterStateId: string;
      choice: number;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_vote_bloc_regulation_atomic', {
        p_proposal_id: input.proposalId,
        p_voter_user_id: input.voterUserId,
        p_voter_state_id: input.voterStateId,
        p_choice: input.choice,
        p_operation_key: input.operationKey ?? null,
      });
    },

    proposeLaw(input: {
      userId: string;
      regionId: string;
      type: string;
      params?: Record<string, any> | null;
      forceImmediate?: boolean;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_propose_law_atomic', {
        p_user_id: input.userId,
        p_region_id: input.regionId,
        p_type: input.type,
        p_params: input.params ?? {},
        p_force_immediate: input.forceImmediate ?? false,
        p_operation_key: input.operationKey ?? null,
      });
    },

    resolveLaw(input: {
      lawId: string;
      actorUserId: string;
      action: string;
      operationKey?: string | null;
    }) {
      return callAtomicRpc<any>(supabase, 'rpc_resolve_law_atomic', {
        p_law_id: input.lawId,
        p_actor_user_id: input.actorUserId,
        p_action: input.action,
        p_operation_key: input.operationKey ?? null,
      });
    },
  };
}
