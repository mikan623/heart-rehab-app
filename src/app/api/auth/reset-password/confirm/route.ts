import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

function hashToken(token: string): string {
  const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER;
  if (pepper) {
    return crypto.createHmac('sha256', pepper).update(token).digest('hex');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { token, newPassword } = (await request.json()) as {
      token?: unknown;
      newPassword?: unknown;
    };

    const tokenStr = typeof token === 'string' ? token.trim() : '';
    const newPasswordStr = typeof newPassword === 'string' ? newPassword : '';

    if (!tokenStr || !newPasswordStr) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (newPasswordStr.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(tokenStr);
    const record = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPasswordStr, 10);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashedPassword, updatedAt: now },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null },
      }),
    ]);

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
  } catch (error) {
    console.error('Password reset confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

