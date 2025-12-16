"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { getSession, isLineLoggedIn } from "@/lib/auth";

// LIFF型定義を追加
declare global {
  interface Window {
    liff: any;
  }
}

const learningContent = [
  {
    id: 1,
    title: "心臓リハビリとは",
    icon: "❤️",
    content: "心臓疾患の予防・改善のための運動・食事・日常生活指導",
    details: [
      "心臓病の患者様が、心身の機能を回復し、社会復帰することを目的とした医学的管理です。",
      "医師、看護師、理学療法士などの専門スタッフが、安全で効果的なプログラムを提供します。",
      "定期的な運動、栄養管理、禁煙などを通じて、心臓の健康を保つことができます。"
    ]
  },
  {
    id: 2,
    title: "血圧管理について",
    icon: "📊",
    content: "正常な血圧値とセルフチェック方法を学ぶ",
    details: [
      "理想的な血圧：120/80 mmHg未満",
      "高血圧：140/90 mmHg以上",
      "毎日同じ時間に測定することが重要です",
      "朝食前と夜寝る前の測定がおすすめです"
    ]
  },
  {
    id: 3,
    title: "運動療法",
    icon: "🏃‍♀️",
    content: "安全で効果的な運動の種類と実践方法",
    details: [
      "ウォーキング：週3〜5回、1回30分程度",
      "スイミング：水の浮力で関節への負担が少ない",
      "サイクリング：強度を調整しやすい",
      "運動前後の準備運動・クールダウンが大切です"
    ]
  },
  {
    id: 4,
    title: "食事療法",
    icon: "🍽️",
    content: "心臓に優しい食事のポイント",
    details: [
      "塩分制限：1日6g未満を目指す",
      "脂質制限：飽和脂肪酸を控える",
      "バランスの良い食事：野菜・果物・魚を意識的に摂取",
      "アルコール：適量の飲酒に留める"
    ]
  },
  {
    id: 5,
    title: "ストレス管理",
    icon: "🧘",
    content: "心と身体のリラックス方法",
    details: [
      "瞑想やヨガで心を落ち着ける",
      "十分な睡眠を心がける（7時間程度）",
      "趣味や好きなことの時間を確保する",
      "必要に応じて医師や心理士に相談する"
    ]
  },
  {
    id: 6,
    title: "日常生活のポイント",
    icon: "✨",
    content: "心臓病予防の日常的な工夫",
    details: [
      "階段を意識的に利用する",
      "長時間同じ姿勢を避ける",
      "急激な温度変化を避ける（温度バリアフリー）",
      "定期的に医師の診察を受ける"
    ]
  }
];

export default function LearnPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedContent, setSelectedContent] = useState<typeof learningContent[0] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 認証チェック
  useEffect(() => {
    const session = getSession();
    
    // メールログインセッション優先
    if (session) {
      console.log('📧 メールログイン確認');
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // LINE ログイン判定
    if (isLineLoggedIn()) {
      console.log('✅ LINE ログイン確認');
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // ログインなし → ホームへ
    console.log('❌ ログインなし');
    router.push('/');
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return isAuthenticated ? (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1">
        <NavigationBar />
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ページタイトル */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
            📚 心臓リハビリを学ぶ
          </h1>
          <p className="text-lg text-gray-600">
            心臓の健康を守るための知識を身につけましょう
          </p>
        </div>

        {/* メインコンテンツ */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* 左側：学習内容一覧 */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">学習テーマ</h2>
            <div className="space-y-3">
              {learningContent.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedContent(item)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedContent?.id === item.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">{item.content}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 右側：詳細内容 */}
          <div>
            {selectedContent ? (
              <div className="bg-white rounded-lg border-2 border-orange-200 p-6 sticky top-24">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-5xl">{selectedContent.icon}</span>
                  <h2 className="text-3xl font-bold text-gray-900">{selectedContent.title}</h2>
                </div>

                <p className="text-lg text-gray-700 mb-6 font-semibold">
                  {selectedContent.content}
                </p>

                <div className="space-y-4">
                  {selectedContent.details.map((detail, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="min-w-6 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold mt-1">
                        {index + 1}
                      </div>
                      <p className="text-gray-700 pt-0.5">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600">
                    💡 <strong>ポイント：</strong> わからないことや不安なことは、医師や看護師に相談してください。
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center sticky top-24">
                <p className="text-3xl mb-4">👈</p>
                <p className="text-lg text-gray-600">
                  左のテーマをクリックして、詳細を見てください
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 推奨事項セクション */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 border-2 border-blue-200 shadow-sm">
            <h3 className="text-xl font-bold text-blue-900 mb-3 flex items-center gap-2">
              ✅ 毎日のチェックリスト
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>□ 血圧を測定した</li>
              <li>□ 運動をした</li>
              <li>□ バランスの良い食事をした</li>
              <li>□ 塩分に気をつけた</li>
              <li>□ 十分な睡眠をとった</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-green-200 shadow-sm">
            <h3 className="text-xl font-bold text-green-900 mb-3 flex items-center gap-2">
              🎯 目標設定のコツ
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• 小さく始める</li>
              <li>• 継続することを優先</li>
              <li>• 完璧を目指さない</li>
              <li>• 進捗を記録する</li>
              <li>• 医師に相談する</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-red-200 shadow-sm">
            <h3 className="text-xl font-bold text-red-900 mb-3 flex items-center gap-2">
              ⚠️ 注意が必要な症状
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• 胸痛・圧迫感</li>
              <li>• 呼吸困難</li>
              <li>• 激しい動悸</li>
              <li>• めまい・失神</li>
              <li>💬 異常を感じたら、すぐに医師に連絡してください</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
      <p className="text-gray-600">ログインしてください</p>
    </div>
  );
}

