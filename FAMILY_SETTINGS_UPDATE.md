# 家族共有設定の更新 - 配偶者欄削除＆メールアドレス追加

## 📋 変更内容

家族共有設定ページで、配偶者欄のデフォルト値を削除し、**名前とメールアドレスが取得できるように変更**しました。

## ✅ 実装内容

### 1. フロントエンド (`src/app/family/page.tsx`)

#### 変更点:

✅ **FamilyMember インターフェースに `email` フィールドを追加**
```typescript
interface FamilyMember {
  id: string;
  name: string;
  email: string;  // 🆕 追加
  relationship: string;
  lineUserId?: string;
  isRegistered: boolean;
}
```

✅ **新規メンバー追加時のデフォルト値を変更**
```typescript
// 変更前
const newMember: FamilyMember = {
  id: Date.now().toString(),
  name: '',
  relationship: '配偶者',  // ❌ デフォルト値があった
  isRegistered: false
};

// 変更後
const newMember: FamilyMember = {
  id: Date.now().toString(),
  name: '',
  email: '',  // 🆕 メールアドレスを追加
  relationship: '',  // 空文字に変更
  isRegistered: false
};
```

✅ **バリデーション修正**
```typescript
// 変更前
if (!member.name || !member.relationship) {
  alert('名前と関係性を入力してください');
}

// 変更後
if (!member.name || !member.email) {
  alert('名前とメールアドレスを入力してください');
}
```

✅ **UI にメールアドレス入力フィールドを追加**
```jsx
{/* メールアドレス */}
<div className="mb-4">
  <label className="block text-lg font-semibold text-gray-700 mb-2">
    メールアドレス
  </label>
  <input
    type="email"
    value={member.email}
    onChange={(e) => updateFamilyMember(member.id, 'email', e.target.value)}
    className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
    placeholder="example@email.com"
  />
</div>
```

✅ **関係性セクターの `<option>` に「選択してください」を追加**
```jsx
<select value={member.relationship} ...>
  <option value="">選択してください</option>  // 🆕 デフォルトオプション
  <option value="配偶者">配偶者</option>
  {/* ... */}
</select>
```

✅ **API リクエストに `email` を追加**
```typescript
// PATCH リクエストに email を含める
body: JSON.stringify({
  memberId: id,
  name: member.name,
  email: member.email,  // 🆕 追加
  relationship: member.relationship,
  lineUserId: member.lineUserId,
  isRegistered: member.isRegistered
})
```

### 2. バックエンド (`src/app/api/family-members/route.ts`)

✅ **家族メンバー作成時に `email` を処理**
```typescript
const savedFamilyMember = await prisma.familyMember.create({
  data: {
    userId,
    name: familyMember.name || '',
    email: familyMember.email || '',  // 🆕 追加
    relationship: familyMember.relationship || '',
    lineUserId: familyMember.lineUserId || null,
    isRegistered: familyMember.isRegistered || false,
  }
});
```

### 3. データベーススキーマ (`prisma/schema.prisma`)

✅ **FamilyMember モデルに `email` フィールドを追加**
```prisma
model FamilyMember {
  id           String   @id @default(cuid())
  userId       String
  name         String
  email        String   // 🆕 メールアドレス
  relationship String
  lineUserId   String?
  isRegistered Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("family_members")
}
```

## 🚀 デプロイ手順

### Step 1: データベースマイグレーション

```bash
npx prisma migrate dev --name add_email_to_family_members
```

### Step 2: ローカルで動作確認

```bash
npm run dev
```

ブラウザで `http://localhost:3000/family` にアクセス

### Step 3: 動作確認チェック

- [ ] 家族共有ページを開く
- [ ] 「➕ 追加」ボタンで新規メンバーを追加
- [ ] 以下のフィールドが表示される:
  - [x] 名前（必須）
  - [x] メールアドレス（必須）← 🆕 新規
  - [x] 関係性（選択「選択してください」）← 変更
  - [x] LINE User ID（オプション）
- [ ] 名前とメールアドレスを入力 → 「💾 保存」ボタンが有効化される
- [ ] メールアドレス入力なし → 保存ボタンが無効化される
- [ ] 保存してデータベースに反映される

## 📊 変更前後の比較

### 変更前（配偶者欄がデフォルト）
```
新規メンバー追加
  ├─ 関係性: 配偶者 ← デフォルト値
  ├─ 名前: ___________
  ├─ LINE User ID: ___________
  └─ ボタン: [保存] [LINEで招待]
```

### 変更後（メールアドレス必須）
```
新規メンバー追加
  ├─ 名前: ___________ ← 必須
  ├─ メールアドレス: ___________ ← 🆕 必須
  ├─ 関係性: [選択してください] ← 変更
  ├─ LINE User ID: ___________
  └─ ボタン: [保存] [LINEで招待]
```

## 🎯 使用例

### 家族メンバーを追加する流れ

1. **家族共有ページを開く**
   ```
   ナビゲーション → 家族共有
   ```

2. **「➕ 追加」ボタンをクリック**
   ```
   新しい入力フォームが表示される
   ```

3. **情報を入力**
   ```
   名前: 山田太郎
   メールアドレス: yamada.taro@example.com
   関係性: 配偶者（プルダウンから選択）
   LINE User ID: U1234567890abcdef...（オプション）
   ```

4. **「💾 保存」をクリック**
   ```
   データベースに保存される
   ```

5. **「🤝 LINEで招待」をクリック**
   ```
   LINE で家族に招待メッセージを送信
   ```

## 📝 ファイル修正一覧

| ファイル | 変更内容 | ステータス |
|---------|---------|----------|
| `src/app/family/page.tsx` | FamilyMember に email 追加、UI 修正 | ✅ 完了 |
| `src/app/api/family-members/route.ts` | API で email 処理 | ✅ 完了 |
| `prisma/schema.prisma` | FamilyMember に email フィールド追加 | ✅ 完了 |

## 🔄 マイグレーション方法

### 既存のデータがある場合

```bash
# マイグレーションを作成・適用
npx prisma migrate dev --name add_email_to_family_members

# 既存データに email フィールドを追加（空文字）
# Prisma が自動的に処理します
```

### 確認コマンド

```bash
# スキーマの確認
npx prisma db push

# 生成されたクライアントの確認
ls -la prisma/generated/
```

## ✅ チェックリスト

デプロイ前に以下を確認してください:

- [ ] `npx prisma migrate dev` でマイグレーション実行
- [ ] `npm run dev` で動作確認
- [ ] 新規メンバー追加時にメールアドレス欄が表示される
- [ ] 名前とメールアドレスが入力されると「保存」ボタンが有効化
- [ ] メールアドレス入力なしではボタンが無効化
- [ ] データベースに正しく保存される
- [ ] ブラウザコンソールにエラーがない

## 🆘 トラブルシューティング

### マイグレーション失敗時
```bash
# Prisma キャッシュをクリア
rm -rf prisma/migrations/.dev_state
npx prisma migrate dev --name add_email_to_family_members
```

### 型エラーが出る場合
```bash
# Prisma クライアントを再生成
npx prisma generate
npm run dev
```

---

**完了日:** 2024年12月
**変更者:** AI Assistant

