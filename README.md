# 心臓リハビリ手帳 💖

心臓の健康を、毎日サポート。

心臓疾患を持つ患者が日々の健康を安心して管理できるWebアプリケーションです。
元理学療法士が開発し、医療現場の課題をITで解決することをコンセプトにしています。

### [リンク]: https://app.patient-held-diary.org

### [GitHub]: https://github.com/mikan623/heart-rehab-app

---

# 特に見ていただきたい点

- ### インフラ面
  - DockerコンテナをAWS ECS（Fargate）でサーバーレス運用している点
  - GitHub ActionsでCI/CDパイプラインを構築し、mainブランチへのpushで自動デプロイされる点
  - AWS Secrets Managerでシークレットを一元管理し、セキュアな本番運用を実現している点
  - AWS ECRでDockerイメージを管理している点

- ### バックエンド面
  - Prisma ORMによる型安全なデータベースアクセス
  - JWT認証をhttpOnly Cookieで管理し、XSSによるトークン窃取を防止している点
  - LINE LIFF（LINE Front-end Framework）を用いたLINEログインの実装
  - LINE Messaging APIによる家族への健康記録通知・リマインダー機能
  - AWS SES（Nodemailer経由）によるパスワードリセットメール送信
  - OpenAI API（gpt-4o-mini）を活用したAI健康アドバイス機能

- ### フロントエンド面
  - Chart.jsによる血圧・脈拍・体重の推移グラフ表示
  - html2canvas + jsPDFによるPDFエクスポート機能
  - スマートフォン対応のレスポンシブUI（Tailwind CSS）

---

# 機能一覧

| 機能 | 内容 |
|---|---|
| 健康記録 | 血圧・脈拍・体重・運動・食事・服薬を毎日記録 |
| AI健康アドバイス | 直近7日間の記録を元にOpenAIがパーソナライズされたアドバイスを生成 |
| 血液検査データ管理 | HbA1c・コレステロール・BNPなどの検査値を管理 |
| CPXデータ管理 | 心肺運動負荷試験（VO2・METs・AT）の結果を記録 |
| グラフ表示 | 健康データの推移をグラフで可視化 |
| カレンダー | 過去の記録をカレンダーから確認・編集 |
| 家族共有 | 健康記録をLINE通知で家族にリアルタイム共有 |
| 医療従事者画面 | 担当患者の健康記録・検査データを一覧管理 |
| PDFエクスポート | 健康記録をPDFで出力・印刷 |
| LINEログイン | LINE LIFF（OIDC）によるワンタップログイン |
| メールログイン | メールアドレス＋パスワードでのログイン・新規登録 |
| パスワードリセット | メール経由でのパスワードリセット |
| リマインダー | 記録忘れをLINEで通知 |
| 学習コンテンツ | 心臓リハビリ・血圧管理・運動療法などの知識コンテンツ |

---

# 使用技術

### フロントエンド
- **Next.js 16（Turbopack）** / **React 19** / **TypeScript**
- **Tailwind CSS v4**
- **Chart.js** / react-chartjs-2
- **jsPDF** / html2canvas

### バックエンド
- **Next.js API Routes**
- **Prisma ORM**
- **PostgreSQL**
- **Nodemailer**（AWS SES）

### インフラ
- **AWS ECS Fargate** / **ECR**
- **AWS Secrets Manager**
- **Docker**
- **GitHub Actions**（CI/CD）

### 外部連携
- **LINE LIFF** / **LINE Messaging API**
- **OpenAI API**（gpt-4o-mini）

---

# 環境変数

`.env.local` に以下を設定してください：

```bash
DATABASE_URL=
NEXT_PUBLIC_LIFF_ID=
LINE_CHANNEL_ACCESS_TOKEN=
LINE_CHANNEL_SECRET=
LINE_LOGIN_CHANNEL_ID=
JWT_SECRET=
OPENAI_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
REMINDER_CRON_SECRET=
```

---

# ローカル起動

```bash
# リポジトリをクローン
git clone https://github.com/mikan623/heart-rehab-app.git
cd heart-rehab-app

# 依存関係をインストール
npm install

# Prismaクライアント生成
npx prisma generate

# 開発サーバーを起動（ポート3002）
npm run dev
```

ブラウザで `http://localhost:3002` を開く

---

# 作者

**Hara Shinoka**
- GitHub: [@mikan623](https://github.com/mikan623)
- 前職：理学療法士（医療機関・リハビリテーション施設）
- 医療現場のIT化に関心を持ち、現場の課題を解決するアプリ開発に取り組んでいます
