import { httpFetch } from './httpClient';

export interface EndpointResult<T> {
  ok: boolean;
  data: T | null;
}

export interface RegionsAndNationsResult {
  regions: EndpointResult<any[]>;
  nations: EndpointResult<any[]>;
}

export interface AppBootstrapApiResult {
  user: EndpointResult<any>;
  regions: EndpointResult<any[]>;
  nations: EndpointResult<any[]>;
  articles: EndpointResult<any[]>;
  wars: EndpointResult<any>;
  worldStats: EndpointResult<any>;
}

const readResult = async <T>(response: Response): Promise<EndpointResult<T>> => {
  if (!response.ok) {
    return { ok: false, data: null };
  }
  return { ok: true, data: await response.json() as T };
};

export async function fetchAppBootstrapData(): Promise<AppBootstrapApiResult> {
  const [userRes, regionsRes, nationsRes, articlesRes, warsRes, worldStatsRes] = await Promise.all([
    httpFetch('/api/me'),
    httpFetch('/api/regions'),
    httpFetch('/api/nations'),
    httpFetch('/api/articles'),
    httpFetch('/api/wars'),
    httpFetch('/api/world-stats'),
  ]);

  const [user, regions, nations, articles, wars, worldStats] = await Promise.all([
    readResult<any>(userRes),
    readResult<any[]>(regionsRes),
    readResult<any[]>(nationsRes),
    readResult<any[]>(articlesRes),
    readResult<any>(warsRes),
    readResult<any>(worldStatsRes),
  ]);

  return { user, regions, nations, articles, wars, worldStats };
}

/** Fetch solo /api/me — usato per il polling ad alta frequenza (ogni 20s). */
export async function fetchUserOnly(): Promise<EndpointResult<any>> {
  const res = await httpFetch('/api/me');
  return readResult<any>(res);
}

export async function fetchRegionsAndNations(): Promise<RegionsAndNationsResult> {
  const [regionsRes, nationsRes] = await Promise.all([
    httpFetch('/api/regions'),
    httpFetch('/api/nations'),
  ]);

  const [regions, nations] = await Promise.all([
    readResult<any[]>(regionsRes),
    readResult<any[]>(nationsRes),
  ]);

  return { regions, nations };
}

export async function fetchArticlesOnly(): Promise<EndpointResult<any[]>> {
  const res = await httpFetch('/api/articles');
  return readResult<any[]>(res);
}

export async function fetchWarsOnly(): Promise<EndpointResult<any>> {
  const res = await httpFetch('/api/wars');
  return readResult<any>(res);
}

export async function fetchWorldStatsOnly(): Promise<EndpointResult<any>> {
  const res = await httpFetch('/api/world-stats');
  return readResult<any>(res);
}
