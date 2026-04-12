"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, isLineLoggedIn } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import NavigationBar from "@/components/NavigationBar";

export default function AiGuidanceClient() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }
    if (isLineLoggedIn()) {
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }
    router.push('/');
  }, [router]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAdvice(null);
    setError(null);
    try {
      const res = await apiFetch('/api/ai-health-guidance', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'エラーが発生しました');
        return;
      }
      setAdvice(data.advice);
    } catch {
      setError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsGenerating(false);
    }
  };

  // アドバイスを見出し・箇条書きに応じて整形して表示
  const renderAdvice = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ') || line.startsWith('### ')) {
        const heading = line.replace(/^#{2,3}\s/, '');
        return (
          <h3 key={i} className="text-base font-bold text-orange-800 mt-4 mb-1">
            {heading}
          </h3>
        );
      }
      if (line.startsWith('- ') || line.startsWith('・')) {
        return (
          <li key={i} className="ml-4 text-sm text-gray-700 list-disc">
            {line.replace(/^[-・]\s?/, '')}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={i} className="h-2" />;
      }
      return (
        <p key={i} className="text-sm text-gray-700">
          {line}
        </p>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">ログインしてください</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="🤖 AI健康アドバイス"
        mobileTitleClassName="text-lg font-bold text-orange-800"
      />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="text-center mb-8">
          <p className="text-gray-600 text-sm">
            直近7日間の健康記録を元に、AIがあなたに合った健康アドバイスを生成します。
          </p>
        </div>

        {/* 生成ボタン */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-8 py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-md
              hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center gap-3 text-base"
          >
            {isGenerating ? (
              <>
                <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                アドバイスを生成中...
              </>
            ) : (
              <>
                ✨ アドバイスを生成する
              </>
            )}
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* アドバイス表示 */}
        {advice && (
          <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-orange-100">
              <span className="text-2xl">💖</span>
              <h2 className="text-base font-bold text-orange-800">
                今週の健康アドバイス
              </h2>
            </div>
            <div className="space-y-1">
              {renderAdvice(advice)}
            </div>
            <div className="mt-6 p-3 bg-orange-50 rounded-xl border border-orange-100">
              <p className="text-xs text-gray-500">
                ⚠️ このアドバイスはAIによる参考情報です。医療上の判断は必ず担当医にご相談ください。
              </p>
            </div>
          </div>
        )}

        {/* 初期状態の案内 */}
        {!advice && !error && !isGenerating && (
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 text-center text-gray-500">
            <p className="text-4xl mb-3">🏥</p>
            <p className="text-sm">
              ボタンを押すと、健康記録を分析して<br />
              パーソナライズされたアドバイスが届きます。
            </p>
          </div>
        )}
      </main>

      <NavigationBar />
    </div>
  );
}
