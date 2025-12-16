import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

/**
 * LINE ログイン時にユーザー情報をセットアップ
 * POST /api/auth/line-user-setup
 * Body: { userId, displayName, email }
 */
export async function POST(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { userId, displayName, email } = await request.json();
    
    console.log('💾 LINE ユーザーセットアップ:', { userId, displayName, email });
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // ユーザーが存在するかチェック
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('👤 Creating new LINE user:', userId);
      // 新規ユーザーの場合は作成（authType は "line" がデフォルト）
      user = await prisma.user.create({
        data: {
          id: userId,
          email: email || `${userId}@line.local`,
          name: displayName || 'User',
          authType: 'line'  // LINE ログイン初回時は authType = "line"
        }
      });
      console.log('✅ LINE ユーザーを作成:', user.id);
    } else {
      // 既存ユーザーの場合は、メールアドレスを更新（authType は更新しない）
      console.log('🔄 既存ユーザー更新:', userId);
      
      // メールアドレスが未設定の場合のみ更新
      if (!user.email || user.email.includes('@line.local') || user.email.includes('@example.com')) {
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            email: email || user.email,
            name: displayName || user.name,
            // ⚠️ authType は変更しない（既存の認証タイプを保持）
          }
        });
        console.log('✅ 既存ユーザーを更新:', user.id);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authType: user.authType
      }
    });
    
  } catch (error: any) {
    console.error('❌ LINE ユーザーセットアップエラー:', error);
    return NextResponse.json({ 
      error: 'Failed to setup LINE user',
      details: error.message,
      success: false
    }, { status: 500 });
  }
}

