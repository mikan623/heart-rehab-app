import { z } from 'zod';
import { NextResponse } from 'next/server';

// ── 共通フィールド ──────────────────────────────────────────
const email = z.string().min(1, 'メールアドレスが必要です').email('有効なメールアドレスを入力してください');
const password = z.string().min(6, 'パスワードは6文字以上である必要があります');

// ── 認証 ────────────────────────────────────────────────────
export const signupSchema = z.object({
  email,
  name: z.string().min(1, '名前が必要です'),
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'パスワードが必要です'),
  role: z.string().optional(),
});

export const resetPasswordRequestSchema = z.object({
  email,
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().min(1, 'トークンが必要です'),
  newPassword: password,
});

// ── お問い合わせ ─────────────────────────────────────────────
export const contactSchema = z.object({
  name: z.string().min(1, '名前が必要です'),
  email,
  category: z.string().optional().default('general'),
  message: z.string().min(1, 'メッセージが必要です'),
});

// ── Admin ────────────────────────────────────────────────────
export const adminInviteCodeSchema = z.object({
  secret: z.string().min(1),
  expiresInDays: z.number().int().min(1).max(365).optional().default(7),
});

// ── 医療招待 ─────────────────────────────────────────────────
export const medicalInvitePostSchema = z.object({
  providerId: z.string().min(1, 'providerId が必要です'),
  patientId: z.string().min(1, 'patientId が必要です'),
});

// ── ヘルパー ─────────────────────────────────────────────────
type ParseOk<T> = { data: T; error: null };
type ParseErr = { data: null; error: NextResponse };

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<ParseOk<T> | ParseErr> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { data: null, error: NextResponse.json({ error: '無効なリクエスト形式です' }, { status: 400 }) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'バリデーションエラー';
    return { data: null, error: NextResponse.json({ error: message }, { status: 400 }) };
  }
  return { data: result.data, error: null };
}
