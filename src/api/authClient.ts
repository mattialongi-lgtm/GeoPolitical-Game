import { supabase } from '../lib/supabase';
import { httpJson } from './httpClient';

export const setBackendAuthCookie = (token: string) => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `sb-access-token=${token}; path=/; max-age=${604800}; SameSite=Lax${secure}`;
};

export const clearBackendAuthCookie = () => {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${secure}`;
};

export async function getSupabaseSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function subscribeToAuthStateChange(
  callback: (event: string, session: any) => void,
) {
  return supabase.auth.onAuthStateChange((event, session) => callback(event, session));
}

export async function fetchCurrentUser<T>() {
  return httpJson<T>('/api/me');
}
