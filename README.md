# 心臓リハビリ記録アプリ# 心臓リハビリ記録アプリ 💖

循環器疾患患者向けの健康管理アプリケーション。日々の血圧・脈拍・体重を記録し、AIが個別アドバイスを生成します。LINE Mini Appとして動作し、家族間での情報共有も可能です。

## 🎯 主な機能

### 1. 健康記録管理
- 血圧（収縮期/拡張期）、脈拍、体重の記録
- 運動内容・時間の記録
- 食事内容（主食・主菜・副菜）の記録
- 日常生活メモ

### 2. データ可視化
- 血圧・脈拍・体重の推移グラフ
- 年齢別の正常範囲表示
- カレンダービューでの記録一覧

### 3. AIアドバイス機能
- 記録データに基づく健康アドバイス生成
- ルールベースエンジン（無料・安定）
- Hugging Face連携（拡張可能）

### 4. LINE連携
- LINE Mini App（LIFF）として動作
- LINEアカウントでログイン
- トークへの通知送信

### 5. その他
- PDF出力（印刷・共有用）
- 家族メンバー管理
- プロフィール設定

## 🛠 技術スタック

### フロントエンド
- **Next.js 15** - React フレームワーク
- **TypeScript** - 型安全性
- **Tailwind CSS** - スタイリング
- **Chart.js** - データ可視化
- **jsPDF + html2canvas** - PDF生成

### バックエンド
- **Next.js API Routes** - サーバーレスAPI
- **Prisma** - ORM
- **PostgreSQL** - データベース

### 外部API
- **LINE LIFF** - 認証・ミニアプリ
- **LINE Messaging API** - 通知送信
- **Hugging Face Inference API** - AI機能（オプション）

## 📦 セットアップ

### 必要な環境
- Node.js 18以上
- npm または yarn
- PostgreSQL データベース

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/your-username/heart-rehab-app.git
cd heart-rehab-app

# 依存関係をインストール
npm install

# 環境変数を設定
cp .env.example .env.local
# .env.local を編集して必要な値を設定

# Prismaのマイグレーション
npx prisma generate
npx prisma migrate dev

# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:3002` を開く

## 🔑 環境変数

`.env.local` に以下を設定してください：

```bash
# データベース
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# LINE
NEXT_PUBLIC_LIFF_ID="your-liff-id"
NEXT_PUBLIC_LINE_ACCESS_TOKEN="your-channel-access-token"

# AI機能（オプション）
HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxx"
```

詳細は `.env.example` を参照してください。

## 🚀 デプロイ

### Vercel（推奨）

```bash
# Vercel CLIをインストール
npm install -g vercel

# デプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 環境変数の設定
Vercel Dashboardで上記の環境変数を設定してください。

## 📱 LINE Mini App設定

1. LINE Developers Consoleでチャネルを作成
2. LIFF アプリを追加
3. Endpoint URLを設定: `https://your-domain.vercel.app/graph`
4. Scopeを設定: `profile`, `openid`
5. LIFF IDを `.env.local` に追加

## 🎨 主な画面

### メイン画面
- 健康記録の入力フォーム
- 心臓ちゃんキャラクター表示

### カレンダー画面
- 月別カレンダービュー
- 記録の編集・削除機能

### グラフ画面
- 血圧・脈拍・体重の推移グラフ
- AIアドバイス表示・LINE送信

### プロフィール画面
- 個人情報設定
- 疾患・服薬情報

### 家族画面
- 家族メンバー管理
- 緊急連絡先

## 💡 工夫した点

### 1. LINEミニアプリ最適化
- Safe Area対応（ノッチ・ホームバーへの配慮）
- タッチ操作の最適化（最小タップエリア44px）
- iOS Safariのズーム防止（font-size: 16px）

### 2. データベース設計
- ユーザーIDでデータ分離（マルチテナント）
- JSON型で柔軟なデータ格納（meal, exercise）
- 日付+時間帯でユニーク制約

### 3. AI機能の実装
- ルールベースエンジンでフォールバック
- Hugging Face APIで拡張可能
- サーバー側処理でセキュリティ確保

### 4. パフォーマンス
- Next.js Turbopackで高速開発
- API Routesでサーバーレス化
- Prismaのコネクションプーリング

## 🧪 テスト

```bash
# ユニットテスト
npm test

# テストカバレッジ
npm run test:coverage
```

## 📝 今後の改善予定

- [ ] テストカバレッジの向上（現在: 基本実装のみ）
- [ ] CI/CDパイプライン構築（GitHub Actions）
- [ ] Sentryでエラー監視
- [ ] Storybookでコンポーネントカタログ
- [ ] アクセシビリティ対応強化
- [ ] PWA化（オフライン対応）

## 🤔 技術的な意思決定

### なぜNext.jsを選んだか？
- SSR/SSGでSEO対策
- API Routesでフルスタック開発
- Vercelで簡単デプロイ
- TypeScript標準サポート

### なぜPrismaを選んだか？
- 型安全なクエリ
- マイグレーション管理が容易
- PostgreSQL最適化

### なぜルールベースAIを実装したか？
- コスト削減（無料）
- レスポンス速度の安定性
- 医療ドメイン特化ロジック

## 📄 ライセンス

MIT License

## 👤 作者

**Shinoka Hara**
- GitHub: [@your-username](https://github.com/your-username)
- LinkedIn: [your-profile](https://linkedin.com/in/your-profile)

## 🙏 謝辞

このプロジェクトは循環器リハビリテーションの現場の声を参考に作成しました。

---

⭐ このプロジェクトが役に立ったら、スターをつけていただけると嬉しいです！

## 概要
循環器患者向けの健康管理アプリ。血圧・脈拍・体重を記録し、AIがアドバイスを生成。

## 技術スタック
- Next.js 15, TypeScript, Prisma, PostgreSQL
- LINE LIFF, Chart.js, jsPDF

## 主な機能
1. 健康記録のCRUD
2. グラフ表示
3. AIアドバイス
4. PDF出力
5. LINE連携

## デモ
[デモ動画/スクリーンショット]

## セットアップ
\`\`\`bash
npm install
npm run dev
\`\`\`

## 環境変数
\`\`\`
DATABASE_URL=...
NEXT_PUBLIC_LIFF_ID=...
\`\`\`

## 工夫した点
- LINEミニアプリ最適化（タップ対応、Safe Area）
- データベース統合で複数ユーザー対応
- ルールベースAIでコスト削減

## 今後の改善点
- テストカバレッジ向上
- パフォーマンス最適化