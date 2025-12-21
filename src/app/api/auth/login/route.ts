import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { email, password, role } = await request.json();

    // バリデーション
    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードが必要です' },
        { status: 400 }
      );
    }

    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // authType チェック（メール登録ユーザーのみ）
    if (user.authType !== 'email') {
      return NextResponse.json(
        { error: 'このアカウントは LINE ログインで作成されています。LINE でログインしてください' },
        { status: 401 }
      );
    }

    // パスワードが設定されているかチェック
    if (!user.password) {
      return NextResponse.json(
        { error: 'このアカウントではパスワードが設定されていません' },
        { status: 401 }
      );
    }

    // パスワードを検証
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'メールアドレスまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    // ローカルストレージに保存するセッション情報
    const sessionToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    // ロールは「トップで選択した値」をSupabaseへ保存して永続化する
    // （患者/医療の切り替えが要件のため、ログイン成功時にDBを更新する）
    const requestedRole = role === 'medical' ? 'medical' : role === 'patient' ? 'patient' : null;
    let effectiveRole: 'patient' | 'medical' = user.role === 'medical' ? 'medical' : 'patient';
    if (requestedRole && requestedRole !== effectiveRole) {
      await prisma.user.update({ where: { id: user.id }, data: { role: requestedRole } });
      effectiveRole = requestedRole;
    }

    return NextResponse.json(
      {
        message: 'ログインに成功しました',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          authType: user.authType,
          role: effectiveRole,
        },
        sessionToken,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('ログインエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

