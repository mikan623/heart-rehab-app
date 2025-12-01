'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [liff, setLiff] = useState<any>(null);

  // LIFF初期化とログイン状態チェック
  useEffect(() => {
    setIsClient(true);

    const initLiff = async () => {
      try {
        if (typeof window !== 'undefined' && window.liff) {
          await window.liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID 
          });
          
          setLiff(window.liff);

          // ログイン状態をチェック
          if (window.liff.isLoggedIn()) {
            // ログイン済みなら即座に健康記録ページに移動
            // ローディング画面を表示したままにする
            router.push('/health-records');
            return; // isLoggedIn を設定せず、ローディング画面を保持
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
  const handleLineLogin = () => {
    if (liff && !isLoggedIn) {
      window.liff.login();
    }
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
                a: 'はい。すべての健康データは暗号化されて保存され、LINE認証により安全に管理されます。'
              },
              {
                q: 'オフラインで使用できますか？',
                a: 'はい。健康記録はローカルストレージに保存されるため、インターネット接続がなくても使用できます。'
              },
              {
                q: '医師に相談できますか？',
                a: 'アプリで記録したデータは医療機関フォーマットでエクスポート可能。医師との相談時に活用できます。'
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
              <p className="text-gray-600">support@heart-rehab.jp</p>
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
            <button 
            onClick={handleLineLogin}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-full font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 4.373 0 10c0 3.325 2.237 6.196 5.35 7.688-.235 1.264.077 3.45.45 4.725.05.283.3.45.55.338 2.637-1.687 5.95-3.787 7.975-5.237 1.875.338 3.862.512 5.675.512 6.627 0 12-4.373 12-10S18.627 0 12 0z"/>
            </svg>
            LINE でログイン
            </button>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-orange-200 mt-16 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-gray-600">
          <p>© 2024 心臓リハビリ手帳. All rights reserved.</p>
          <div className="mt-4 flex justify-center gap-6">
            <a href="#" className="hover:text-orange-600 transition">利用規約</a>
            <a href="#" className="hover:text-orange-600 transition">プライバシーポリシー</a>
            <a href="#" className="hover:text-orange-600 transition">お問い合わせ</a>
            </div>
              </div>
      </footer>
    </div>
  );
}
