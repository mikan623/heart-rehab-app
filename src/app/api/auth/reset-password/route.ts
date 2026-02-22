import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // Prisma接続を確保
    await ensurePrismaConnection();

    const { email, securityAnswer, newPassword } = await request.json();
    const normalizedSecurityAnswer = String(securityAnswer ?? '').trim().toLowerCase();

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

    // プロフィール取得
    const profile = await prisma?.profile.findFirst({
      where: { userId: user.id }
    });

    // 初回パスワード変更（セキュリティ質問未設定）と2回目以降（セキュリティ質問設定済み）を区別
    if (!profile || !profile.securityQuestionAnswer) {
      // ✅ **初回パスワード変更**：セキュリティ質問の回答を保存して進行
      console.log('📝 初回パスワード変更: セキュリティ質問の回答を保存します');
      const hashedSecurityAnswer = await bcrypt.hash(normalizedSecurityAnswer, 10);
      
      // プロフィールが存在しない場合は作成
      if (!profile) {
        await prisma?.profile.create({
          data: {
            userId: user.id,
            securityQuestionAnswer: hashedSecurityAnswer
          }
        });
      } else {
        // プロフィールは存在するが securityQuestionAnswer が未設定の場合は更新
        await prisma?.profile.update({
          where: { id: profile.id },
          data: {
            securityQuestionAnswer: hashedSecurityAnswer
          }
        });
      }
    } else {
      // ✅ **2回目以降のパスワード変更**：保存された回答で検証
      console.log('🔐 2回目以降のパスワード変更: 保存された回答で検証します');

      // セキュリティ質問の答えを確認（大文字小文字を区別しない）
      const stored = profile.securityQuestionAnswer;
      const looksHashed = typeof stored === 'string' && stored.startsWith('$2');
      const answerOk = looksHashed
        ? await bcrypt.compare(normalizedSecurityAnswer, stored)
        : String(stored ?? '').trim().toLowerCase() === normalizedSecurityAnswer;

      if (!answerOk) {
        return NextResponse.json(
          { error: 'セキュリティ質問の答えが正しくありません' },
          { status: 401 }
        );
      }

      // 旧データ（平文）からの自動移行：一致した場合に bcrypt ハッシュへ置換
      if (!looksHashed && profile?.id) {
        try {
          const hashedSecurityAnswer = await bcrypt.hash(normalizedSecurityAnswer, 10);
          await prisma?.profile.update({
            where: { id: profile.id },
            data: { securityQuestionAnswer: hashedSecurityAnswer },
          });
        } catch (migrateError) {
          console.warn('⚠️ securityQuestionAnswer のハッシュ移行に失敗（処理は継続）:', migrateError);
        }
      }
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

