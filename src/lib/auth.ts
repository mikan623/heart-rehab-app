/**
 * 認証ユーティリティ
 */

export interface AuthSession {
  userId: string;
  userName: string;
  sessionToken: string;
}

/**
 * ローカルストレージからセッション情報を取得
 */
export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionToken = localStorage.getItem('sessionToken');
  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || '';

  if (!sessionToken || !userId) {
    return null;
  }

  return {
    userId,
    userName,
    sessionToken,
  };
}

/**
 * セッション情報をローカルストレージに保存
 */
export function setSession(session: AuthSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('sessionToken', session.sessionToken);
    localStorage.setItem('userId', session.userId);
    localStorage.setItem('userName', session.userName);
  }
}

/**
 * セッション情報をクリア（ログアウト）
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
  }
}

/**
 * ユーザーが認証されているかチェック
 */
export function isAuthenticated(): boolean {
  const session = getSession();
  return !!session;
}

/**
 * LINE ログインかメールログインかを判定（LINE ログインの場合）
 */
export function isLineLoggedIn(): boolean {
  try {
    if (typeof window !== 'undefined' && window.liff) {
      // LIFF が初期化されているか確認
      if (window.liff.isLoggedIn && typeof window.liff.isLoggedIn === 'function') {
        return window.liff.isLoggedIn();
      }
    }
  } catch (error) {
    console.log('LIFF check failed (not initialized):', error);
  }
  return false;
}

