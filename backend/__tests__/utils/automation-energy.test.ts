import {
  hasEnergyDrinkCooldownExpired,
  parseEnergyTimestamp,
  resolveExtractionEnergyCost,
} from '../../utils/automation-energy';

describe('automation-energy utils', () => {
  describe('parseEnergyTimestamp', () => {
    it('parses numeric timestamps and ISO strings', () => {
      expect(parseEnergyTimestamp(1234567890)).toBe(1234567890);
      expect(parseEnergyTimestamp('1234567890')).toBe(1234567890);
      expect(parseEnergyTimestamp('2026-04-07T10:00:00.000Z')).toBe(new Date('2026-04-07T10:00:00.000Z').getTime());
    });

    it('returns null for invalid values', () => {
      expect(parseEnergyTimestamp(undefined)).toBeNull();
      expect(parseEnergyTimestamp('not-a-date')).toBeNull();
    });
  });

  describe('hasEnergyDrinkCooldownExpired', () => {
    it('accepts missing timestamps and blocks recent ISO timestamps', () => {
      const now = new Date('2026-04-07T10:10:00.000Z').getTime();
      const cooldownMs = 10 * 60 * 1000;

      expect(hasEnergyDrinkCooldownExpired(null, now, cooldownMs)).toBe(true);
      expect(hasEnergyDrinkCooldownExpired('2026-04-07T10:00:00.000Z', now, cooldownMs)).toBe(true);
      expect(hasEnergyDrinkCooldownExpired('2026-04-07T10:00:01.000Z', now, cooldownMs)).toBe(false);
    });
  });

  describe('resolveExtractionEnergyCost', () => {
    it('uses resistance for manual extraction cost', () => {
      expect(resolveExtractionEnergyCost(10, 0)).toBe(10);
      expect(resolveExtractionEnergyCost(10, 20)).toBe(8);
      expect(resolveExtractionEnergyCost(10, 75)).toBe(5);
    });

    it('honors exact overrides for auto-work cycles', () => {
      expect(resolveExtractionEnergyCost(10, 75, 300)).toBe(300);
      expect(resolveExtractionEnergyCost(10, 0, 300)).toBe(300);
    });
  });
});
