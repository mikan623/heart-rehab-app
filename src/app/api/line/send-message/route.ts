import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, message } = await request.json();

    // サーバーサイド環境変数からアクセストークンを取得
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN is not set' }, { status: 500 });
    }

    // バリデーション
    if (!userId || !message) {
      return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
    }

    console.log('📱 LINE Bot メッセージ送信:', { userId, message });

    const requestBody = {
      to: userId,
      messages: [
        {
          type: 'text',
          text: message,
        },
      ],
    };

    console.log('📤 LINE API リクエスト:', {
      endpoint: 'https://api.line.me/v2/bot/message/push',
      method: 'POST',
      body: requestBody,
      token_length: accessToken?.length || 0,
    });

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      console.log('✅ LINE Bot メッセージ送信成功');
      return NextResponse.json({ success: true });
    } else {
      const errorData = await response.text();
      console.error('❌ LINE API エラー:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData
      });
      throw new Error(`LINE API request failed: ${response.status} ${errorData}`);
    }
  } catch (error: any) {
    console.error('❌ LINE API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error?.message 
    }, { status: 500 });
  }
}