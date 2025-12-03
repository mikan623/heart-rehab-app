#!/bin/bash

echo "🔍 家族共有設定の変更確認..."
echo ""

# 1. インターフェースに email フィールドが追加されたか確認
echo "✅ email フィールド追加確認:"
if grep -q "email: string" src/app/family/page.tsx; then
  echo "  ✓ FamilyMember インターフェースに email が追加されました"
else
  echo "  ✗ email フィールドが見つかりません"
fi

# 2. 新規メンバー時のデフォルト値が修正されたか確認
echo ""
echo "✅ デフォルト値修正確認:"
if grep -q "relationship: ''" src/app/family/page.tsx; then
  echo "  ✓ relationship のデフォルト値が空文字に変更されました"
else
  echo "  ✗ relationship のデフォルト値修正が見つかりません"
fi

# 3. メールアドレスフィールドがUIに追加されたか確認
echo ""
echo "✅ メールアドレス入力フィールド確認:"
if grep -q "type=\"email\"" src/app/family/page.tsx; then
  echo "  ✓ メールアドレス入力フィールドが追加されました"
else
  echo "  ✗ メールアドレス入力フィールドが見つかりません"
fi

# 4. バリデーションが修正されたか確認
echo ""
echo "✅ バリデーション修正確認:"
if grep -q "名前とメールアドレスを入力" src/app/family/page.tsx; then
  echo "  ✓ バリデーションメッセージが「名前とメールアドレス」に変更されました"
else
  echo "  ✗ バリデーション修正が見つかりません"
fi

# 5. Prisma スキーマに email が追加されたか確認
echo ""
echo "✅ Prisma スキーマ修正確認:"
if grep -q "email.*String" prisma/schema.prisma; then
  echo "  ✓ FamilyMember モデルに email フィールドが追加されました"
else
  echo "  ✗ Prisma スキーマに email フィールドが見つかりません"
fi

# 6. API ルートが修正されたか確認
echo ""
echo "✅ API ルート修正確認:"
if grep -q "email: familyMember.email" src/app/api/family-members/route.ts; then
  echo "  ✓ API ルートが email を処理するように更新されました"
else
  echo "  ✗ API ルートの修正が見つかりません"
fi

echo ""
echo "🎉 チェック完了！"
echo ""
echo "📝 変更内容まとめ："
echo "  ✓ 配偶者欄がデフォルト値から削除"
echo "  ✓ 関係性が「選択してください」に変更"
echo "  ✓ メールアドレス欄が追加"
echo "  ✓ バリデーションが「名前 + メールアドレス」に変更"
echo ""
echo "🚀 次のステップ:"
echo "  1. データベースマイグレーション: npx prisma migrate dev"
echo "  2. 動作確認: npm run dev で家族共有ページを開く"
echo "  3. 新しい家族メンバーを追加して、メールアドレス欄が表示されることを確認"
