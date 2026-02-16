"use client";

import { useState, useEffect } from 'react';
import LandingHeader from '@/components/LandingHeader';
import { useRouter } from 'next/navigation';
import { setLineLoggedInDB, setLineLogin, setSession } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { buildLiffUrl, isLikelyLineInAppBrowser } from '@/lib/liffUrl';
import type { Liff } from '@/types/liff';

export default function LandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [liff, setLiff] = useState<Liff | null>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loginRole, setLoginRole] = useState<'patient' | 'medical'>('patient');
  
  // ログインフォームの状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // LIFF初期化とログイン状態チェック
  useEffect(() => {
    setIsClient(true);

    // 🔁 familyInviteId が付いた招待URLで開かれた場合は、家族登録画面へリダイレクト
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const familyInviteId = params.get('familyInviteId');
      if (familyInviteId) {
        router.push(`/family-invite?familyInviteId=${familyInviteId}`);
        return;
      }
    }

    // ローカルストレージからセッション確認
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const switchRole = params.get('switchRole') === '1';

      // ロール復元（患者/医療従事者）
      try {
        const storedRole = localStorage.getItem('loginRole');
        if (storedRole === 'medical' || storedRole === 'patient') {
          setLoginRole(storedRole);
        }
      } catch {
        // ignore
      }

      const sessionToken = localStorage.getItem('sessionToken');
      if (sessionToken) {
        // 別端末で「ロールを選び直したい」場合の逃げ道
        // /?switchRole=1 で開くと自動リダイレクトを止める
        if (switchRole) {
          setIsLoggedIn(false);
          return;
        }
        const role = localStorage.getItem('loginRole') === 'medical' ? 'medical' : 'patient';
        router.push(role === 'medical' ? '/medical' : '/health-records');
        return;
      }
    }

    const waitForLiff = async (timeoutMs = 3500, intervalMs = 50): Promise<Liff | null> => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (typeof window !== 'undefined' && window.liff) return window.liff;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return null;
    };

    const initLiff = async () => {
      try {
        // Android等でSDK読み込みが遅れると window.liff が未定義のまま固まることがあるため待機
        const liffSdk = await waitForLiff();
        if (typeof window !== 'undefined' && liffSdk) {
          const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
          if (!liffId) {
            console.warn('LIFF ID missing; skipping init');
            // トップは isLiffReady state を持たないので、未初期化でも画面表示を続行する
            setIsLoggedIn(false);
            return;
          }
          await liffSdk.init({ 
            liffId
          });

          // ✅ LINEのアプリ内ブラウザで「通常Webとして開かれている」場合は、LIFF起動URLへ寄せる
          // これにより、ログイン後の「ログインしました（続行）」ダイアログが出るケースを減らす
          try {
            const isLineBrowser = isLikelyLineInAppBrowser();
            const inClient = typeof liffSdk.isInClient === 'function' ? liffSdk.isInClient() : false;
            const alreadyRedirected = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('redirectedToLiff') === '1';
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

          // ログイン状態をチェック
          if (liffSdk.isLoggedIn()) {
            // ✅ LINE ログイン済み時：ユーザー情報を取得して Supabase に保存
            let isNewProfile = false;

            try {
              const profile = await liffSdk.getProfile();
              console.log('✅ LINE プロフィール取得:', profile);

              // 📧 LINE メールアドレス取得（あれば）
              let lineEmail = '';
              let liffIdToken: string | null = null;
              try {
                liffIdToken = await liffSdk.getIDToken();
                if (liffIdToken) {
                  const decodedToken = JSON.parse(atob(liffIdToken.split('.')[1]));
                  lineEmail = decodedToken.email || '';
                  console.log('📧 LINE メールアドレス取得:', lineEmail);
                }
              } catch (emailError) {
                console.log('⚠️ LINE メールアドレス取得エラー（無視）:', emailError);
              }
              
              // 🆕 メモリに保存
              setLineLogin(profile.userId, profile.displayName);
              
              // 🆕 Supabase にユーザー情報を保存（users テーブル）
              // メールアドレスを users テーブルに保存する
              const setupRes = await apiFetch('/api/auth/line-user-setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: profile.userId,
                  displayName: profile.displayName,
                  email: lineEmail || undefined,  // LINE メールアドレスがあればそれを使用
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
              console.log('✅ LINE ユーザーデータを Supabase(users) に保存');
              try {
                const setupData = await setupRes.json();
                // LINEログインでも、ログイン前に選択した「利用モード（患者/医療）」を優先する
                // DBのroleはサーバー側でupgradeのみ行う（降格しない）
                if (typeof window !== 'undefined') {
                  localStorage.setItem(
                    'loginRole',
                    localStorage.getItem('loginRole') === 'medical' ? 'medical' : 'patient'
                  );
                }
                if (setupData?.sessionToken) {
                  setSession({
                    userId: profile.userId,
                    userName: profile.displayName || '',
                    sessionToken: setupData.sessionToken,
                  });
                }
              } catch {
                // ignore
              }

              // 🆕 プロフィール情報を Supabase(profiles) に初回保存
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
                    console.log('✅ LINE プロフィールを Supabase(profiles) に初期保存（メール含む）');
                  }
                }
              } catch (profileSaveError) {
                console.log('⚠️ プロフィール初期保存エラー（無視）:', profileSaveError);
              }
            } catch (profileError) {
              console.error('⚠️ LINE プロフィール取得エラー:', profileError);
            }
            
            // 🆕 ロールに応じて遷移（医療従事者はmedicalへ、患者は既存動線）
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
            } else {
            // ログインしていない場合のみウェルカムページを表示
            setIsLoggedIn(false);
          }
        } else {
          // SDKが読めていない場合でもローディング固定にしない
          console.warn('LIFF SDK not ready; falling back to login screen');
          setIsLoggedIn(false);
        }
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
        setIsLoggedIn(false);
      }
    };
    
    initLiff();
  }, [router]);

  // LINE ログイン
  const handleLineLogin = async () => {
    if (liff && !isLoggedIn) {
      try {
        // LINE ログイン画面に遷移
      window.liff.login();
        
        // ページリロード後、LIFF 初期化時にユーザーデータが保存される
      } catch (error) {
        console.error('LINE ログインエラー:', error);
        setError('LINE ログインに失敗しました');
      }
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
      
      // セッションをローカルストレージに保存
      localStorage.setItem('sessionToken', data.sessionToken);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.name || '');
      // ログイン前に選択した「利用モード（患者/医療）」を優先して保存（同一アカウントでも切替可能にする）
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
      
      // セッションをローカルストレージに保存
      localStorage.setItem(
        'sessionToken',
        data.sessionToken || Buffer.from(`${data.user.id}:${Date.now()}`).toString('base64')
      );
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.name || '');
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
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <LandingHeader />

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* ヒーロー セクション */}
        <section className="text-center py-12">
          <div className="mb-8 flex justify-center">
            <div className="w-40 h-40">
              <img 
                src="/heart-animation.gif" 
                alt="心臓ちゃん" 
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-800 mb-6 leading-tight">
            心臓の健康を <br />
            <span className="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              毎日サポート
            </span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            心臓リハビリ手帳は、心臓疾患を持つ方が安心して健康を管理できるアプリです。
            毎日の健康記録を通じて、あなたの心臓の状態を見守ります。
          </p>
          
          {/* ログイン/登録ボタン */}
          {!showLoginForm ? (
            <div className="flex flex-col gap-4 items-center">
              {/* ロール選択 */}
              <div className="inline-flex bg-white border border-orange-200 rounded-full p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    loginRole === 'patient'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                      : 'text-orange-700 hover:bg-orange-50'
                  }`}
                >
                  患者側
                </button>
                <button
                  type="button"
                  onClick={() => setRole('medical')}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    loginRole === 'medical'
                      ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                      : 'text-orange-700 hover:bg-orange-50'
                  }`}
                >
                  医療従事者側
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* LINE ログインボタン */}
          <button
            onClick={handleLineLogin}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 4.373 0 10c0 3.325 2.237 6.196 5.35 7.688-.235 1.264.077 3.45.45 4.725.05.283.3.45.55.338 2.637-1.687 5.95-3.787 7.975-5.237 1.875.338 3.862.512 5.675.512 6.627 0 12-4.373 12-10S18.627 0 12 0z"/>
            </svg>
            LINE でログイン
          </button>

              {/* メール/パスワードログインボタン */}
              <button
                onClick={() => {
                  setShowLoginForm(true);
                  handleFormSwitch(false);
                }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                メール でログイン
              </button>
              </div>
            </div>
          ) : (
            /* ログインフォーム */
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
              {/* ロール選択（フォーム内でも変更可） */}
              <div className="mb-4 flex justify-center">
                <div className="inline-flex bg-white border border-orange-200 rounded-full p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                      loginRole === 'patient'
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                        : 'text-orange-700 hover:bg-orange-50'
                    }`}
                  >
                    患者側
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('medical')}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                      loginRole === 'medical'
                        ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white'
                        : 'text-orange-700 hover:bg-orange-50'
                    }`}
                  >
                    医療従事者側
                  </button>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">
                {isSignUp ? '新規登録' : 'ログイン'}
              </h3>

              {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <form onSubmit={isSignUp ? handleSignUp : handleEmailLogin} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      お名前
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="山田太郎"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required={isSignUp}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6文字以上"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? '処理中...' : (isSignUp ? '登録' : 'ログイン')}
                </button>
              </form>

              <div className="mt-4 text-center space-y-2">
                {isSignUp ? (
                  <p className="text-gray-600">
                    アカウントをお持ちですか？{' '}
                    <button
                      onClick={() => handleFormSwitch(false)}
                      className="text-orange-600 font-bold hover:underline"
                    >
                      ログイン
                    </button>
                  </p>
                ) : (
                  <>
                    <p className="text-gray-600">
                      アカウントをお持ちでないですか？{' '}
                      <button
                        onClick={() => handleFormSwitch(true)}
                        className="text-orange-600 font-bold hover:underline"
                      >
                        新規登録
                      </button>
                    </p>
                    <p className="text-gray-600 text-sm">
                      パスワードをお忘れですか？{' '}
                      <a
                        href="/reset-password"
                        className="text-orange-600 font-bold hover:underline"
                      >
                        こちら
                      </a>
                    </p>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  setShowLoginForm(false);
                  setError('');
                }}
                className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-all"
              >
                戻る
              </button>
            </div>
          )}
        </section>

        {/* 機能セクション */}
        <section className="py-16 mt-12">
          <h3 className="text-4xl font-bold text-center text-gray-800 mb-12">
            📱 主な機能
          </h3>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: '📊',
                title: '健康記録',
                description: '血圧、脈拍、体重などの健康データを毎日記録'
              },
              {
                icon: '📈',
                title: 'グラフ表示',
                description: '健康データの推移をグラフで可視化し、変化を把握'
              },
              {
                icon: '📅',
                title: 'カレンダー管理',
                description: '過去の記録をカレンダーから簡単に確認'
              },
              {
                icon: '👨‍👩‍👧',
                title: '家族共有',
                description: '大切な家族と健康情報を安全に共有'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-1"
              >
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h4 className="text-xl font-bold text-gray-800 mb-3">{feature.title}</h4>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
                    ))}
                  </div>
        </section>

        {/* よくある質問セクション */}
        <section className="py-16 mt-12">
          <h3 className="text-4xl font-bold text-center text-gray-800 mb-12">
            ❓ よくある質問
          </h3>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {[
              {
                q: 'どのような人が使えますか？',
                a: '心臓疾患を持つ方、心臓リハビリ中の方、健康管理を重視する方なら誰でもご利用いただけます。'
              },
              {
                q: 'データは安全ですか？',
                a: 'はい。すべての健康データは暗号化されて保存され、認証により安全に管理されます。'
              },
              {
                q: 'ログイン方法は？',
                a: 'LINE ログイン、またはメールアドレスとパスワードでログインできます。'
              },
              {
                q: '医師に相談できますか？',
                a: 'アプリで記録したデータは連携された医療従事者のみが閲覧できます。PDFで印刷もできるため、受診の際に持って行くと医師との相談時に活用できます。'
              }
            ].map((faq, idx) => (
              <details
                key={idx}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <summary className="font-bold text-gray-800 text-lg">
                  {faq.q}
                </summary>
                <p className="text-gray-600 mt-4 leading-relaxed">{faq.a}</p>
              </details>
                    ))}
                  </div>
        </section>

        {/* サポート情報セクション */}
        <section className="py-16 mt-12 bg-gradient-to-r from-orange-100 to-pink-100 rounded-3xl p-12">
          <h3 className="text-4xl font-bold text-center text-gray-800 mb-8">
            📞 サポート情報
          </h3>
          
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-5xl mb-4">💬</div>
              <h4 className="font-bold text-gray-800 mb-2">お問い合わせサポート</h4>
              <p className="text-gray-600">24時間以内にお返事します</p>
                    </div>
            <div>
              <div className="text-5xl mb-4">📚</div>
              <h4 className="font-bold text-gray-800 mb-2">ヘルプセンター</h4>
              <p className="text-gray-600">よくある質問と回答集</p>
                </div>
                </div>
        </section>

        {/* CTA セクション */}
        <section className="py-16 mt-12 text-center">
          <h3 className="text-3xl font-bold text-gray-800 mb-6">
            今すぐ始めましょう
          </h3>
          {!showLoginForm && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
            onClick={handleLineLogin}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 4.373 0 10c0 3.325 2.237 6.196 5.35 7.688-.235 1.264.077 3.45.45 4.725.05.283.3.45.55.338 2.637-1.687 5.95-3.787 7.975-5.237 1.875.338 3.862.512 5.675.512 6.627 0 12-4.373 12-10S18.627 0 12 0z"/>
            </svg>
            LINE でログイン
            </button>
              <button 
                onClick={() => {
                  setShowLoginForm(true);
                  handleFormSwitch(false);
                }}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                メール でログイン
              </button>
            </div>
          )}
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-orange-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-600">
          <p>© 2024 心臓リハビリ手帳. All rights reserved.</p>
          <div className="mt-4 flex justify-center gap-6">
            <a href="/terms" className="hover:text-orange-600 transition">利用規約</a>
            <a href="/privacy" className="hover:text-orange-600 transition">プライバシーポリシー</a>
            <a href="/contact" className="hover:text-orange-600 transition">お問い合わせ</a>
            </div>
              </div>
      </footer>
    </div>
  );
}
