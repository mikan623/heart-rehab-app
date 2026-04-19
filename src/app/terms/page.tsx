import PageHeader from "@/components/PageHeader";
import BackButton from "@/components/BackButton";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="利用規約"
        rightContent={<BackButton />}
      />

      <main className="p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-4 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              心臓リハビリ手帳 利用規約
            </h2>
            <p className="text-sm text-gray-600">
              本アプリをご利用いただく前に、以下の利用規約をよくお読みください。
              ご利用を開始した時点で、本規約に同意いただいたものとみなします。
            </p>
          </div>

          <div className="space-y-4 md:space-y-6 text-gray-700">
            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第1条（目的）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、心臓リハビリテーションを必要とする方および健康管理に関心のある方が、
                日々のバイタルデータや生活習慣を記録・管理し、継続的な健康維持を支援することを目的としています。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第2条（利用対象と医療行為について）</h3>
              <p className="text-sm leading-relaxed">
                本アプリは、血圧・脈拍・体重・運動・食事・服薬などの健康データを記録・管理するためのツールです。
                本アプリはあくまで健康管理の補助を目的としており、医療行為・医学的診断・治療の代替となるものではありません。
                健康に関する重要な判断は、必ず担当医師にご相談ください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第3条（アカウントの管理）</h3>
              <p className="text-sm leading-relaxed">
                ユーザーは、自身のアカウント情報（メールアドレス・パスワード、またはLINEアカウント）を
                責任をもって管理してください。第三者への譲渡・貸与は禁止します。
                アカウント情報の漏洩や不正利用が疑われる場合は、速やかにパスワードを変更するか、
                お問い合わせフォームよりご連絡ください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第4条（禁止事項）</h3>
              <p className="text-sm leading-relaxed mb-2">
                本アプリの利用にあたり、以下の行為を禁止します。
              </p>
              <ul className="text-sm leading-relaxed ml-4 list-disc space-y-1">
                <li>他のユーザーや第三者の権利を侵害する行為</li>
                <li>虚偽の情報を登録・入力する行為</li>
                <li>本アプリのサーバーや機能に過大な負荷をかける行為</li>
                <li>不正アクセス・リバースエンジニアリングなど、本アプリの正常な運営を妨げる行為</li>
                <li>本アプリを商業目的で無断利用する行為</li>
                <li>その他、法令または公序良俗に違反する行為</li>
              </ul>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第5条（AIアドバイス機能について）</h3>
              <p className="text-sm leading-relaxed">
                本アプリのAI健康アドバイス機能は、OpenAI APIを使用しています。
                直近7日間の健康記録データをOpenAIのサーバーに送信し、パーソナライズされたアドバイスを生成します。
                AIによるアドバイスはあくまで参考情報であり、医師の診断・指示に代わるものではありません。
                アドバイスの内容を実践する際は、担当医師にご確認ください。
                OpenAIへのデータ送信については、プライバシーポリシーもあわせてご確認ください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第6条（データの取り扱い）</h3>
              <p className="text-sm leading-relaxed">
                本アプリで入力された健康データおよびプロフィール情報は、
                開発者が管理するデータベース（AWS上）に暗号化して保存されます。
                家族共有機能や医療従事者との連携機能など、ユーザーが明示的に共有を選択した場合に限り、
                必要な範囲でデータが共有されます。
                詳細な個人情報の取り扱いについては、プライバシーポリシーをご参照ください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第7条（サービスの変更・停止）</h3>
              <p className="text-sm leading-relaxed">
                開発者は、システムメンテナンスや技術的な問題、その他やむを得ない事情により、
                予告なくサービスの一部または全部を変更・停止する場合があります。
                サービスの停止によって生じた損害について、開発者は責任を負いかねます。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第8条（免責事項）</h3>
              <p className="text-sm leading-relaxed">
                本アプリの利用により生じた損害（データの消失・サービス停止・AIアドバイスの誤りなど）について、
                開発者は法令上の責任を除き、一切の責任を負いません。
                本アプリは健康管理の補助ツールであり、緊急時は必ず救急・医療機関にご連絡ください。
              </p>
            </section>

            <section className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">第9条（規約の変更）</h3>
              <p className="text-sm leading-relaxed">
                本規約は、法令の改正やサービス内容の変更に応じて更新される場合があります。
                変更後の規約は、本アプリ内またはウェブサイトに掲載した時点で効力を生じます。
                重要な変更が生じた場合は、アプリ内でお知らせします。
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
