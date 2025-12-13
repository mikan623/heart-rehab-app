import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// ⏰ Vercel Cron から叩かれる想定のエンドポイント
// 例: 毎分 / 毎5分 で実行し、現在時刻(Asia/Tokyo)と一致するユーザーにだけ送信
export async function GET(_request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for reminder-send');
      return NextResponse.json({ success: false, reason: 'Database not available' }, { status: 503 });
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!accessToken) {
      console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN is not set, skip reminder-send');
      return NextResponse.json({ success: false, reason: 'LINE token not set' }, { status: 503 });
    }

    // 現在時刻（Asia/Tokyo）を HH:MM で取得
    const tokyoFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const nowParts = tokyoFormatter.formatToParts(new Date());
    const hour = nowParts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = nowParts.find((p) => p.type === 'minute')?.value ?? '00';
    const currentTime = `${hour}:${minute}`; // 例: "21:00"

    console.log('⏰ Running reminder-send at Asia/Tokyo time:', currentTime);

    // リマインダーが有効で、現在時刻と一致し、lineUserId が登録されているユーザーを取得
    const targetUsers = await prisma.user.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: currentTime,
        lineUserId: { not: null },
      },
      select: {
        id: true,
        lineUserId: true,
      },
    });

    if (!targetUsers.length) {
      console.log('ℹ️ No users to remind at this time.');
      return NextResponse.json({ success: true, sent: 0 });
    }

    const message = [
      '⏰ 今日の健康記録リマインダー',
      '',
      'まだ今日の健康記録を入力していない場合は、アプリを開いて血圧・脈拍・体重を記録してください。',
      '',
      '心臓ちゃんより 💖',
    ].join('\n');

    let successCount = 0;

    for (const user of targetUsers) {
      if (!user.lineUserId) continue;

      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            to: user.lineUserId,
            messages: [{ type: 'text', text: message }],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('❌ Reminder push failed:', {
            status: res.status,
            body: text,
            userId: user.id,
          });
        } else {
          console.log('✅ Reminder push success for user:', user.id);
          successCount += 1;
        }
      } catch (error) {
        console.error('❌ Reminder push error for user:', user.id, error);
      }
    }

    return NextResponse.json({ success: true, sent: successCount });
  } catch (error: any) {
    console.error('❌ reminder-send error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 },
    );
  }
}




