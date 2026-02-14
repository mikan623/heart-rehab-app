import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    await ensurePrismaConnection();

    const { lineUserId, message } = await request.json();

    // サーバーサイド環境変数からアクセストークンを取得
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'LINE_CHANNEL_ACCESS_TOKEN is not set' }, { status: 500 });
    }

    // バリデーション
    if (!lineUserId || !message) {
      return NextResponse.json({ error: 'lineUserId and message are required' }, { status: 400 });
    }

    const familyMember = await prisma.familyMember.findFirst({
      where: {
        userId: auth.userId,
        lineUserId,
        isRegistered: true,
      },
      select: { id: true },
    });

    if (!familyMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('📱 LINE Bot メッセージ送信:', { lineUserId, messageLength: message.length });

    const requestBody = {
      to: lineUserId,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ LINE API Error:', error);
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: message 
    }, { status: 500 });
  }
}