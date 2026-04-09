import {
  getExtractionFactoryMeta,
  isExtractionFactoryEligible,
  pickPreferredExtractionFactory,
} from '../../utils/extraction-factory';

const FACTORY_CONFIG = {
  TYPES: {
    oil: { resource: 'oil' },
    minerals: { resource: 'minerals' },
    gold: { resource: 'gold_ore' },
  },
};

describe('extraction-factory utils', () => {
  it('treats salary factories as ineligible for extraction auto-work', () => {
    expect(isExtractionFactoryEligible({
      id: 'salary-oil',
      type: 'oil',
      payMode: 'salary',
      isActive: true,
    }, FACTORY_CONFIG)).toBe(false);
  });

  it('returns extraction metadata only for active resource-mode factories', () => {
    expect(getExtractionFactoryMeta({
      id: 'factory-1',
      name: 'ML',
      type: 'gold',
      level: 3,
      regionId: 'IT',
      payMode: 'resource',
      isActive: true,
    }, FACTORY_CONFIG)).toEqual({
      factoryId: 'factory-1',
      factoryName: 'ML',
      factoryType: 'gold',
      factoryLevel: 3,
      regionId: 'IT',
      resourceType: 'gold_ore',
      connected: true,
    });
  });

  it('prefers the active auto-work target over a higher-level fallback factory', () => {
    const picked = pickPreferredExtractionFactory([
      {
        id: 'high-level',
        type: 'oil',
        level: 8,
        payMode: 'resource',
        isActive: true,
      },
      {
        id: 'selected',
        type: 'oil',
        level: 2,
        payMode: 'resource',
        isActive: true,
      },
      {
        id: 'salary-factory',
        type: 'oil',
        level: 99,
        payMode: 'salary',
        isActive: true,
      },
    ], FACTORY_CONFIG, 'oil', 'selected');

    expect(picked?.id).toBe('selected');
  });
});
