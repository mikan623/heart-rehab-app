import { getSession } from '@/lib/auth';

type ApiFetchInput = RequestInfo | URL;

export async function apiFetch(input: ApiFetchInput, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const session = getSession();

  if (session?.sessionToken && !headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${session.sessionToken}`);
  }

  const credentials: RequestCredentials = init.credentials ?? 'include';

  return fetch(input, { ...init, headers, credentials });
}
