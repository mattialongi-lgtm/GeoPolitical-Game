export async function httpFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    credentials: init.credentials ?? 'same-origin',
  });
}

export async function httpJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const response = await httpFetch(input, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${input}`);
  }
  return response.json() as Promise<T>;
}
