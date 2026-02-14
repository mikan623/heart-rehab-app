import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const internalSecret = process.env.LINE_CHANNEL_SECRET;
    const providedSecret = request.headers.get('x-internal-secret');
    if (!internalSecret || providedSecret !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { replyToken, message } = await request.json();

    // サーバーサイド環境変数からアクセストークンを取得
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN is not set' }, { status: 500 });
    }

    // バリデーション
    if (!replyToken || !message) {
      return NextResponse.json({ error: 'replyToken and message are required' }, { status: 400 });
    }

    console.log('📱 LINE Bot Reply メッセージ送信:', { replyToken, message });

    const requestBody = {
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    };

    console.log('📤 LINE Reply API リクエスト:', {
      endpoint: 'https://api.line.me/v2/bot/message/reply',
      method: 'POST',
      body: requestBody,
    });

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      console.log('✅ LINE Reply メッセージ送信成功');
      return NextResponse.json({ success: true });
    } else {
      const errorData = await response.text();
      console.error('❌ LINE Reply API エラー:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      throw new Error(`LINE Reply API request failed: ${response.status} ${errorData}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ LINE Reply API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send reply',
      details: message 
    }, { status: 500 });
  }
}

