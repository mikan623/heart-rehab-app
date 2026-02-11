import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { createAuthToken, setAuthCookie } from '@/lib/server-auth';

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
    
    const { userId, displayName, email, role, idToken } = await request.json();
    
    console.log('💾 LINE ユーザーセットアップ:', { userId, displayName, email });
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // LINE ID Token を検証（ある場合のみ）
    let verifiedUserId = userId as string;
    if (idToken) {
      const lineChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
      if (!lineChannelId) {
        return NextResponse.json({ error: 'LINE_LOGIN_CHANNEL_ID is not set' }, { status: 500 });
      }

      const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          id_token: idToken,
          client_id: lineChannelId,
        }),
      });

      if (!verifyRes.ok) {
        const text = await verifyRes.text();
        console.error('❌ LINE ID Token verify failed:', text);
        return NextResponse.json({ error: 'Invalid LINE ID token' }, { status: 401 });
      }

      const verifyData = await verifyRes.json();
      if (verifyData?.sub && verifyData.sub !== userId) {
        return NextResponse.json({ error: 'LINE user mismatch' }, { status: 401 });
      }
      if (verifyData?.sub) verifiedUserId = verifyData.sub;
    }
    
    // ユーザーが存在するかチェック
    let user = await prisma.user.findUnique({
      where: { id: verifiedUserId }
    });
    
    if (!user) {
      console.log('👤 Creating new LINE user:', verifiedUserId);
      // 新規ユーザーの場合は作成（authType は "line" がデフォルト）
      user = await prisma.user.create({
        data: {
          id: verifiedUserId,
          email: email || `${verifiedUserId}@line.local`,
          name: displayName || 'User',
          authType: 'line',  // LINE ログイン初回時は authType = "line"
          role: role === 'medical' ? 'medical' : 'patient',
        }
      });
      console.log('✅ LINE ユーザーを作成:', user.id);
    } else {
      // 既存ユーザーの場合は、メールアドレスを更新（authType は更新しない）
      console.log('🔄 既存ユーザー更新:', verifiedUserId);
      
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
          where: { id: verifiedUserId },
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
    
    const sessionToken = createAuthToken({
      userId: user.id,
      role: (user as any).role === 'medical' ? 'medical' : 'patient',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authType: user.authType,
        role: (user as any).role || 'patient',
      },
      sessionToken,
    });
    setAuthCookie(response, sessionToken);
    return response;
    
  } catch (error: any) {
    console.error('❌ LINE ユーザーセットアップエラー:', error);
    return NextResponse.json({ 
      error: 'Failed to setup LINE user',
      details: error.message,
      success: false
    }, { status: 500 });
  }
}

