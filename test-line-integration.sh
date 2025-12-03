#!/bin/bash

# ローカル環境でのLINE連携テストスクリプト

echo "🔍 LINE連携実装のチェック..."
echo ""

# 1. プロフィール画面にLINE連携セクションが追加されたか確認
echo "✅ LINE連携ボタン実装確認:"
if grep -q "LINEと連携する" src/app/profile/page.tsx; then
  echo "  ✓ LINE連携ボタンテキストが見つかりました"
else
  echo "  ✗ LINE連携ボタンテキストが見つかりません"
fi

# 2. LINE連携ハンドラが実装されたか確認
echo ""
echo "✅ LINE連携ハンドラ実装確認:"
if grep -q "handleLineConnection" src/app/profile/page.tsx; then
  echo "  ✓ handleLineConnection 関数が実装されています"
else
  echo "  ✗ handleLineConnection 関数が見つかりません"
fi

# 3. メールログインユーザー向けLIFF初期化が実装されたか確認
echo ""
echo "✅ メールログインユーザー向けLIFF初期化確認:"
if grep -q "メールログインユーザー: プロフィール初期化" src/app/profile/page.tsx; then
  echo "  ✓ メールログインユーザー向けLIFF初期化が実装されています"
else
  echo "  ✗ メールログインユーザー向けLIFF初期化が見つかりません"
fi

# 4. LINE連携済みセクションが実装されたか確認
echo ""
echo "✅ LINE連携済みセクション実装確認:"
if grep -q "LINE連携完了" src/app/profile/page.tsx; then
  echo "  ✓ LINE連携完了セクションが実装されています"
else
  echo "  ✗ LINE連携完了セクションが見つかりません"
fi

# 5. 環境設定ガイドが作成されたか確認
echo ""
echo "✅ セットアップガイド確認:"
if [ -f "LINE_LOCAL_SETUP.md" ]; then
  echo "  ✓ LINE_LOCAL_SETUP.md が作成されています"
else
  echo "  ✗ LINE_LOCAL_SETUP.md が見つかりません"
fi

echo ""
echo "🎉 チェック完了！"
echo ""
echo "📝 次のステップ:"
echo "  1. npm run dev でローカルサーバーを起動"
echo "  2. http://localhost:3000 でメールログイン"
echo "  3. プロフィール画面でLINE連携を確認"
echo "  4. LINE_LOCAL_SETUP.md を参照してテスト手順を確認"

