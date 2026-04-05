import { httpFetch } from './httpClient';

export interface EndpointResult<T> {
  ok: boolean;
  data: T | null;
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
