import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

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
        const text: string = (event.message.text || '').trim();
        const fromUserId: string | undefined = event.source?.userId;

        console.log('💬 Message:', text);
        console.log('👤 From user:', fromUserId);

        // 1) 家族招待コード / 本人用コードとして処理（英数字を全て大文字にして扱う）
        if (fromUserId) {
          const normalized = text.replace(/\s+/g, '').toUpperCase();

          try {
            const connected = await ensurePrismaConnection();
            if (connected && prisma) {
              // 1-1) 家族用招待コードとして一致するかチェック
              const member = await prisma.familyMember.findFirst({
                where: { linkCode: normalized },
              });

              if (member) {
                console.log('🔗 招待コード一致: familyMember', member.id);

                await prisma.familyMember.update({
                  where: { id: member.id },
                  data: {
                    lineUserId: fromUserId,
                    isRegistered: true,
                  },
                });

                const successMessage =
                  '✅ 家族アカウントの連携が完了しました！\n' +
                  'これ以降、このLINEアカウントにご家族の健康記録が自動で共有されます。';

                try {
                  const replyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.patient-held-diary.org'}/api/line/reply-message`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-internal-secret': channelSecret,
                    },
                    body: JSON.stringify({
                      replyToken: event.replyToken,
                      message: successMessage,
                    }),
                  });

                  if (replyResponse.ok) {
                    console.log('✅ 招待コード連携完了メッセージ送信成功');
                  } else {
                    console.error('❌ 招待コード連携完了メッセージ送信失敗');
                  }
                } catch (error) {
                  console.error('❌ 招待コード連携完了メッセージ送信エラー:', error);
                }

                // 招待コードとして処理できた場合はここで次のイベントへ
                continue;
              }

              // 1-2) 本人用招待コードとして User.selfLinkCode をチェック
              const user = await prisma.user.findFirst({
                where: { selfLinkCode: normalized },
              });

              if (user) {
                console.log('🔗 本人用招待コード一致: user', user.id);

                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    lineUserId: fromUserId,
                    lineConnected: true,
                  },
                });

                const selfSuccessMessage =
                  '✅ 本人アカウントの連携が完了しました！\n' +
                  'これ以降、このLINEアカウントにご自身の健康記録が自動で届きます。';

                try {
                const replyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.patient-held-diary.org'}/api/line/reply-message`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-internal-secret': channelSecret,
                  },
                    body: JSON.stringify({
                      replyToken: event.replyToken,
                      message: selfSuccessMessage,
                    }),
                  });

                  if (replyResponse.ok) {
                    console.log('✅ 本人用連携完了メッセージ送信成功');
                  } else {
                    console.error('❌ 本人用連携完了メッセージ送信失敗');
                  }
                } catch (error) {
                  console.error('❌ 本人用連携完了メッセージ送信エラー:', error);
                }

                // 本人用コードとして処理できた場合もここで次のイベントへ
                continue;
              }
            }
          } catch (error) {
            console.error('❌ 招待コード処理エラー:', error);
          }
        }

        // 2) 「健康記録」というキーワードを受け取ったら返信
        if (text.includes('健康記録')) {
          const replyMessage =
            '✅ 健康記録を受け取りました！\n\n今日も記録をありがとうございます。\n心臓ちゃんが応援しています💖';
          
          try {
          const replyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.patient-held-diary.org'}/api/line/reply-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': channelSecret,
            },
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
        const replyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://app.patient-held-diary.org'}/api/line/reply-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': channelSecret,
          },
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

