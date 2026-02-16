export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1">
        {/* デスクトップ版：横並び */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold text-orange-800">
              プライバシーポリシー
            </h1>
          </div>
          {/* ホームに戻るボタン */}
          <a 
            href="/" 
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
            ホームに戻る
          </a>
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              プライバシーポリシー
            </h1>
            {/* ホームに戻るボタン */}
            <a 
              href="/" 
              className="px-3 py-1 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors">
              戻る
            </a>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-4 md:p-8">
          {/* プライバシーポリシーのタイトル */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              心臓リハビリ手帳 プライバシーポリシー
            </h2>
            <p className="text-sm text-gray-600">
              本アプリのプライバシーポリシーをご説明します。
              個人情報の取り扱いについてご不明な点がございましたら、
              お気軽にお問い合わせください。
            </p>
          </div>

          <div className="space-y-4 md:space-y-6 text-gray-700">
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第1条（個人情報について）</h3>
              <p className="text-sm leading-relaxed">
                本プライバシーポリシーにおいて「個人情報」とは、
                氏名、メールアドレス、血圧や脈拍などの健康データなど、
                ユーザーを特定できる情報のことを指します。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第2条（個人情報の収集）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、以下の個人情報を収集する場合があります：
              </p>
              <ul className="text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
                <li>ログイン時に入力されるメールアドレスとパスワード</li>
                <li>LINE ログイン時に取得される LINE プロフィール情報（表示名、プロフィール画像など）</li>
                <li>ユーザーが手動で入力する健康データ（血圧、脈拍、体重など）</li>
                <li>食事や運動などの日常生活データ</li>
                <li>家族共有機能により登録・共有される家族メンバー情報（氏名、続柄、LINEユーザーID、メールアドレスなど）</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第3条（個人情報の利用目的）</h3>
              <p className="text-sm leading-relaxed">
                収集した個人情報は、以下の目的でのみ利用します：
              </p>
              <ul className="text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
                <li>本アプリのサービス提供と改善</li>
                <li>ユーザーアカウントの管理と認証</li>
                <li>健康データの記録と管理</li>
                <li>家族共有機能の提供</li>
                <li>医療機関へのデータ共有</li>
                <li>ユーザーサポートとお問い合わせ対応</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第4条（個人情報の保護）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、ユーザーの個人情報を保護するために、
                以下の対策を実施しています：
              </p>
              <ul className="text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
                <li>すべての健康データは暗号化されて保存されます</li>
                <li>パスワードは安全なハッシュ化アルゴリズムで保護されます</li>
                <li>通信は SSL/TLS で暗号化されます</li>
                <li>定期的なセキュリティ監査を実施します</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第5条（個人情報の第三者提供）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、以下の場合を除き、ユーザーの個人情報を第三者に提供しません：
              </p>
              <ul className="text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
                <li>ユーザー本人の明示的な同意がある場合</li>
                <li>家族共有機能により、ユーザーが共有を選択した場合</li>
                <li>医療機関へのデータエクスポート機能により、ユーザーが共有を選択した場合</li>
                <li>法律により提供が要求される場合</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第6条（LINE ログインについて）</h3>
              <p className="text-sm leading-relaxed">
                本アプリで LINE ログインを利用する場合、以下の点にご同意いただきます：
              </p>
              <ul className="text-sm leading-relaxed mt-2 ml-4 list-disc space-y-1">
                <li>LINE の個人情報ポリシーも適用されます</li>
                <li>LINE プロフィール情報（表示名、プロフィール画像、LINEユーザーID）がアプリに保存されます</li>
                <li>LINE ログイン情報の詳細については、LINE の公式ドキュメントをご参照ください</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第7条（個人情報へのアクセス権）</h3>
              <p className="text-sm leading-relaxed">
                ユーザーは、本アプリ内でいつでも自分の個人情報を確認、
                編集、または削除することができます。
                削除を希望される場合は、本アプリ内の設定から実行してください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第8条（ローカルストレージについて）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、ユーザーの利便性向上や一時的なバックアップのために、
                ユーザーのデバイスのローカルストレージに一部の情報（ログインセッション情報、
                プロフィール情報、健康記録データの一時保存、家族共有設定 など）を保存する場合があります。
                これらのデータは主にオフライン環境での利用や入力内容の保持を目的としており、
                原則としてユーザーのデバイス内でのみ利用されます。
                ユーザーはブラウザの設定やアプリ内のログアウト操作などにより、
                これらのローカルデータを削除することができます。
                ローカルストレージに保存された情報を、ユーザーの同意なく外部に送信することはありません。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第9条（Cookies の使用）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、ユーザー体験を向上させるため、
                限定的に Cookies を使用する場合があります。
                ブラウザの設定で Cookies を無効にすることもできます。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第10条（ポリシーの変更）</h3>
              <p className="text-sm leading-relaxed">
                本ポリシーは、予告なく変更される場合があります。
                変更後のポリシーは、本アプリ内で公開された時点で効力を生じます。
                重要な変更の場合は、事前に通知する努力をいたします。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第11条（お問い合わせ）</h3>
              <p className="text-sm leading-relaxed">
                本プライバシーポリシーについてご不明な点や
                個人情報の取り扱いについてのご質問がございましたら、
                本アプリ内の「お問い合わせフォーム」よりご連絡ください。
              </p>
              <p className="text-sm leading-relaxed mt-3">
                <strong>お問い合わせフォーム：</strong>
                <a href="/contact" className="text-orange-600 hover:underline">
                  お問い合わせページ
                </a>
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

