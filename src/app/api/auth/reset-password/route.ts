import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Prisma接続を確保
    await ensurePrismaConnection();

    const { email, securityAnswer, newPassword } = await request.json();

    // バリデーション
    if (!email || !securityAnswer || !newPassword) {
      return NextResponse.json(
        { error: 'Email, security answer, and password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // ユーザーを検索
    const user = await prisma?.user.findUnique({
      where: { email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // authType に関係なく、メールアドレスで登録されているユーザーならパスワード変更可能にする
    // (LINE連携後に authType が変わる場合も考慮)

    // ⚠️ 注意：本来はセキュリティ質問の答えをハッシュ化して保存・比較する必要があります
    // ここではシンプルな実装のため、部分一致で確認しています
    // セキュリティ質問の答えがプロフィールに保存されていると仮定します
    const profile = await prisma?.profile.findFirst({
      where: { userId: user.id }
    });

    // セキュリティ質問の検証（簡易版）
    // 実装：emergencyContactフィールドを流用してセキュリティ質問の答えを保存
    if (!profile || !profile.emergencyContact) {
      return NextResponse.json(
        { error: 'セキュリティ質問の答えが設定されていません。プロフィールを確認してください' },
        { status: 400 }
      );
    }

    // セキュリティ質問の答えを確認（大文字小文字を区別しない）
    if (profile.emergencyContact.toLowerCase() !== securityAnswer.toLowerCase()) {
      return NextResponse.json(
        { error: 'セキュリティ質問の答えが正しくありません' },
        { status: 401 }
      );
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // パスワードを更新
    await prisma?.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(
      { message: 'Password reset successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

