import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature') || '';
    
    // LINE Signature 検証
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret) {
      console.error('❌ LINE_CHANNEL_SECRET is not set');
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const hash = crypto
      .createHmac('sha256', channelSecret)
      .update(body)
      .digest('base64');

    if (signature !== hash) {
      console.error('❌ Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log('✅ LINE Webhook received');

    const events = JSON.parse(body).events;
    
    for (const event of events) {
      console.log('📨 Event type:', event.type);
      
      // メッセージ受信イベント
      if (event.type === 'message' && event.message.type === 'text') {
        console.log('💬 Message:', event.message.text);
        console.log('👤 From user:', event.source.userId);
      }
      
      // Friend追加イベント
      if (event.type === 'follow') {
        console.log('👋 User followed:', event.source.userId);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

