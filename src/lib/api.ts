type ApiFetchInput = RequestInfo | URL;

/**
 * 認証は httpOnly Cookie のみで行う（credentials: 'include' で自動送信）
 * localStorage にトークンを保存しないことで XSS リスクを低減
 */
export async function apiFetch(input: ApiFetchInput, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const credentials: RequestCredentials = init.credentials ?? 'include';

  return fetch(input, { ...init, headers, credentials });
}
