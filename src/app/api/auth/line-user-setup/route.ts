import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

/**
 * LINE ログイン時にユーザー情報をセットアップ
 * POST /api/auth/line-user-setup
 * Body: { userId, displayName, email, role }
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
    
    const { userId, displayName, email, role } = await request.json();
    
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
          authType: 'line',  // LINE ログイン初回時は authType = "line"
          role: role === 'medical' ? 'medical' : 'patient',
        }
      });
      console.log('✅ LINE ユーザーを作成:', user.id);
    } else {
      // 既存ユーザーの場合は、メールアドレスを更新（authType は更新しない）
      console.log('🔄 既存ユーザー更新:', userId);
      
      const shouldUpdateEmail =
        !user.email || user.email.includes('@line.local') || user.email.includes('@example.com');
      const requestedRole = role === 'medical' ? 'medical' : role === 'patient' ? 'patient' : null;
      const currentRole = (user as any).role === 'medical' ? 'medical' : (user as any).role === 'patient' ? 'patient' : null;
      // 誤操作で medical → patient に降格しない（medical は固定 / upgrade のみ）
      const shouldUpgradeToMedical = requestedRole === 'medical' && currentRole !== 'medical';
      const shouldInitToPatient = !currentRole && requestedRole === 'patient';
      const shouldUpdateRole = shouldUpgradeToMedical || shouldInitToPatient;

      if (shouldUpdateEmail || shouldUpdateRole) {
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            ...(shouldUpdateEmail
              ? {
                  email: email || user.email,
                  name: displayName || user.name,
                }
              : {}),
            ...(shouldUpdateRole
              ? { role: shouldUpgradeToMedical ? 'medical' : shouldInitToPatient ? 'patient' : requestedRole }
              : {}),
            // ⚠️ authType は変更しない（既存の認証タイプを保持）
          },
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
        authType: user.authType,
        role: (user as any).role || 'patient'
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

