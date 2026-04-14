import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const TOKEN_TTL_SECONDS = 60 * 15; // 15 minutes

function generateToken(): string {
  // Node.js 20+ supports base64url encoding
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token: string): string {
  const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER;
  if (pepper) {
    return crypto.createHmac('sha256', pepper).update(token).digest('hex');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    // レート制限: IP ごとに 15 分間で 3 回まで（メール爆撃対策）
    const ip = getClientIp(request);
    const { allowed, remaining, resetAt } = checkRateLimit(`reset-password:${ip}`, {
      limit: 3,
      windowSeconds: 15 * 60,
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

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { email } = (await request.json()) as { email?: unknown };
    const emailStr = typeof email === 'string' ? email.trim() : '';
    if (!emailStr) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // ユーザーの存在はレスポンスから推測できないようにする（email enumeration 対策）
    const genericOk = NextResponse.json(
      { message: 'If the email exists, a reset link has been sent.' },
      { status: 200 }
    );

    const user = await prisma.user.findUnique({ where: { email: emailStr } });
    if (!user) {
      return genericOk;
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

    // 既存の未使用トークンは無効化（多重発行の整理）
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = process.env.APP_BASE_URL ?? request.nextUrl.origin;
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await sendPasswordResetEmail({ to: emailStr, resetUrl });

    return genericOk;
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

