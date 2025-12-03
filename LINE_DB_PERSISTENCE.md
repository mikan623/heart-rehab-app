# LINE ログイン状態を Supabase に保存

## 📋 実装内容

LINE ログイン状態を **Supabase（PostgreSQL）に永続保存** するようにしました。これにより、ブラウザをリロードしても LINE ログイン状態が保持されます。

## ✅ 実装完了項目

### 1️⃣ **Prisma スキーマ更新** (`prisma/schema.prisma`)

`User` モデルに 2 つのフィールドを追加：

```prisma
model User {
  // ...既存フィールド...
  lineConnected  Boolean  @default(false)  // LINE 連携状態
  lineUserId     String?  @unique          // LINE ユーザーID
  // ...
}
```

### 2️⃣ **API ルート作成** (`src/app/api/auth/line-connection/route.ts`)

#### GET: LINE 連携状態を取得
```bash
GET /api/auth/line-connection?userId=Ub49g621654821591eb1aeb0825a01425

Response:
{
  "lineConnected": true,
  "lineUserId": "Ub49g621654821591eb1aeb0825a01425"
}
```

#### POST: LINE 連携状態を保存
```bash
POST /api/auth/line-connection

Body:
{
  "userId": "Ub49g621654821591eb1aeb0825a01425",
  "lineConnected": true,
  "lineUserId": "Ub49g621654821591eb1aeb0825a01425"
}

Response:
{
  "success": true,
  "user": {
    "id": "Ub49g621654821591eb1aeb0825a01425",
    "lineConnected": true,
    "lineUserId": "Ub49g621654821591eb1aeb0825a01425"
  }
}
```

### 3️⃣ **認証ユーティリティ更新** (`src/lib/auth.ts`)

**新規関数：**

#### `setLineLoggedInDB(userId, isLoggedIn, lineUserId)`
LINE ログイン状態を Supabase に保存
```typescript
await setLineLoggedInDB(profile.userId, true, profile.userId);
```

#### `getLineLoggedInDB(userId)`
LINE ログイン状態を Supabase から取得
```typescript
const isConnected = await getLineLoggedInDB(userId);
```

**既存関数の改善：**

#### `isLineLoggedIn()`
1. ローカルストレージから確認（キャッシュ）
2. LIFF から確認
3. → ページ移動時のロード失敗を防止

### 4️⃣ **フロントエンド更新** (全ページ)

LINE ログイン成功後に Supabase に保存：

```typescript
// LINE ログイン成功時
if (window.liff.isLoggedIn()) {
  const profile = await window.liff.getProfile();
  
  // 🆕 Supabase に保存
  await setLineLoggedInDB(profile.userId, true, profile.userId);
  console.log('✅ LINE ログイン状態を Supabase に保存');
}
```

更新ページ：
- `src/app/health-records/page.tsx`
- `src/app/calendar/page.tsx`
- `src/app/graph/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/family/page.tsx`

## 🚀 デプロイ手順

### Step 1: データベースマイグレーション

```bash
# マイグレーション実行
npx prisma migrate dev --name add_line_connection_status

# または、スキーマを直接適用
npx prisma db push
```

**SQL（直接実行の場合）:**
```sql
ALTER TABLE "users" ADD COLUMN "lineConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "lineUserId" TEXT UNIQUE;
```

### Step 2: Prisma クライアント再生成

```bash
npx prisma generate
```

### Step 3: ローカル環境で動作確認

```bash
npm run dev
```

1. LINE でログイン
2. コンソール確認：
   ```
   ✅ LINE ログイン状態を Supabase に保存
   ```
3. ブラウザをリロード
4. 他のページをクリック（ページ遷移が機能すること）

## 📊 データベーススキーマ

### users テーブル（更新後）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | STRING | ユーザーID（メール or LINE ID） |
| email | STRING | メールアドレス |
| name | STRING? | ユーザー名 |
| password | STRING? | パスワード（ハッシュ化） |
| authType | STRING | ログイン方法（"line" or "email"） |
| **lineConnected** | **BOOLEAN** | 🆕 LINE 連携状態 |
| **lineUserId** | **STRING?** | 🆕 LINE ユーザーID |
| createdAt | DATETIME | 作成日 |
| updatedAt | DATETIME | 更新日 |

## 🔄 動作フロー

```
【LINE ログイン時】
  ① LINE ログイン成功
  ② profile を取得
  ③ setLineLoggedInDB() を呼び出し
     ├─ API に POST リクエスト
     ├─ Supabase に保存
     └─ ローカルストレージにも保存（キャッシュ）

【ページ遷移時】
  ① 他のページをクリック
  ② isLineLoggedIn() を確認
  ③ ローカルストレージから確認 ✅ キャッシュ
  ④ LIFF 初期化なしでも判定可能
  ⑤ ページ遷移成功

【ブラウザリロード後】
  ① localStorage から確認 ✅
  ② LIFF 初期化前に判定可能
  ③ ページ遷移がスムーズ
```

## 🎯 利点

✅ **永続性**: ブラウザ再起動後も LINE ログイン状態が保持  
✅ **高速**: ローカルストレージキャッシュで LIFF 初期化不要  
✅ **信頼性**: Supabase に記録され、複数デバイス間で同期可能  
✅ **スケーラブル**: ユーザー情報とともに管理可能  

## 🔐 セキュリティ

- LINE ユーザーID は一意制約（`@unique`）で重複防止
- ログイン状態はブール値（true/false）のみ保存
- API は POST リクエストで保存、GET で取得
- フロント側はローカルストレージ + Supabase の二重管理

## 📝 トラブルシューティング

### マイグレーション実行時にエラーが出る場合

```bash
# Prisma スキーマをデータベースに直接適用
npx prisma db push --force-reset

# または、マイグレーション履歴をリセット
npx prisma migrate reset
```

### LINE ログイン状態が保存されない場合

1. コンソール確認:
   ```
   ✅ LINE ログイン状態を Supabase に保存
   ```

2. API が正常に動作しているか確認:
   ```javascript
   // ブラウザコンソール
   await fetch('/api/auth/line-connection?userId=YOUR_USER_ID')
     .then(r => r.json())
     .then(console.log)
   ```

3. Supabase Dashboard でユーザーテーブルを確認

---

**実装完了日**: 2024年12月

