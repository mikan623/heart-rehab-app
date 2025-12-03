# ローカル環境でのLINE連携セットアップガイド

このガイドでは、ローカル環境でメールログイン後のLINE連携機能をテストする方法を説明します。

## 📋 前提条件

- Node.js がインストール済み
- ローカルでアプリが実行中 (`npm run dev`)
- LINE Developers アカウント
- LINE LIFF の設定済み

## 🔧 ローカル環境でのLINE連携テスト手順

### 1. LINE Developers コンソールの設定

LINE Developers コンソールで以下を確認してください：

**LIFF 設定:**
- **LIFF ID:** `.env.local` に保存
- **Endpoint URL (ローカル):** 
  ```
  http://localhost:3000
  ```
  
  **本番:**
  ```
  https://your-production-domain.com
  ```

### 2. .env.local ファイルの設定

プロジェクトルートに `.env.local` を作成（またはすでに存在する場合は確認）:

```env
NEXT_PUBLIC_LIFF_ID=your_liff_id_here
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**環境変数の説明:**
- `NEXT_PUBLIC_LIFF_ID`: LINE Developer Console から取得した LIFF ID
- `NEXT_PUBLIC_API_URL`: ローカル環境のベース URL

### 3. ローカルサーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスしてください。

### 4. テスト手順

#### 4.1 メールでログイン

1. **ホームページ** (`/`) から「メール でログイン」ボタンをクリック
2. テストメールアドレスとパスワードでログイン
   - 例: `test@example.com` / `password123`
3. ログイン成功後、健康記録ページにリダイレクト

#### 4.2 プロフィール画面でLINE連携

1. ナビゲーションバーから「プロフィール設定」を選択
2. 「🔗 LINE連携」セクションが表示される ✅
3. **「LINEと連携する」ボタン** をクリック
4. LINE ログイン画面にリダイレクト
5. LINE アカウントでログイン
6. 認可画面で許可を選択
7. プロフィール画面に戻ると、LINE ユーザー名が自動入力される ✅

### 5. 動作確認ポイント

- [ ] メールでログイン後、プロフィール画面を開く
- [ ] LINE連携セクションが表示される
- [ ] 「LINEと連携する」ボタンが クリック可能
- [ ] LINE ログイン後、ユーザー名が自動入力される
- [ ] LINE プロフィール画像が表示される（LINE ログインユーザーの場合）
- [ ] 保存ボタンでプロフィール情報がデータベースに保存される

## 🐛 トラブルシューティング

### LIFF 初期化エラーが出る場合

**原因:** LIFF ID が正しく設定されていない

**解決方法:**
```bash
# コンソールを確認
echo $NEXT_PUBLIC_LIFF_ID

# または .env.local を確認
cat .env.local | grep LIFF
```

### LINE ログインボタンがクリックできない場合

**原因:** LIFF が初期化されていない

**対処:**
1. ブラウザの開発者ツール (F12) を開く
2. Console タブを確認
3. LIFF 関連のエラーメッセージを確認
4. LINE Developers コンソールで Endpoint URL を確認

### localhost でLINEリダイレクトが機能しない場合

**原因:** LINE Developers コンソールの設定が不足している

**解決方法:**
1. LINE Developers コンソールにアクセス
2. LIFF の設定で以下を追加:
   ```
   Endpoint URL: http://localhost:3000
   ```
3. 同じブラウザウィンドウで再度テスト

### プロフィール画像が表示されない場合

**原因:** LINE ユーザーのプロフィール画像がない、または CORS エラー

**対処:**
1. LINE のプロフィール設定で画像を設定
2. ブラウザの開発者ツールで CORS エラーを確認
3. 別の LINE アカウントでテスト

## 📱 ローカルでのブラウザテストのコツ

### iOS/Android での確認

LINE アプリ内（LIFF）での動作確認は、実際のスマートフォンが必要です。

**iPhone での確認方法:**
1. `http://localhost:3000` → LINE アプリで開く（QR コードなど）
2. または LINE Official Account のメニューからアクセス

## 🔐 セキュリティ上の注意

- `.env.local` は **絶対に Git にコミットしない**
- LIFF ID とシークレットを共有しない
- ローカル開発時でもパスワードは安全に管理する

## 📚 参考リンク

- [LINE Developers](https://developers.line.biz/ja/)
- [LIFF ドキュメント](https://developers.line.biz/ja/docs/liff/)
- [Next.js 環境変数](https://nextjs.org/docs/basic-features/environment-variables)

## ✅ 実装完了チェックリスト

実装完了後に確認してください:

- [x] プロフィール画面にLINE連携セクションを追加
- [x] メールログインユーザーも LIFF 初期化可能
- [x] LINE 連携ボタンで LINE ログイン画面に遷移
- [x] LINE ログイン後、プロフィール情報を自動入力
- [x] LINE プロフィール画像を表示
- [x] ローカル環境でのテストドキュメント作成

---

**最後に:** ローカル環境でのテストが完了したら、本番環境の Endpoint URL と環境変数を確認してください！

