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
        
        // 「健康記録」というキーワードを受け取ったら返信
        if (event.message.text.includes('健康記録')) {
          const replyMessage = `✅ 健康記録を受け取りました！\n\n今日も記録をありがとうございます。\n心臓ちゃんが応援しています💖`;
          
          try {
            const replyResponse = await fetch('/api/line/reply-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                replyToken: event.replyToken,
                message: replyMessage,
              }),
            });
            
            if (replyResponse.ok) {
              console.log('✅ Webhook 返信送信成功');
            } else {
              console.error('❌ Webhook 返信送信失敗');
            }
          } catch (error) {
            console.error('❌ Webhook 返信エラー:', error);
          }
        }
      }
      
      // Friend追加イベント
      if (event.type === 'follow') {
        console.log('👋 User followed:', event.source.userId);
        
        // Friend追加時に挨拶メッセージを返信
        const welcomeMessage = `👋 心臓リハビリ手帳へようこそ！\n\n健康記録の入力をサポートします。\n毎日の血圧、脈拍、体重を記録して、一緒に健康管理を頑張りましょう💖`;
        
        try {
          const replyResponse = await fetch('/api/line/reply-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              replyToken: event.replyToken,
              message: welcomeMessage,
            }),
          });
          
          if (replyResponse.ok) {
            console.log('✅ Welcome メッセージ送信成功');
          } else {
            console.error('❌ Welcome メッセージ送信失敗');
          }
        } catch (error) {
          console.error('❌ Welcome メッセージエラー:', error);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

