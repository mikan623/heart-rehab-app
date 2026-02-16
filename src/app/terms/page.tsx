import PageHeader from "@/components/PageHeader";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="利用規約"
        rightContent={
          <a
            href="/"
            className="px-3 py-1 text-sm md:px-4 md:py-2 md:text-base bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            <span className="hidden md:inline">ホームに戻る</span>
            <span className="md:hidden">戻る</span>
          </a>
        }
      />

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
                本アプリで入力された健康データやプロフィール情報は、主に当社が管理するデータベースに保存されます。
                一部の情報（ログインセッション情報、入力途中の健康記録、プロフィール情報、家族共有設定 など）は、
                利便性向上やオフライン時の一時保存のために、ユーザーの端末内ローカルストレージにも保存される場合があります。
                ローカルストレージに保存された情報は、原則としてユーザーの端末内でのみ利用され、
                ユーザーの同意なく第三者に提供されることはありません。
                家族共有機能や医療機関へのデータ共有など、ユーザーが明示的に共有を選択した場合に限り、
                必要な範囲でデータが第三者に提供されます。
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
