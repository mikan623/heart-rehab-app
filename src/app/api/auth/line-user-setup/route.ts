import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { AuthRole, createAuthToken, isAuthRole, setAuthCookie } from '@/lib/server-auth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const isPrismaMetaError = (value: unknown): value is { code?: string; meta?: { target?: string[] } } =>
  isRecord(value);

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
    
    const body = await request.json();
    const data = isRecord(body) ? body : {};
    const userId = getString(data.userId);
    const displayName = getString(data.displayName);
    const email = getString(data.email);
    const role = data.role;
    const idToken = getString(data.idToken);
    
    console.log('💾 LINE ユーザーセットアップ:', { userId, displayName, email });
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // LINE ID Token を必須にして検証（セキュリティ強化）
    if (!idToken) {
      return NextResponse.json({ error: 'LINE ID token is required' }, { status: 401 });
    }

    let verifiedUserId = userId;
    const lineChannelId = process.env.LINE_LOGIN_CHANNEL_ID || process.env.LINE_CHANNEL_ID;
    if (!lineChannelId) {
      return NextResponse.json({ error: 'LINE_LOGIN_CHANNEL_ID is not set' }, { status: 500 });
    }

      const verifyParams = new URLSearchParams({
        id_token: idToken,
        client_id: lineChannelId,
        user_id: userId, // user_idを指定してトークンの対象ユーザーを厳密に検証
      });

      const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verifyParams,
      });

      if (!verifyRes.ok) {
        const text = await verifyRes.text();
        console.error('❌ LINE ID Token verify failed:', text);
        return NextResponse.json({ error: 'Invalid LINE ID token' }, { status: 401 });
      }

      const verifyData = await verifyRes.json();
      // subが存在しない場合も不正なトークンとして拒否
      if (!verifyData?.sub) {
        return NextResponse.json({ error: 'Invalid LINE ID token: missing sub' }, { status: 401 });
      }
      if (verifyData.sub !== userId) {
        return NextResponse.json({ error: 'LINE user mismatch' }, { status: 401 });
      }
      verifiedUserId = verifyData.sub;
    
    // メールアドレス重複を避ける（LINEログインはメール必須ではない）
    let safeEmail = email;
    if (safeEmail) {
      const existingEmailUser = await prisma.user.findUnique({
        where: { email: safeEmail },
      });
      if (existingEmailUser && existingEmailUser.id !== verifiedUserId) {
        safeEmail = `${verifiedUserId}@line.local`;
      }
    }

    // ユーザーが存在するかチェック
    let user = await prisma.user.findUnique({
      where: { id: verifiedUserId }
    });
    
    if (!user) {
      console.log('👤 Creating new LINE user:', verifiedUserId);
      // 新規ユーザーの場合は作成（authType は "line" がデフォルト）
      const createdRole: AuthRole = isAuthRole(role) ? role : 'patient';
      user = await prisma.user.create({
        data: {
          id: verifiedUserId,
          email: safeEmail || `${verifiedUserId}@line.local`,
          name: displayName || 'User',
          authType: 'line',  // LINE ログイン初回時は authType = "line"
          role: createdRole,
        }
      });
      console.log('✅ LINE ユーザーを作成:', user.id);
    } else {
      // 既存ユーザーの場合は、メールアドレスを更新（authType は更新しない）
      console.log('🔄 既存ユーザー更新:', verifiedUserId);
      
      const shouldUpdateEmail =
        !!safeEmail &&
        (!user.email || user.email.includes('@line.local') || user.email.includes('@example.com'));
      const requestedRole: AuthRole | null = isAuthRole(role) ? role : null;
      const currentRole: AuthRole | null = isAuthRole(user.role) ? user.role : null;
      // 誤操作で medical → patient に降格しない（medical は固定 / upgrade のみ）
      const shouldUpgradeToMedical = requestedRole === 'medical' && currentRole !== 'medical';
      const shouldInitToPatient = !currentRole && requestedRole === 'patient';
      const shouldUpdateRole = shouldUpgradeToMedical || shouldInitToPatient;

      if (shouldUpdateEmail || shouldUpdateRole) {
        try {
          user = await prisma.user.update({
            where: { id: verifiedUserId },
            data: {
              ...(shouldUpdateEmail
                ? {
                    email: safeEmail || user.email,
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
        } catch (err: unknown) {
          // email の一意制約エラー時は email 更新を諦めて継続
          if (isPrismaMetaError(err) && err.code === 'P2002' && Array.isArray(err.meta?.target) && err.meta?.target.includes('email')) {
            user = await prisma.user.update({
              where: { id: verifiedUserId },
              data: {
                ...(shouldUpdateRole
                  ? { role: shouldUpgradeToMedical ? 'medical' : shouldInitToPatient ? 'patient' : requestedRole }
                  : {}),
              },
            });
            console.warn('⚠️ email 重複のため email 更新をスキップ');
          } else {
            throw err;
          }
        }
      }
    }
    
    const sessionToken = createAuthToken({
      userId: user.id,
      role: user.role === 'medical' ? 'medical' : 'patient',
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        authType: user.authType,
        role: isAuthRole(user.role) ? user.role : 'patient',
      },
      sessionToken,
    });
    setAuthCookie(response, sessionToken);
    return response;
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ LINE ユーザーセットアップエラー:', error);
    return NextResponse.json({ 
      error: 'Failed to setup LINE user',
      details: message,
      success: false
    }, { status: 500 });
  }
}

