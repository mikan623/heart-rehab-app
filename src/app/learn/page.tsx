"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { getSession, isLineLoggedIn } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";

const learningContent = [
  {
    id: 1,
    title: "心疾患の種類",
    icon: "🏥",
    content: "主な心臓病の種類と特徴を理解する",
    details: [
      "🔹 心筋梗塞：冠状動脈が詰まり、心臓の筋肉に血液が流れなくなる病気。突然の胸痛が特徴です。",
      "🔹 狭心症：冠状動脈が狭くなり、心臓に血液が十分に流れない状態。胸に違和感や痛みを感じます。",
      "🔹 心不全：心臓が十分に機能せず、体に血液を送り出せなくなる状態。息切れやむくみが見られます。",
      "🔹 高血圧：血圧が常に高い状態が続く病気。多くの場合、自覚症状がないため『沈黙の殺し屋』と呼ばれます。",
      "🔹 不整脈：心臓の鼓動が不規則になる病気。動悸や疲労感を感じることがあります。",
      "🔹 弁膜症：心臓の弁の機能が低下する病気。息切れや疲労感が症状です。"
    ]
  },
  {
    id: 2,
    title: "心疾患になる原因",
    icon: "⚠️",
    content: "心臓病の危険因子とリスク要因を知る",
    details: [
      "🚭 喫煙：タバコの有害物質は血管を傷つけ、動脈硬化を進行させます。",
      "🧈 高コレステロール血症：悪玉コレステロール（LDL）が増えると、血管に沈着して動脈硬化が進みます。",
      "🍟 高塩分・高脂肪食：塩分過多は血圧上昇、高脂肪食はコレステロール増加につながります。",
      "⚖️ 肥満：太りすぎは心臓に負担をかけ、血圧上昇や糖尿病のリスクを高めます。",
      "🧬 遺伝：家族に心臓病患者がいると、リスクが高くなります。定期的な検査が大切です。",
      "🏃 運動不足：適度な運動は心臓や血管を強くします。毎日の活動が予防につながります。",
      "😰 ストレス：長期的なストレスは血圧上昇や不整脈の原因になります。",
      "🩺 糖尿病：血糖値が高いと血管が傷みやすく、心疾患のリスクが高まります。",
      "⌛ 加齢：年を重ねると血管が硬くなり、心疾患のリスクが増加します。"
    ]
  },
  {
    id: 3,
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
    id: 4,
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
    id: 5,
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
    id: 6,
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
    id: 7,
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
    id: 8,
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
  const [isMobile, setIsMobile] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 画面幅判定（md未満＝スマホ）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const handler = () => setIsMobile(mql.matches);
    handler();
    mql.addEventListener?.('change', handler);
    return () => mql.removeEventListener?.('change', handler);
  }, []);

  // モーダル表示中は背景スクロールを抑止
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

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
      <PageHeader
        title="📚 心臓リハビリを学ぶ"
        mobileTitleClassName="text-lg font-bold text-orange-800"
      />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* ページサブタイトル */}
        <div className="text-center mb-12">
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
                  onClick={() => {
                    setSelectedContent(item);
                    if (isMobile) setIsModalOpen(true);
                  }}
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

          {/* 右側：詳細内容（PCのみ表示。スマホはモーダルで表示） */}
          <div className="hidden md:block">
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

        {/* スマホ用：テーマ詳細モーダル */}
        {isModalOpen && selectedContent && (
          <div
            className="fixed inset-0 z-[100] bg-transparent flex items-center justify-center p-3"
            role="dialog"
            aria-modal="true"
            aria-label="学習テーマ詳細"
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl border-2 border-orange-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ヘッダー（大きい戻る・×） */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-100">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-lg font-bold px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700"
                >
                  ← 戻る
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-3xl leading-none font-bold px-4 py-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-700"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>

              {/* 本文 */}
              <div className="p-5 overflow-y-auto max-h-[calc(90vh-70px)]">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-5xl">{selectedContent.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedContent.title}</h2>
                </div>

                <p className="text-base text-gray-700 mb-4 font-semibold">
                  {selectedContent.content}
                </p>

                <div className="space-y-4">
                  {selectedContent.details.map((detail, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="min-w-8 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-base font-bold mt-0.5">
                        {index + 1}
                      </div>
                      <p className="text-gray-700 pt-1">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600">
                    💡 <strong>ポイント：</strong> わからないことや不安なことは、医師や看護師に相談してください。
                  </p>
                </div>

                {/* フッター（大きい戻る） */}
                <div className="mt-6">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="w-full text-lg font-bold py-3 rounded-2xl bg-orange-500 text-white shadow-md"
                  >
                    戻る
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

