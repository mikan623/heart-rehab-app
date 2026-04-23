import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="プライバシーポリシー"
        rightContent={<BackButton />}
        showTourButton={false}
      />

      <main className="p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-4 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              心臓リハビリ手帳 プライバシーポリシー
            </h2>
            <p className="text-sm text-gray-600">
              開発者（以下「開発者」）は、ユーザーの個人情報を適切に保護・管理することを重要な責務と考えています。
              本ポリシーでは、収集する情報の種類・利用目的・外部サービスへの送信・保護対策についてご説明します。
            </p>
          </div>

          <div className="space-y-4 md:space-y-6 text-gray-700">
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第1条（個人情報の定義）</h3>
              <p className="text-sm leading-relaxed">
                本ポリシーにおける「個人情報」とは、氏名・メールアドレス・LINEプロフィール情報・
                血圧や脈拍などの健康データなど、特定の個人を識別できる情報を指します。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第2条（収集する情報）</h3>
              <p className="text-sm leading-relaxed mb-2">
                本アプリは、以下の情報を収集します。
              </p>
              <ul className="text-sm leading-relaxed ml-4 list-disc space-y-1">
                <li>メールアドレスおよびパスワード（メールログイン時）</li>
                <li>LINEプロフィール情報（表示名・プロフィール画像・LINEユーザーID）（LINEログイン時）</li>
                <li>ユーザーが入力する健康データ（血圧・脈拍・体重・運動・食事・服薬など）</li>
                <li>血液検査・CPXデータなどの医療検査値</li>
                <li>家族共有機能で登録する家族メンバー情報（氏名・続柄・LINEユーザーID）</li>
                <li>お問い合わせ時にご入力いただく情報</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第3条（利用目的）</h3>
              <p className="text-sm leading-relaxed mb-2">
                収集した情報は、以下の目的でのみ利用します。
              </p>
              <ul className="text-sm leading-relaxed ml-4 list-disc space-y-1">
                <li>アカウントの作成・認証・管理</li>
                <li>健康データの記録・表示・グラフ化</li>
                <li>AIアドバイス機能の提供（OpenAI APIへのデータ送信を含む）</li>
                <li>LINEによる家族共有通知・リマインダーの送信</li>
                <li>医療従事者との連携機能の提供</li>
                <li>パスワードリセットメールの送信</li>
                <li>サービスの改善・不具合対応</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第4条（外部サービスへのデータ送信）</h3>
              <p className="text-sm leading-relaxed mb-3">
                本アプリは、以下の外部サービスにデータを送信する場合があります。
                各サービスのプライバシーポリシーも併せてご確認ください。
              </p>
              <div className="space-y-3">
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-1">OpenAI（AIアドバイス機能）</p>
                  <p className="text-sm text-gray-600">
                    AIアドバイス機能をご利用の際、直近7日間の健康記録データ（血圧・脈拍・体重・運動・食事・服薬など）を
                    OpenAIのAPIサーバーに送信し、アドバイス文章を生成します。
                    氏名・メールアドレスなどの直接的な個人識別情報は送信しません。
                    OpenAIのプライバシーポリシーは公式サイトをご参照ください。
                  </p>
                </div>
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-1">LINE（家族共有・リマインダー通知）</p>
                  <p className="text-sm text-gray-600">
                    家族共有機能をご利用の場合、健康記録の一部をLINE Messaging APIを通じて家族のLINEアカウントに送信します。
                    リマインダー機能をONに設定した場合、設定した時刻にLINEへ通知が送信されます。
                    LINEログインをご利用の場合、LINEのプロフィール情報をアプリに取得・保存します。
                  </p>
                </div>
                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-1">AWS SES（パスワードリセットメール）</p>
                  <p className="text-sm text-gray-600">
                    パスワードリセット機能をご利用の際、メールアドレス宛にリセットリンクを送信するため、
                    Amazon SES（Simple Email Service）を使用します。
                    メールアドレス以外の情報は送信されません。
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第5条（情報の保護）</h3>
              <p className="text-sm leading-relaxed mb-2">
                個人情報の保護のために、以下の対策を実施しています。
              </p>
              <ul className="text-sm leading-relaxed ml-4 list-disc space-y-1">
                <li>通信はすべてSSL/TLSで暗号化</li>
                <li>パスワードはbcryptによりハッシュ化して保存（平文では保存しない）</li>
                <li>認証にはhttpOnly CookieによるJWTを使用し、XSSによるトークン窃取を防止</li>
                <li>APIキー・DB接続情報などのシークレットはAWS Secrets Managerで一元管理</li>
                <li>セキュリティヘッダー（CSP・HSTS・X-Frame-Options等）の設定</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第6条（第三者への提供）</h3>
              <p className="text-sm leading-relaxed mb-2">
                以下の場合を除き、ユーザーの個人情報を第三者に提供しません。
              </p>
              <ul className="text-sm leading-relaxed ml-4 list-disc space-y-1">
                <li>ユーザー本人の明示的な同意がある場合</li>
                <li>家族共有機能により、ユーザーが共有を選択した場合</li>
                <li>医療従事者との連携機能により、ユーザーが承認した医療従事者がデータを閲覧する場合</li>
                <li>第4条に記載の外部サービスへのデータ送信（利用目的の範囲内）</li>
                <li>法令により提供が義務付けられている場合</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第7条（Cookieの使用）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、ログイン認証のためにhttpOnly Cookieを使用します。
                このCookieにはJWT（認証トークン）が含まれており、
                JavaScriptからはアクセスできない設定で安全に管理されています。
                ブラウザの設定でCookieを無効にすると、ログイン機能が利用できなくなります。
                広告目的やトラッキング目的のCookieは使用していません。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第8条（ローカルストレージの使用）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、ログイン状態の維持やロール（患者／医療従事者）の記憶のため、
                ブラウザのローカルストレージにユーザーID・表示名・ログインロールなどを保存します。
                健康データそのものはサーバー側にのみ保存されます。
                ローカルストレージの情報はユーザーの端末内でのみ利用され、
                ログアウトすることで削除されます。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第9条（個人情報の確認・削除）</h3>
              <p className="text-sm leading-relaxed">
                ユーザーは、本アプリ内のプロフィール画面からご自身の情報を確認・編集できます。
                アカウントの削除またはデータの消去をご希望の場合は、
                お問い合わせフォームよりご連絡ください。速やかに対応いたします。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第10条（ポリシーの変更）</h3>
              <p className="text-sm leading-relaxed">
                本ポリシーは、法令の改正やサービス変更に応じて更新される場合があります。
                重要な変更が生じた場合は、アプリ内またはお問い合わせ等を通じてお知らせします。
                変更後のポリシーは、本ページに掲載した時点で効力を生じます。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第11条（お問い合わせ）</h3>
              <p className="text-sm leading-relaxed">
                本プライバシーポリシーや個人情報の取り扱いについてご不明な点がございましたら、
                下記のお問い合わせフォームよりご連絡ください。
              </p>
              <p className="text-sm leading-relaxed mt-3">
                <a href="/contact" className="text-orange-600 hover:underline font-medium">
                  お問い合わせフォームはこちら
                </a>
              </p>
            </section>

            <div className="mt-6 pt-4 border-t border-gray-200 bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong>制定日:</strong> 2025年10月
                </p>
                <p className="text-xs text-gray-500">
                  最終更新: 2026年4月
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
