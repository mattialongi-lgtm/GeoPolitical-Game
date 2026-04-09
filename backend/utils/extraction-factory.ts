export type ExtractionFactoryLike = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  level?: number | null;
  regionId?: string | null;
  isActive?: boolean | null;
  payMode?: string | null;
};

export function getFactoryResourceType(factory: ExtractionFactoryLike | null | undefined, FACTORY_CONFIG: any): string | null {
  if (!factory?.type) return null;
  const typeDef = FACTORY_CONFIG?.TYPES?.[factory.type];
  return typeof typeDef?.resource === 'string' ? typeDef.resource : null;
}

export function isExtractionFactoryEligible(factory: ExtractionFactoryLike | null | undefined, FACTORY_CONFIG: any): boolean {
  if (!factory) return false;
  if (factory.isActive === false) return false;
  if (String(factory.payMode || '').toLowerCase() !== 'resource') return false;
  return !!getFactoryResourceType(factory, FACTORY_CONFIG);
}

export function getExtractionFactoryMeta(factory: ExtractionFactoryLike | null | undefined, FACTORY_CONFIG: any) {
  if (!isExtractionFactoryEligible(factory, FACTORY_CONFIG)) return null;

  return {
    factoryId: factory!.id || null,
    factoryName: factory!.name || null,
    factoryType: factory!.type || null,
    factoryLevel: Number(factory!.level || 0),
    regionId: factory!.regionId || null,
    resourceType: getFactoryResourceType(factory, FACTORY_CONFIG),
    connected: true,
  };
}

export function pickPreferredExtractionFactory(
  factories: ExtractionFactoryLike[] | null | undefined,
  FACTORY_CONFIG: any,
  resourceType: string,
  preferredFactoryId?: string | null,
) {
  const eligible = (factories || [])
    .filter((factory) => isExtractionFactoryEligible(factory, FACTORY_CONFIG))
    .filter((factory) => getFactoryResourceType(factory, FACTORY_CONFIG) === resourceType);

  if (preferredFactoryId) {
    const preferred = eligible.find((factory) => factory.id === preferredFactoryId);
    if (preferred) return preferred;
  }

  return eligible
    .slice()
    .sort((left, right) => {
      const levelDelta = Number(right.level || 0) - Number(left.level || 0);
      if (levelDelta !== 0) return levelDelta;
      return String(left.id || '').localeCompare(String(right.id || ''));
    })[0] || null;
}
