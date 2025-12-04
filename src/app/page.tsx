'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setLineLoggedInDB, setLineLogin } from '@/lib/auth';

export default function LandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [liff, setLiff] = useState<any>(null);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  // ログインフォームの状態
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // LIFF初期化とログイン状態チェック
  useEffect(() => {
    setIsClient(true);

    // ローカルストレージからセッション確認
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      router.push('/health-records');
      return;
    }

    const initLiff = async () => {
      try {
        if (typeof window !== 'undefined' && window.liff) {
          await window.liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID 
          });
          
          setLiff(window.liff);

          // ログイン状態をチェック
          if (window.liff.isLoggedIn()) {
            // ✅ LINE ログイン済み時：ユーザー情報を取得して Supabase に保存
            try {
              const profile = await window.liff.getProfile();
              console.log('✅ LINE プロフィール取得:', profile);
              
              // 🆕 メモリに保存
              setLineLogin(profile.userId, profile.displayName);
              
              // 🆕 Supabase にユーザー情報を保存（users テーブル）
              await setLineLoggedInDB(profile.userId, true, profile.userId);
              console.log('✅ LINE ユーザーデータを Supabase(users) に保存');

              // 🆕 プロフィール情報を Supabase(profiles) に初回保存
              try {
                const res = await fetch(`/api/profiles?userId=${profile.userId}`);
                if (res.ok) {
                  const data = await res.json();
                  if (!data.profile) {
                    await fetch('/api/profiles', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId: profile.userId,
                        profile: {
                          displayName: profile.displayName || '',
                        },
                      }),
                    });
                    console.log('✅ LINE プロフィールを Supabase(profiles) に初期保存');
                  }
                }
              } catch (profileSaveError) {
                console.log('⚠️ プロフィール初期保存エラー（無視）:', profileSaveError);
              }
            } catch (profileError) {
              console.error('⚠️ LINE プロフィール取得エラー:', profileError);
            }
            
            // 健康記録ページに移動
            router.push('/health-records');
            return;
          } else {
            // ログインしていない場合のみウェルカムページを表示
            setIsLoggedIn(false);
          }
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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

      // 健康記録ページへ移動
      router.push('/health-records');
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
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '登録に失敗しました');
        return;
      }

      const data = await response.json();
      
      // セッションをローカルストレージに保存
      localStorage.setItem('sessionToken', data.sessionToken || Buffer.from(`${data.user.id}:${Date.now()}`).toString('base64'));
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.name || '');

      // 健康記録ページへ移動
      router.push('/health-records');
    } catch (err) {
      setError('通信エラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
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
      {/* ナビゲーションヘッダー */}
      <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10">
              <img 
                src="/heart-animation.gif" 
                alt="心臓ちゃん" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              心臓リハビリ手帳
            </h1>
          </div>
        </div>
      </header>

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
          ) : (
            /* ログインフォーム */
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 mb-8">
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

              <div className="mt-4 text-center">
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
                  <p className="text-gray-600">
                    アカウントをお持ちでないですか？{' '}
                    <button
                      onClick={() => handleFormSwitch(true)}
                      className="text-orange-600 font-bold hover:underline"
                    >
                      新規登録
                    </button>
                  </p>
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
                a: 'アプリで記録したデータは医療機関フォーマットでエクスポート可能。PDFで印刷もできるため、受診の際に持って行くと医師との相談時に活用できます。'
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
              <h4 className="font-bold text-gray-800 mb-2">チャットサポート</h4>
              <p className="text-gray-600">24時間以内にお返事します</p>
            </div>
            <div>
              <div className="text-5xl mb-4">📧</div>
              <h4 className="font-bold text-gray-800 mb-2">メールサポート</h4>
              <p className="text-gray-600">info@heart-rehab.jp</p>
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
            <a href="mailto:support@heart-rehab.jp" className="hover:text-orange-600 transition">お問い合わせ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
