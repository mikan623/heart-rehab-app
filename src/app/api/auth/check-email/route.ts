import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Prisma接続を確保
    await ensurePrismaConnection();

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // ユーザーがメールアドレスで登録されているか確認
    const user = await prisma?.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json({ error: 'このメールアドレスは登録されていません' }, { status: 404 });
    }

    if (user.authType !== 'email') {
      return NextResponse.json({ error: 'このメールアドレスはメールログインで登録されていません' }, { status: 400 });
    }

    return NextResponse.json({ message: 'Email verified' }, { status: 200 });

  } catch (error) {
    console.error('Email check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

