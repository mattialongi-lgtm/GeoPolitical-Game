import * as assert from 'node:assert/strict';
import { DailyRewardService } from '../backend/services/daily-reward.service';
import { mapServiceResultToHttp } from '../backend/services/http-result.mapper';

async function run() {
  const repo = {
    async claimMissionRewardRpc() {
      return {
        data: null,
        error: { message: 'rpc claim_mission_reward failed: relation users does not exist' },
      };
    },
  } as any;

  const service = new DailyRewardService(repo);
  const result = await service.claimMissionReward('u1', 'm1');
  assert.equal(result.type, 'system_error');
  assert.equal(result.message, 'Errore interno durante il riscatto missione.');

  const http = mapServiceResultToHttp(result as any);
  assert.equal(http.statusCode, 500);
  assert.equal(http.body.error, 'Si è verificato un errore interno. Riprova più tardi.');

  console.log('daily-reward-hardening-smoke: OK');
}

run().catch((err) => {
  console.error('daily-reward-hardening-smoke: FAILED');
  console.error(err);
  process.exit(1);
});
