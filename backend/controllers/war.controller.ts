import { WarService } from '../services/war.service';
import { isWarsListResponse, isWarStatsResponse } from '../observability/contract-guards';
import { mapServiceResultToHttp } from '../services/http-result.mapper';

export class WarController {
  constructor(private readonly warService: WarService) {}

  listWars = async (_req: any, res: any) => {
    try {
      const data = await this.warService.listWars();
      if (!isWarsListResponse(data)) {
        console.error('[ContractViolation] GET /api/wars unexpected payload shape', { payload: data });
      }
      return res.json(data);
    } catch (err) {
      console.error('[Wars] listWars error:', err);
      return res.status(500).json({ error: 'Errore nel caricamento guerre.' });
    }
  };

  getWarStats = async (req: any, res: any) => {
    try {
      const data = await this.warService.getWarStats(req.params.id);
      if (!isWarStatsResponse(data)) {
        console.error('[ContractViolation] GET /api/wars/:id/stats unexpected payload shape', { warId: req.params.id });
      }
      return res.json(data);
    } catch (err: any) {
      if (err?.statusCode === 404) {
        return res.status(404).json({ error: 'Guerra non trovata.' });
      }
      console.error('[Wars] getWarStats error:', err);
      return res.status(500).json({ error: 'Errore nel caricamento statistiche guerra.' });
    }
  };


  deployTroops = async (req: any, res: any) => {
    try {
      const { warId, side, troopType, quantity } = req.body || {};
      const result = await this.warService.deployTroops({
        user: req.user,
        warId,
        side,
        troopType,
        quantity,
      });

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      console.error('War deploy error:', err);
      return res.status(500).json({ error: 'Errore durante lo schieramento.' });
    }
  };
  createWar = async (req: any, res: any) => {
    try {
      const { attackerRegionId, defenderRegionId, warType } = req.body || {};
      const result = await this.warService.createWar({
        userId: req.user.id,
        attackerRegionId,
        defenderRegionId,
        warType,
      });

      const http = mapServiceResultToHttp(result);
      return res.status(http.statusCode).json(http.body);
    } catch (err: any) {
      console.error('War creation error:', err);
      return res.status(500).json({ error: 'Errore nella dichiarazione di guerra.' });
    }
  };
}
