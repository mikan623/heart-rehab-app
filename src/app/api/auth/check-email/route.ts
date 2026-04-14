import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // レート制限: IP ごとに 10 分間で 10 回まで
    const ip = getClientIp(request);
    const { allowed, remaining, resetAt } = checkRateLimit(`check-email:${ip}`, {
      limit: 10,
      windowSeconds: 10 * 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく時間をおいて再試行してください。' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(remaining),
          },
        }
      );
    }

    await ensurePrismaConnection();

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // email enumeration 対策: ユーザーの存在に関わらず同じレスポンスを返す
    const genericOk = NextResponse.json({ message: 'Email verified' }, { status: 200 });

    const user = await prisma?.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // 同一レスポンスを返す（存在しないことを漏らさない）
      return genericOk;
    }

    return genericOk;

  } catch (error) {
    console.error('Email check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
