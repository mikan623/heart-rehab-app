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

    // ロールはDB側の値を優先（初回だけ選択ロールを反映）
    // ※ role を使ってユーザーが勝手に医療従事者へ昇格できないようにするため
    let effectiveRole = user.role || 'patient';
    if ((effectiveRole === 'patient' || effectiveRole === 'medical') === false) {
      effectiveRole = 'patient';
    }
    const requestedRole = role === 'medical' ? 'medical' : role === 'patient' ? 'patient' : null;
    if (requestedRole && (!user.role || user.role === 'patient') && requestedRole === 'medical' && user.role !== 'medical') {
      // 既にpatientのユーザーをmedicalに勝手に変更しない
    } else if (requestedRole && !user.role) {
      // roleカラム導入直後などで未設定の場合は初回だけ保存
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

