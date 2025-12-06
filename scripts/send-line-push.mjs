// 簡易テスト用スクリプト
// 使い方:
//   node --env-file=.env.local scripts/send-line-push.mjs <LINE_USER_ID> "送信したいメッセージ"
//
// 前提:
//   - Node.js 18 以上（グローバル fetch 対応）
//   - .env / .env.local などに LINE_CHANNEL_ACCESS_TOKEN が設定されていること

const userId = process.argv[2];
const text = process.argv[3] || 'テストメッセージです';

if (!userId) {
  console.error('使い方: node scripts/send-line-push.mjs <LINE_USER_ID> "メッセージ"');
  process.exit(1);
}

const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!accessToken) {
  console.error('環境変数 LINE_CHANNEL_ACCESS_TOKEN が設定されていません (.env / .env.local を確認してください)');
  process.exit(1);
}

const body = {
  to: userId,
  messages: [
    {
      type: 'text',
      text,
    },
  ],
};

async function main() {
  console.log('📱 LINE Push 送信リクエスト:', { to: userId, text });

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const resText = await res.text();
  console.log('ステータス:', res.status, res.statusText);
  console.log('レスポンスボディ:', resText);
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});

