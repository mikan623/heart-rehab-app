import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 本人用招待コードを生成するヘルパー
function generateSelfLinkCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 読みにくい文字は除外
  let code = '';
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * chars.length);
    code += chars[index];
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for self-link code');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 既にコードがある場合はそれを返す
    if (user.selfLinkCode) {
      return NextResponse.json({ code: user.selfLinkCode });
    }

    // 一意な本人用コードを生成
    let code: string | null = null;
    for (let i = 0; i < 5; i++) {
      const candidate = generateSelfLinkCode(8);
      const exists = await prisma.user.findFirst({
        where: { selfLinkCode: candidate },
      });
      if (!exists) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    user = await prisma.user.update({
      where: { id: userId },
      data: { selfLinkCode: code },
    });

    return NextResponse.json({ code: user.selfLinkCode });
  } catch (error: any) {
    console.error('❌ self-link-code API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 }
    );
  }
}


