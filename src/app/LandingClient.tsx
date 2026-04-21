"use client";

import { useState, useEffect } from 'react';
import LandingHeader from '@/components/LandingHeader';
import { useRouter } from 'next/navigation';
import { clearLineLogin, clearSession, setLineLogin, setSession } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { buildLiffUrl, isLikelyLineInAppBrowser } from '@/lib/liffUrl';
import type { Liff } from '@/types/liff';

const features = [
  {
    icon: '📊',
    title: '健康記録',
    description: '血圧・脈拍・体重・運動・食事・服薬を毎日記録。継続的な管理で心臓の健康を守ります。',
    gradient: 'from-orange-500 to-pink-500',
    lightBg: 'bg-orange-50',
    textColor: 'text-orange-600',
  },
  {
    icon: '🤖',
    title: 'AI健康アドバイス',
    description: '直近7日間の記録をもとにOpenAIがパーソナライズされたアドバイスを生成。あなただけのケアを。',
    gradient: 'from-violet-500 to-purple-600',
    lightBg: 'bg-violet-50',
    textColor: 'text-violet-600',
  },
  {
    icon: '📈',
    title: 'グラフ表示',
    description: '健康データの推移をグラフで可視化。変化のトレンドを一目で把握できます。',
    gradient: 'from-teal-500 to-cyan-500',
    lightBg: 'bg-teal-50',
    textColor: 'text-teal-600',
  },
  {
    icon: '📅',
    title: 'カレンダー管理',
    description: '過去の記録をカレンダーから確認・編集。記録の抜け漏れも簡単に補完できます。',
    gradient: 'from-amber-500 to-orange-500',
    lightBg: 'bg-amber-50',
    textColor: 'text-amber-600',
  },
  {
    icon: '👨‍👩‍👧',
    title: '家族共有',
    description: '健康記録をLINE通知で家族にリアルタイム共有。離れていても安心のつながりを。',
    gradient: 'from-green-500 to-emerald-500',
    lightBg: 'bg-green-50',
    textColor: 'text-green-600',
  },
];

const faqs = [
  {
    q: 'どのような人が使えますか？',
    a: '心臓疾患を持つ方、心臓リハビリ中の方、健康管理を重視する方なら誰でもご利用いただけます。',
  },
  {
    q: 'データは安全ですか？',
    a: 'はい。すべての健康データは暗号化されて保存され、httpOnly CookieによるJWT認証で安全に管理されます。',
  },
  {
    q: 'ログイン方法は？',
    a: 'LINE ログイン（ワンタップ）、またはメールアドレスとパスワードでログインできます。',
  },
  {
    q: '医師に相談できますか？',
    a: '記録したデータはPDFで出力でき、受診時に医師へ持参できます。医療従事者アカウントからも閲覧可能です。',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [liff, setLiff] = useState<Liff | null>(null);
  const [liffLoading, setLiffLoading] = useState(true);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginRole, setLoginRole] = useState<'patient' | 'medical'>('patient');
  const [activeFeature, setActiveFeature] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [sliderPaused, setSliderPaused] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const typingText = "日々の健康を記録に残そう。";

  // ログインフォームの状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Typing animation
  useEffect(() => {
    if (typedCount >= typingText.length) return;
    const timer = setTimeout(() => setTypedCount((c) => c + 1), 120);
    return () => clearTimeout(timer);
  }, [typedCount, typingText.length]);

  // Feature auto-advance
  useEffect(() => {
    if (sliderPaused) return;
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [sliderPaused]);

  // LIFF初期化とログイン状態チェック
  useEffect(() => {
    setIsClient(true);

    const waitForLiff = async (timeoutMs = 3500, intervalMs = 50): Promise<Liff | null> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (typeof window !== 'undefined' && window.liff) return window.liff;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return null;
    };

    const init = async () => {
      if (typeof window === 'undefined') return;

      try {
        const params = new URLSearchParams(window.location.search);
        const familyInviteId = params.get('familyInviteId');
        if (familyInviteId) {
          router.push(`/family-invite?familyInviteId=${familyInviteId}`);
          return;
        }

        const switchRole = params.get('switchRole') === '1';

        try {
          const storedRole = localStorage.getItem('loginRole');
          if (storedRole === 'medical' || storedRole === 'patient') {
            setLoginRole(storedRole);
          }
        } catch {
          // ignore
        }

        // ログアウト直後フラグ（自動リダイレクトのみ抑止、LIFF初期化は続行）
        let wasJustLoggedOut = false;
        if (sessionStorage.getItem('justLoggedOut') === '1') {
          sessionStorage.removeItem('justLoggedOut');
          sessionStorage.removeItem('redirectedToLiff');
          clearSession();
          clearLineLogin();
          localStorage.removeItem('loginRole');
          setIsLoggedIn(false);
          wasJustLoggedOut = true;
          // return しない → LIFF初期化を続行してログインボタンを使えるようにする
        }

        // ロール選択し直し時は自動遷移しない
        if (switchRole) {
          setIsLoggedIn(false);
          return;
        }

        // localStorage が残っていても、まずサーバー側の認証を確認する
        const userId = localStorage.getItem('userId');
        if (userId) {
          try {
            const res = await apiFetch('/api/auth/role', { cache: 'no-store' });

            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              const role =
                data?.role === 'medical' || localStorage.getItem('loginRole') === 'medical'
                  ? 'medical'
                  : 'patient';

              localStorage.setItem('loginRole', role);
              router.push(role === 'medical' ? '/medical' : '/health-records');
              return;
            }
          } catch (error) {
            console.warn('認証確認に失敗。ログイン画面を表示します:', error);
          }

          clearSession();
          clearLineLogin();
          localStorage.removeItem('loginRole');
        }

        const liffSdk = await waitForLiff();

        if (!liffSdk) {
          console.warn('LIFF SDK not ready; falling back to login screen');
          setIsLoggedIn(false);
          return;
        }

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          console.warn('LIFF ID missing; skipping init');
          setIsLoggedIn(false);
          return;
        }

        await liffSdk.init({ liffId });

        // LIFF 初期化後にもログアウト直後フラグを念のため確認（競合対策）
        if (sessionStorage.getItem('justLoggedOut') === '1') {
          sessionStorage.removeItem('justLoggedOut');
          sessionStorage.removeItem('redirectedToLiff');
          clearSession();
          clearLineLogin();
          localStorage.removeItem('loginRole');
          wasJustLoggedOut = true;
        }

        try {
          const isLineBrowser = isLikelyLineInAppBrowser();
          const inClient = typeof liffSdk.isInClient === 'function' ? liffSdk.isInClient() : false;
          const alreadyRedirected =
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem('redirectedToLiff') === '1';

          if (isLineBrowser && !inClient && !alreadyRedirected) {
            const state = `${window.location.pathname}${window.location.search}`;
            const liffUrl = buildLiffUrl(state);
            if (liffUrl) {
              sessionStorage.setItem('redirectedToLiff', '1');
              window.location.replace(liffUrl);
              return;
            }
          }
        } catch {
          // ignore
        }

        setLiff(liffSdk);

        // ログアウト直後は自動リダイレクトをスキップしてログイン画面を表示する
        if (liffSdk.isLoggedIn() && !wasJustLoggedOut) {
          let isNewProfile = false;

          try {
            const profile = await liffSdk.getProfile();
            console.log('✅ LINE プロフィール取得:', profile);

            let lineEmail = '';
            let liffIdToken: string | null = null;

            try {
              liffIdToken = liffSdk.getIDToken();
              if (liffIdToken) {
                const decodedToken = JSON.parse(atob(liffIdToken.split('.')[1]));
                lineEmail = decodedToken.email || '';

                // ID Token の有効期限を確認
                if (decodedToken.exp && Math.floor(Date.now() / 1000) > decodedToken.exp) {
                  // ループ防止: 既に1回再ログインを試みた場合はスキップしてサーバーに判断させる
                  const alreadyRetried = sessionStorage.getItem('liffTokenRetry') === '1';
                  if (!alreadyRetried) {
                    console.warn('⚠️ LINE ID Token expired, forcing full re-login');
                    sessionStorage.setItem('liffTokenRetry', '1');
                    // logout() でローカルセッションをクリアしてから login() することで
                    // LIFF が新しいコード交換を行い、フレッシュな ID Token が発行される
                    liffSdk.logout();
                    liffSdk.login();
                    return;
                  } else {
                    // リトライ後もトークンが期限切れ → フラグをクリアしてサーバー検証に委ねる
                    console.warn('⚠️ LINE ID Token still expired after retry, proceeding to server');
                    sessionStorage.removeItem('liffTokenRetry');
                  }
                }

                console.log('📧 LINE メールアドレス取得:', lineEmail);
              }
            } catch (emailError) {
              console.log('⚠️ LINE メールアドレス取得エラー（無視）:', emailError);
            }

            setLineLogin(profile.userId, profile.displayName);

            const setupRes = await apiFetch('/api/auth/line-user-setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: profile.userId,
                displayName: profile.displayName,
                email: lineEmail || undefined,
                idToken: liffIdToken || undefined,
                role:
                  typeof window !== 'undefined' && localStorage.getItem('loginRole') === 'medical'
                    ? 'medical'
                    : 'patient',
              })
            });

            if (!setupRes.ok) {
              const errorData = await setupRes.json().catch(() => ({}));
              console.error('❌ LINE ユーザーセットアップ失敗:', errorData);
              throw new Error(errorData?.error || 'LINE ユーザーセットアップに失敗しました');
            }

            console.log('✅ LINE ユーザーデータを保存');

            if (typeof window !== 'undefined') {
              localStorage.setItem(
                'loginRole',
                localStorage.getItem('loginRole') === 'medical' ? 'medical' : 'patient'
              );
            }

            setSession({
              userId: profile.userId,
              userName: profile.displayName || '',
            });

            try {
              const res = await apiFetch(`/api/profiles?userId=${profile.userId}`);
              if (res.ok) {
                const data = await res.json();
                if (!data.profile) {
                  isNewProfile = true;
                  await apiFetch('/api/profiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userId: profile.userId,
                      profile: {
                        displayName: profile.displayName || '',
                        email: lineEmail || undefined,
                      },
                    }),
                  });
                  console.log('✅ LINE プロフィール初期保存');
                }
              }
            } catch (profileSaveError) {
              console.log('⚠️ プロフィール初期保存エラー（無視）:', profileSaveError);
            }

            // セットアップ成功 → リトライフラグをクリアしてリダイレクト
            sessionStorage.removeItem('liffTokenRetry');

            const role =
              typeof window !== 'undefined' && localStorage.getItem('loginRole') === 'medical'
                ? 'medical'
                : 'patient';

            if (role === 'medical') {
              router.push('/medical');
            } else if (isNewProfile) {
              router.push('/profile');
            } else {
              router.push('/health-records');
            }
            return;

          } catch (profileError) {
            console.error('⚠️ LINE セットアップエラー（ログイン画面を表示）:', profileError);
            // セットアップ失敗時はリダイレクトせずログイン画面を表示する
          }
        }

        setIsLoggedIn(false);
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
        setIsLoggedIn(false);
      } finally {
        // どのパスを通っても必ず liffLoading を解除する
        setLiffLoading(false);
      }
    };

    void init();
  }, [router]);

  // LINE ログイン
  const handleLineLogin = async () => {
    if (liffLoading) {
      setError('LINEの準備中です。少しお待ちください。');
      return;
    }
    if (!liff) {
      setError('LINEログインを利用できません。ページを再読み込みしてお試しください。');
      return;
    }
    try {
      liff.login();
    } catch (error) {
      console.error('LINE ログインエラー:', error);
      setError('LINE ログインに失敗しました');
    }
  };

  // メール/パスワードログイン
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: loginRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'ログインに失敗しました');
        return;
      }

      const data = await response.json();

      // 表示用の userId/userName のみ保存（認証は httpOnly Cookie で管理）
      setSession({ userId: data.user.id, userName: data.user.name || '' });
      localStorage.setItem('loginRole', loginRole);

      // ロールに応じて遷移
      router.push(loginRole === 'medical' ? '/medical' : '/health-records');
    } catch (err) {
      setError('通信エラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ユーザー登録
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role: loginRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '登録に失敗しました');
        return;
      }

      const data = await response.json();

      // 表示用の userId/userName のみ保存（認証は httpOnly Cookie で管理）
      setSession({ userId: data.user.id, userName: data.user.name || '' });
      localStorage.setItem('loginRole', loginRole);

      // 🆕 新規登録後の遷移（患者:プロフィール、医療従事者:medical）
      router.push(loginRole === 'medical' ? '/medical' : '/profile');
    } catch (err) {
      setError('通信エラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setRole = (role: 'patient' | 'medical') => {
    setLoginRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem('loginRole', role);
    }
  };

  const handleFormSwitch = (signup: boolean) => {
    setIsSignUp(signup);
    setEmail('');
    setPassword('');
    setName('');
    setError('');
  };

  // ローディング中または初期化中
  if (!isClient || isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">読み込み中...</p>
        </div>
      </div>
    );
  }

  const currentFeature = features[activeFeature];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <LandingHeader />

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-orange-50 via-rose-50 to-pink-50 pt-8 pb-20 overflow-hidden">
        {/* 装飾ブロブ */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-orange-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-pink-200/40 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">

            {/* 左: テキスト + CTA */}
            <div className="flex-1 text-center lg:text-left">
              
              <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
                {typingText.slice(0, Math.min(typedCount, 6))}
                {typedCount <= 6 && <span className="typing-cursor text-gray-900">|</span>}
                <br />
                <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">
                  {typedCount > 6 ? typingText.slice(6, typedCount) : '\u00a0'}
                </span>
                {typedCount > 6 && typedCount < typingText.length && (
                  <span className="typing-cursor text-pink-500">|</span>
                )}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
                心臓疾患を持つ方が安心して健康を管理できる、専用の記録アプリです。
                バイタルの記録からAIアドバイス、家族共有まで、継続を支える機能を揃えています。
              </p>

              {/* ロール選択 */}
              <div className="flex justify-center lg:justify-start mb-5">
                <div className="inline-flex bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                      loginRole === 'patient'
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    患者側
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('medical')}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                      loginRole === 'medical'
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    医療従事者側
                  </button>
                </div>
              </div>

              {!showLoginForm ? (
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <button
                    onClick={handleLineLogin}
                    disabled={liffLoading}
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#06C755] text-white rounded-full font-bold text-base hover:bg-[#05b34c] hover:shadow-lg hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {liffLoading ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0C5.373 0 0 4.373 0 10c0 3.325 2.237 6.196 5.35 7.688-.235 1.264.077 3.45.45 4.725.05.283.3.45.55.338 2.637-1.687 5.95-3.787 7.975-5.237 1.875.338 3.862.512 5.675.512 6.627 0 12-4.373 12-10S18.627 0 12 0z"/>
                      </svg>
                    )}
                    {liffLoading ? 'LINE 準備中...' : 'LINE でログイン'}
                  </button>
                  <button
                    onClick={() => { setShowLoginForm(true); handleFormSwitch(false); }}
                    className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-orange-400 text-orange-600 rounded-full font-bold text-base hover:shadow-lg hover:scale-105 transition-all duration-200"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    メールでログイン
                  </button>
                </div>
              ) : (
                /* ── ログインフォーム ── */
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-md mx-auto lg:mx-0">
                  {/* ロール選択（フォーム内） */}
                  <div className="flex justify-center mb-5">
                    <div className="inline-flex bg-gray-100 rounded-full p-1">
                      <button
                        type="button"
                        onClick={() => setRole('patient')}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                          loginRole === 'patient'
                            ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow'
                            : 'text-gray-600 hover:bg-white/80'
                        }`}
                      >
                        患者側
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('medical')}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                          loginRole === 'medical'
                            ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow'
                            : 'text-gray-600 hover:bg-white/80'
                        }`}
                      >
                        医療従事者側
                      </button>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-5 text-center">
                    {isSignUp ? '新規登録' : 'ログイン'}
                  </h3>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-300 text-red-600 rounded-lg text-sm">
                      {error}
                    </div>
                  )}

                  <form onSubmit={isSignUp ? handleSignUp : handleEmailLogin} className="space-y-4">
                    {isSignUp && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">お名前</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="山田太郎"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                          required={isSignUp}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">メールアドレス</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">パスワード</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6文字以上"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                        required
                        minLength={6}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {loading ? '処理中...' : (isSignUp ? '登録する' : 'ログイン')}
                    </button>
                  </form>

                  <div className="mt-4 text-center space-y-2 text-sm">
                    {isSignUp ? (
                      <p className="text-gray-500">
                        アカウントをお持ちですか？{' '}
                        <button onClick={() => handleFormSwitch(false)} className="text-orange-600 font-bold hover:underline">
                          ログイン
                        </button>
                      </p>
                    ) : (
                      <>
                        <p className="text-gray-500">
                          アカウントをお持ちでないですか？{' '}
                          <button onClick={() => handleFormSwitch(true)} className="text-orange-600 font-bold hover:underline">
                            新規登録
                          </button>
                        </p>
                        <p className="text-gray-500">
                          パスワードをお忘れですか？{' '}
                          <a href="/reset-password" className="text-orange-600 font-bold hover:underline">
                            こちら
                          </a>
                        </p>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => { setShowLoginForm(false); setError(''); }}
                    className="w-full mt-4 py-2.5 border border-gray-200 text-gray-500 text-sm font-semibold rounded-lg hover:bg-gray-50 transition"
                  >
                    戻る
                  </button>
                </div>
              )}
            </div>

            {/* 右: Heart animation + orbiting badges */}
            <div className="flex-shrink-0 flex items-center justify-center">
              {/*
                rotate を一切使わず translate だけで円軌道を描く方式。
                テキストが傾く問題を根本から解決する。
                radius = 118px, 8 keyframes で円を近似。
              */}
              <style>{`
                @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
                .typing-cursor { animation: blink 0.8s step-end infinite; }
                @keyframes badgeOrbit {
                  0%    { transform: translate(148px,   0px)   translate(-50%, -50%); }
                  12.5% { transform: translate(105px,  105px)  translate(-50%, -50%); }
                  25%   { transform: translate(0px,    148px)  translate(-50%, -50%); }
                  37.5% { transform: translate(-105px, 105px)  translate(-50%, -50%); }
                  50%   { transform: translate(-148px,  0px)   translate(-50%, -50%); }
                  62.5% { transform: translate(-105px,-105px)  translate(-50%, -50%); }
                  75%   { transform: translate(0px,   -148px)  translate(-50%, -50%); }
                  87.5% { transform: translate(105px, -105px)  translate(-50%, -50%); }
                  100%  { transform: translate(148px,   0px)   translate(-50%, -50%); }
                }
              `}</style>

              <div className="relative w-[320px] h-[320px] flex items-center justify-center" style={{ overflow: 'visible' }}>

                {/* Heart circle */}
                <div className="w-52 h-52 md:w-60 md:h-60 rounded-full bg-white/70 backdrop-blur shadow-2xl flex items-center justify-center border border-orange-100 flex-shrink-0">
                  <img
                    src="/heart-animation.gif"
                    alt="心臓ちゃん"
                    className="w-44 h-44 md:w-52 md:h-52 object-contain"
                  />
                </div>

                {/* Orbiting badges — 120s でゆっくり、4つが90°ずつ均等間隔 */}
                {[
                  { label: 'AI搭載',   textColor: 'text-orange-600', border: 'border-orange-300', delay: 0   },
                  { label: 'LINE連携', textColor: 'text-green-600',  border: 'border-green-300',  delay: -30 },
                  { label: '家族共有', textColor: 'text-blue-600',   border: 'border-blue-300',   delay: -60 },
                  { label: 'PDF印刷',  textColor: 'text-purple-600', border: 'border-purple-300', delay: -90 },
                ].map((badge, idx) => (
                  <div
                    key={idx}
                    className={`bg-white border-2 ${badge.border} rounded-full shadow-md px-3 py-1.5 whitespace-nowrap ${badge.textColor}`}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      animation: 'badgeOrbit 120s linear infinite',
                      animationDelay: `${badge.delay}s`,
                    }}
                  >
                    <span className="text-sm font-bold">{badge.label}</span>
                  </div>
                ))}

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Feature Slider ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-orange-500 uppercase tracking-widest">Features</span>
            <h2 className="mt-2 text-4xl font-extrabold text-gray-900">主な機能</h2>
          </div>

          {/* Slider card */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-2xl"
            onMouseEnter={() => setSliderPaused(true)}
            onMouseLeave={() => setSliderPaused(false)}
          >
            <div
              className={`bg-gradient-to-br ${currentFeature.gradient} p-1`}
            >
              <div className="bg-white rounded-[20px] p-10 md:p-14">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${currentFeature.gradient} flex items-center justify-center text-5xl shadow-lg flex-shrink-0`}>
                    {currentFeature.icon}
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className={`text-2xl md:text-3xl font-extrabold mb-3 ${currentFeature.textColor}`}>
                      {currentFeature.title}
                    </h3>
                    <p className="text-gray-600 text-lg leading-relaxed max-w-lg">
                      {currentFeature.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prev/Next arrows */}
            <button
              onClick={() => { setActiveFeature((activeFeature - 1 + features.length) % features.length); setSliderPaused(true); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all"
              aria-label="前へ"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => { setActiveFeature((activeFeature + 1) % features.length); setSliderPaused(true); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all"
              aria-label="次へ"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {features.map((f, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveFeature(idx); setSliderPaused(true); }}
                className={`rounded-full transition-all duration-300 ${
                  idx === activeFeature
                    ? `w-8 h-3 bg-gradient-to-r ${f.gradient}`
                    : 'w-3 h-3 bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={f.title}
              />
            ))}
          </div>

          {/* Feature tab bar (desktop quick nav) */}
          <div className="hidden md:flex justify-center gap-3 mt-8 flex-wrap">
            {features.map((f, idx) => (
              <button
                key={idx}
                onClick={() => { setActiveFeature(idx); setSliderPaused(true); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200 ${
                  idx === activeFeature
                    ? `bg-gradient-to-r ${f.gradient} text-white border-transparent shadow`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <span>{f.icon}</span>
                {f.title}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-2xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold text-orange-500 uppercase tracking-widest">FAQ</span>
            <h2 className="mt-2 text-4xl font-extrabold text-gray-900">よくある質問</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left font-semibold text-gray-800 hover:bg-gray-50 transition"
                >
                  <span>{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-orange-500 flex-shrink-0 ml-4 transition-transform duration-200 ${openFaq === idx ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      {!showLoginForm && (
        <section className="py-20 bg-gradient-to-br from-orange-500 to-pink-500">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-extrabold text-white mb-4">今すぐ始めましょう</h2>
            <p className="text-white/80 text-lg mb-10">無料で使えます。登録は1分で完了します。</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleLineLogin}
                disabled={liffLoading}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-orange-600 rounded-full font-bold text-base hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-60"
              >
                {liffLoading ? (
                  <span className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-[#06C755]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.373 0 0 4.373 0 10c0 3.325 2.237 6.196 5.35 7.688-.235 1.264.077 3.45.45 4.725.05.283.3.45.55.338 2.637-1.687 5.95-3.787 7.975-5.237 1.875.338 3.862.512 5.675.512 6.627 0 12-4.373 12-10S18.627 0 12 0z"/>
                  </svg>
                )}
                {liffLoading ? 'LINE 準備中...' : 'LINE でログイン'}
              </button>
              <button
                onClick={() => { setShowLoginForm(true); handleFormSwitch(false); }}
                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white/10 border-2 border-white text-white rounded-full font-bold text-base hover:bg-white/20 hover:scale-105 transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                メールで登録
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className="bg-gray-900 py-10">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-400 text-sm mb-4">© 2026 心臓リハビリ手帳. All rights reserved.</p>
          <div className="flex justify-center gap-6 text-sm">
            <a href="/terms" className="text-gray-500 hover:text-white transition">利用規約</a>
            <a href="/privacy" className="text-gray-500 hover:text-white transition">プライバシーポリシー</a>
            <a href="/contact" className="text-gray-500 hover:text-white transition">お問い合わせ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
