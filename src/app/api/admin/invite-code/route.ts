import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { secret, expiresInDays = 7 } = await request.json();

  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 });
  }

  if (!prisma) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  const code = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const inviteCode = await prisma.medicalInviteCode.create({
    data: { code, expiresAt },
  });

  return NextResponse.json({ code: inviteCode.code, expiresAt: inviteCode.expiresAt });
}
