import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { email, name, password, role } = await request.json();

    // バリデーション
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'メールアドレス、名前、パスワードが必要です' },
        { status: 400 }
      );
    }

    // パスワードの長さチェック
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'パスワードは6文字以上である必要があります' },
        { status: 400 }
      );
    }

    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 409 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        id: email, // メールアドレスを ID として使用
        email,
        name,
        password: hashedPassword,
        authType: 'email',
        role: role === 'medical' ? 'medical' : 'patient',
      },
    });

    // 初回プロフィールを作成
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: name,
      },
    });

    return NextResponse.json(
      { 
        message: '登録が完了しました',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authType: user.authType,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('登録エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

