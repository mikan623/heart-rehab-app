"use client";
import NavigationBar from "@/components/NavigationBar";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-orange-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1">
        {/* デスクトップ版：横並び */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold text-orange-800">
              利用規約
            </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              利用規約
            </h1>
          </div>
          
          {/* ナビゲーションボタン */}
          <div className="flex justify-center">
            <NavigationBar />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-4 md:p-8">
          {/* 利用規約のタイトル */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              心臓リハビリ手帳 利用規約
            </h2>
            <p className="text-sm text-gray-600">
              本アプリのご利用にあたり、以下の利用規約をお読みください。
            </p>
          </div>

          <div className="space-y-4 md:space-y-6 text-gray-700">
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第1条（目的）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、心臓リハビリテーションを必要とする方の健康管理を支援することを目的としています。
              </p>
            </section>
            
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第2条（利用について）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、血圧、脈拍、運動内容などの健康データを記録・管理するためのツールです。
                医療行為の代替となるものではありません。
              </p>
            </section>
            
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第3条（データの取り扱い）</h3>
              <p className="text-sm leading-relaxed">
                入力された健康データは、ユーザーのデバイス内に保存されます。
                第三者との共有は、ユーザーの判断で行ってください。
              </p>
            </section>
            
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第4条（免責事項）</h3>
              <p className="text-sm leading-relaxed">
                本アプリの利用により生じた損害について、開発者は一切の責任を負いません。
                健康に関する重要な判断は、必ず医師にご相談ください。
              </p>
            </section>
            
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第5条（規約の変更）</h3>
              <p className="text-sm leading-relaxed">
                本規約は、予告なく変更される場合があります。
                変更後の規約は、本アプリ内で公開された時点で効力を生じます。
              </p>
            </section>
            
            <div className="mt-6 pt-4 border-t border-gray-200 bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong>制定日:</strong> 2025年10月
                </p>
                <p className="text-xs text-gray-500">
                  最終更新: 2025年10月
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
