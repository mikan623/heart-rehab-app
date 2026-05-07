import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { adminInviteCodeSchema, parseBody } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, adminInviteCodeSchema);
  if (parsed.error) return parsed.error;
  const { secret, expiresInDays } = parsed.data;

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
