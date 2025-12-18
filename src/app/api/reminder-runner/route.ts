import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// ⏰ 記録忘れリマインダー実行用エンドポイント
// - Vercel のスケジュール機能などから 1日1回たたく想定
// - ユーザーごとの reminderEnabled / reminderTime を見て、
//   ・今日まだ健康記録が1件もない
//   ・現在時刻（JST）が reminderTime と一致
//   している人にだけ LINE でリマインドを送る

export async function GET(request: NextRequest) {
  try {
    // 任意: 簡易なトークンチェック（Vercel の Cron から呼ぶときに ?token=... を付ける想定）
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const secret = process.env.REMINDER_CRON_SECRET;
    if (secret && token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for reminder runner');
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 503 }
      );
    }

    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.warn('⚠️ LINE_CHANNEL_ACCESS_TOKEN is not set, skipping reminders');
      return NextResponse.json(
        { error: 'LINE not configured' },
        { status: 500 }
      );
    }

    // 現在時刻（JST）を取得
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayStr = `${jst.getFullYear()}-${pad(jst.getMonth() + 1)}-${pad(
      jst.getDate()
    )}`;
    const currentTimeStr = `${pad(jst.getHours())}:${pad(jst.getMinutes())}`;

    console.log('⏰ Reminder runner started', {
      todayStr,
      currentTimeStr,
    });

    // その時間にリマインド対象となるユーザーを取得
    const users = await prisma.user.findMany({
      where: {
        reminderEnabled: true,
        reminderTime: currentTimeStr, // JST ベース
      },
      select: {
        id: true,
        lineUserId: true,
      },
    });

    if (!users.length) {
      console.log('ℹ️ No users matched reminder time');
      return NextResponse.json({ ok: true, sent: 0, matchedUsers: 0 });
    }

    let sentCount = 0;

    for (const user of users) {
      // 今日の健康記録が1件でもあればスキップ
      const recordsCount = await prisma.healthRecord.count({
        where: {
          userId: user.id,
          date: todayStr,
        },
      });

      if (recordsCount > 0) {
        console.log(
          `✅ User ${user.id} already has ${recordsCount} records today, skip reminder`
        );
        continue;
      }

      // 家族メンバー（LINE連携済み）を取得
      const familyMembers = await prisma.familyMember.findMany({
        where: {
          userId: user.id,
          lineUserId: { not: null },
          isRegistered: true,
        },
        select: {
          id: true,
          lineUserId: true,
        },
      });

      // 患者プロフィール（名前があればメッセージに入れる）
      const profile = await prisma.profile.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: { displayName: true },
      });

      const namePart = profile?.displayName
        ? `${profile.displayName} さん\n\n`
        : '';

      const message =
        '⏰ 記録忘れリマインダー\n\n' +
        namePart +
        '今日はまだ健康記録が入力されていません。\n' +
        '体調に問題がなければ、血圧・脈拍・体重などをアプリに記録しておきましょう。\n\n' +
        '心臓ちゃんより 💖';

      const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

      // 送信先: 家族 + 本人（連携済みの場合）
      const targets = [
        ...familyMembers
          .map((m) => m.lineUserId)
          .filter((id): id is string => Boolean(id)),
      ];
      if (user.lineUserId) {
        targets.push(user.lineUserId);
      }

      if (!targets.length) {
        console.log(
          `🙅 User ${user.id} has no LINE recipients for reminder, skip`
        );
        continue;
      }

      for (const to of targets) {
        try {
          const body = {
            to,
            messages: [
              {
                type: 'text',
                text: message,
              },
            ],
          };

          const res = await fetch(
            'https://api.line.me/v2/bot/message/push',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(body),
            }
          );

          if (!res.ok) {
            const text = await res.text();
            console.error('❌ Reminder push failed', {
              status: res.status,
              body: text,
            });
          } else {
            sentCount += 1;
            console.log('✅ Reminder sent', { userId: user.id, to });
          }
        } catch (err) {
          console.error('❌ Reminder push error', err);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      matchedUsers: users.length,
      sent: sentCount,
    });
  } catch (error: any) {
    console.error('❌ Reminder runner error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}




