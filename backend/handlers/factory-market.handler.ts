/**
 * Factory Market Handlers
 *
 * Extracted from server.ts — no logic changes.
 * Covers: /api/factory-market, /api/factory-market/list,
 *   /api/factory-market/buy, /api/factory-market/cancel
 */
import { logger } from '../utils/logger';

export function createFactoryMarketHandlers(deps: {
  supabase: any;
  atomicOperations?: any;
  generateSecureId: (len: number) => string;
  estimateFactoryValue: (type: string, level: number, recentProfit?: number) => number;
  FACTORY_CONFIG: any;
  factoryYieldMultiplier: (level: number) => number;
  factoryStorageLimit: (type: string, level: number) => number;
}) {
  const {
    supabase,
    atomicOperations,
    estimateFactoryValue,
    FACTORY_CONFIG,
    factoryYieldMultiplier,
    factoryStorageLimit,
  } = deps;

  // GET /api/factory-market
  async function getMarket(req: any, res: any) {
    try {
      const { data: listings, error } = await supabase.from('factory_market_listings')
        .select('*')
        .eq('status', 'active')
        .order('listedAt', { ascending: false });

      if (error) throw error;

      // Get all factory details
      const factoryIds = (listings || []).map((l: any) => l.factoryId);
      let factoryMap: Record<string, any> = {};
      if (factoryIds.length > 0) {
        const { data: factories } = await supabase.from('factories').select('*').in('id', factoryIds);
        (factories || []).forEach((f: any) => { factoryMap[f.id] = f; });
      }

      // Get seller names
      const sellerIds = [...new Set((listings || []).map((l: any) => l.sellerId))];
      const sellerMap: Record<string, string> = {};
      if (sellerIds.length > 0) {
        const { data: sellers } = await supabase.from('users').select('id, username').in('id', sellerIds);
        (sellers || []).forEach((s: any) => { sellerMap[s.id] = s.username; });
      }

      const enriched = (listings || []).map((l: any) => {
        const factory = factoryMap[l.factoryId] || {};
        const typeDef = FACTORY_CONFIG.TYPES[factory.type] || {};
        return {
          ...l,
          sellerName: sellerMap[l.sellerId] || 'Sconosciuto',
          factory: {
            ...factory,
            typeDef,
            yieldMultiplier: Math.round(factoryYieldMultiplier(factory.level || 1) * 100) / 100,
            storageCapacity: factoryStorageLimit(factory.type, factory.level || 1),
            estimatedValue: estimateFactoryValue(factory.type, factory.level || 1),
          },
        };
      });

      res.json(enriched);
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/factory-market/list
  async function listForSale(req: any, res: any) {
    const user = req.user;
    const { factoryId, askingPrice } = req.body;

    if (!factoryId || !askingPrice || askingPrice <= 0) {
      return res.status(400).json({ error: "Parametri non validi." });
    }

    try {
      if (atomicOperations?.listFactoryMarket) {
        const result = await atomicOperations.listFactoryMarket({
          factoryId,
          sellerId: user.id,
          askingPrice: Math.floor(askingPrice),
          operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
        });

        if (!result?.success) {
          const codeToStatus: Record<string, number> = {
            invalid_input: 400,
            factory_not_found: 404,
            forbidden: 403,
            listing_active: 409,
          };
          return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
        }

        return res.json({ success: true, listing: result.listing });
      }

      const { data: factory } = await supabase.from('factories').select('*').eq('id', factoryId).single();
      if (!factory) return res.status(404).json({ error: "Fabbrica non trovata." });
      if (factory.ownerUserId !== user.id) return res.status(403).json({ error: "Non sei il proprietario." });
      if (factory.listedForSale) return res.status(400).json({ error: "Fabbrica già in vendita." });

      const { data: listing, error: listErr } = await supabase.from('factory_market_listings').insert({
        factoryId,
        sellerId: user.id,
        askingPrice: Math.floor(askingPrice),
        status: 'active',
      }).select().single();
      if (listErr) throw listErr;
      await supabase.from('factories').update({ listedForSale: true, salePrice: Math.floor(askingPrice) }).eq('id', factoryId);
      return res.json({ success: true, listing });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/factory-market/buy
  async function buyListing(req: any, res: any) {
    const user = req.user;
    const { listingId } = req.body;

    if (!listingId) return res.status(400).json({ error: "ID annuncio mancante." });

    try {
      const { data: listing } = await supabase.from('factory_market_listings')
        .select('*').eq('id', listingId).eq('status', 'active').single();

      if (!listing) return res.status(404).json({ error: "Annuncio non trovato o non più attivo." });
      if (listing.sellerId === user.id) return res.status(400).json({ error: "Non puoi comprare la tua stessa fabbrica." });

      const { data: result, error } = await supabase.rpc('transfer_factory_ownership', {
        p_factory_id: listing.factoryId,
        p_seller_id: listing.sellerId,
        p_buyer_id: user.id,
        p_price: listing.askingPrice,
        p_listing_id: listingId,
      });

      if (error) throw error;
      const parsed = typeof result === 'string' ? JSON.parse(result) : result;
      if (parsed?.error) return res.status(400).json({ error: parsed.error });

      res.json({ success: true, ...parsed });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  // POST /api/factory-market/cancel
  async function cancelListing(req: any, res: any) {
    const user = req.user;
    const { listingId } = req.body;

    if (!listingId) return res.status(400).json({ error: "ID annuncio mancante." });

    try {
      if (atomicOperations?.cancelFactoryMarket) {
        const result = await atomicOperations.cancelFactoryMarket({
          listingId,
          sellerId: user.id,
          operationKey: req.body?.idempotencyKey || req.headers?.['x-idempotency-key'] || null,
        });

        if (!result?.success) {
          const codeToStatus: Record<string, number> = {
            invalid_input: 400,
            listing_not_found: 404,
            forbidden: 403,
            listing_not_active: 409,
          };
          return res.status(codeToStatus[result?.code] || 400).json({ error: result?.message || "Operazione non riuscita." });
        }

        return res.json({ success: true });
      }

      const { data: listing } = await supabase.from('factory_market_listings')
        .select('*').eq('id', listingId).eq('status', 'active').single();
      if (!listing) return res.status(404).json({ error: "Annuncio non trovato." });
      if (listing.sellerId !== user.id) return res.status(403).json({ error: "Non sei il venditore." });
      await supabase.from('factory_market_listings').update({ status: 'cancelled' }).eq('id', listingId);
      await supabase.from('factories').update({ listedForSale: false, salePrice: 0 }).eq('id', listing.factoryId);
      return res.json({ success: true });
    } catch (err: any) {
      logger.error('operation_failed', { error: err?.message, path: req?.path });
      res.status(500).json({ error: "An unexpected error occurred. Please try again." });
    }
  }

  return {
    getMarket,
    listForSale,
    buyListing,
    cancelListing,
  };
}
