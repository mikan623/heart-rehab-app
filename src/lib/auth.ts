import { apiFetch } from '@/lib/api';

/**
 * 認証ユーティリティ
 */

export interface AuthSession {
  userId: string;
  userName: string;
}

/**
 * ローカルストレージからセッション情報を取得
 * 認証は httpOnly Cookie で行うため、sessionToken は保存しない（XSS 対策）
 */
export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || '';

  if (!userId) {
    return null;
  }

  return {
    userId,
    userName,
  };
}

/**
 * セッション情報をローカルストレージに保存（表示用 userId/userName のみ）
 * 認証トークンは httpOnly Cookie で管理
 */
export function setSession(session: AuthSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('userId', session.userId);
    localStorage.setItem('userName', session.userName);
  }
}

/**
 * セッション情報をクリア（ログアウト）
 */
export function clearSession(): void {
  if (typeof window !== 'undefined') {
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
 * 🆕 LINE ログイン状態を Supabase（データベース）に保存
 */
export async function setLineLoggedInDB(userId: string, isLoggedIn: boolean, lineUserId?: string): Promise<boolean> {
  try {
    if (!userId) {
      console.warn('⚠️ userId が必要です');
      return false;
    }

    const response = await apiFetch('/api/auth/line-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        lineConnected: isLoggedIn,
        lineUserId: lineUserId || null
      })
    });

    if (response.ok) {
      console.log('✅ LINE 連携状態を Supabase に保存');
      return true;
    } else {
      console.error('❌ Supabase 保存失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ LINE 連携状態保存エラー:', error);
    return false;
  }
}

/**
 * 🆕 LINE ログイン状態を Supabase から取得
 */
export async function getLineLoggedInDB(userId: string): Promise<boolean> {
  try {
    if (!userId) {
      console.warn('⚠️ userId が必要です');
      return false;
    }

    const response = await apiFetch(`/api/auth/line-connection?userId=${encodeURIComponent(userId)}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ LINE 連携状態を Supabase から取得:', data.lineConnected);
      return data.lineConnected || false;
    } else {
      console.error('❌ Supabase 取得失敗:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ LINE 連携状態取得エラー:', error);
    return false;
  }
}

/**
 * 🆕 LINE ログイン状態を管理（メモリ + sessionStorage）
 */
let lineLoginState = {
  isLoggedIn: false,
  userId: '',
  displayName: ''
};

/**
 * LINE ログイン状態をセット
 */
export function setLineLogin(userId: string, displayName: string): void {
  lineLoginState = {
    isLoggedIn: true,
    userId,
    displayName
  };
  
  // 🆕 sessionStorage にも保存（ページリロード対応）
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('lineLoginState', JSON.stringify(lineLoginState));
  }
  
  console.log('✅ LINE ログイン状態をセット:', { userId, displayName });
}

/**
 * LINE ログイン状態をクリア
 */
export function clearLineLogin(): void {
  lineLoginState = {
    isLoggedIn: false,
    userId: '',
    displayName: ''
  };
  
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('lineLoginState');
  }
  
  console.log('🔓 LINE ログイン状態をクリア');
}

/**
 * LINE ログインかメールログインかを判定（メモリ + sessionStorage）
 */
export function isLineLoggedIn(): boolean {
  // ❶ メモリから確認
  if (lineLoginState.isLoggedIn) {
    console.log('📱 LINE ログイン状態: メモリから確認');
    return true;
  }
  
  // ❷ sessionStorage から復元を試みる
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('lineLoginState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.isLoggedIn) {
          // メモリに復元
          lineLoginState = state;
          console.log('📱 LINE ログイン状態: sessionStorage から復元');
          return true;
        }
      } catch (error) {
        console.log('⚠️ sessionStorage パースエラー:', error);
      }
    }
  }
  
  return false;
}

/**
 * LINE ログイン状態（userId/displayName）を取得
 * - メモリ -> sessionStorage の順で復元
 */
export function getLineSession(): { userId: string; displayName: string } | null {
  if (lineLoginState.isLoggedIn && lineLoginState.userId) {
    return { userId: lineLoginState.userId, displayName: lineLoginState.displayName };
  }

  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('lineLoginState');
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state?.isLoggedIn && state?.userId) {
          lineLoginState = state;
          return { userId: state.userId, displayName: state.displayName || '' };
        }
      } catch {
        // ignore
      }
    }
  }

  return null;
}

/**
 * 現在のユーザーIDを取得（メールセッション優先 → LINEセッション → localStorage fallback）
 */
export function getCurrentUserId(): string | null {
  const session = getSession();
  if (session?.userId) return session.userId;

  const line = getLineSession();
  if (line?.userId) return line.userId;

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('userId');
    if (stored) return stored;
  }

  return null;
}

