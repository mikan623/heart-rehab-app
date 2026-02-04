import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export type AuthRole = 'patient' | 'medical';

export interface AuthContext {
  userId: string;
  role: AuthRole;
}

const AUTH_COOKIE_NAME = 'auth_token';
const JWT_ALG = 'HS256';
const JWT_TYP = 'JWT';
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function base64UrlEncode(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const padLength = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('❌ JWT_SECRET is not set');
    return null;
  }
  return secret;
}

export function createAuthToken(params: { userId: string; role: AuthRole; ttlSeconds?: number }): string {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + (params.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS);

  const header = base64UrlEncode(JSON.stringify({ alg: JWT_ALG, typ: JWT_TYP }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: params.userId,
      role: params.role,
      iat: now,
      exp,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncode(crypto.createHmac('sha256', secret).update(signingInput).digest());
  return `${signingInput}.${signature}`;
}

export function verifyAuthToken(token: string): AuthContext | null {
  const secret = getJwtSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = base64UrlEncode(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  );

  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signatureB64);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payloadJson = base64UrlDecode(payloadB64).toString('utf8');
    const payload = JSON.parse(payloadJson) as { sub?: string; role?: AuthRole; exp?: number };
    if (!payload.sub || (payload.role !== 'patient' && payload.role !== 'medical')) {
      return null;
    }
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function getAuthTokenFromRequest(request: NextRequest): string | null {
  const bearer = request.headers.get('authorization');
  if (bearer?.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length).trim();
  }

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return cookie || null;
}

export function getAuthContext(request: NextRequest): AuthContext | null {
  const headerUserId = request.headers.get('x-auth-user-id');
  const headerRole = request.headers.get('x-auth-role');
  if (headerUserId && (headerRole === 'patient' || headerRole === 'medical')) {
    return { userId: headerUserId, role: headerRole };
  }

  const token = getAuthTokenFromRequest(request);
  if (!token) return null;
  return verifyAuthToken(token);
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DEFAULT_TOKEN_TTL_SECONDS,
  });
}

