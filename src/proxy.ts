import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = new Set([
  // 認証系（ログイン前に必要）
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/check-email',
  '/api/auth/reset-password',
  '/api/auth/line-user-setup',
  // LINE Webhook / 返信（署名・内部シークレットで保護）
  '/api/line/webhook',
  '/api/line/reply-message',
  // 招待リンク・問い合わせ（ログイン前に利用）
  '/api/family-invites',
  '/api/contact',
  // ヘルスチェック
  '/api/test',
  // Cron実行（トークン必須）
  '/api/reminder-runner',
  '/api/reminder-send',
]);

const AUTH_COOKIE_NAME = 'auth_token';

function base64UrlToUint8Array(input: string): Uint8Array {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlToString(input: string): string {
  const bytes = base64UrlToUint8Array(input);
  return new TextDecoder().decode(bytes);
}

async function verifyJwt(token: string, secret: string) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = base64UrlToUint8Array(signatureB64);
  const signature = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(signingInput)
  );

  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlToString(payloadB64));
    const exp = typeof payload.exp === 'number' ? payload.exp : null;
    if (exp && Math.floor(Date.now() / 1000) > exp) return null;

    if (typeof payload?.sub === 'string' && (payload.role === 'patient' || payload.role === 'medical')) {
      return { userId: payload.sub, role: payload.role };
    }
  } catch {
    return null;
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'JWT secret missing' }, { status: 500 });
  }

  const bearer = request.headers.get('authorization');
  const token =
    (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length).trim() : null) ||
    request.cookies.get(AUTH_COOKIE_NAME)?.value ||
    null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyJwt(token, secret);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headers = new Headers(request.headers);
  headers.set('x-auth-user-id', payload.userId);
  headers.set('x-auth-role', payload.role);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/api/:path*'],
};
