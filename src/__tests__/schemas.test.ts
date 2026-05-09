/**
 * @jest-environment node
 */
import {
  signupSchema,
  loginSchema,
  contactSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  adminInviteCodeSchema,
  medicalInvitePostSchema,
  parseBody,
} from '@/lib/schemas';

// ── ヘルパー ────────────────────────────────────────────────
const makeRequest = (body: unknown) =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const makeMalformedRequest = () =>
  new Request('http://localhost/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid{json',
  });

// ── signupSchema ─────────────────────────────────────────────
describe('signupSchema', () => {
  it('正常なデータは通過する', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      name: '田中太郎',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('メールアドレスが空だとエラー', () => {
    const result = signupSchema.safeParse({
      email: '',
      name: '田中太郎',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('メール形式が不正だとエラー', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      name: '田中太郎',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('名前が空だとエラー', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      name: '',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('パスワードが5文字以下だとエラー', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      name: '田中太郎',
      password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('パスワードがちょうど6文字なら通過する', () => {
    const result = signupSchema.safeParse({
      email: 'test@example.com',
      name: '田中太郎',
      password: '123456',
    });
    expect(result.success).toBe(true);
  });
});

// ── loginSchema ──────────────────────────────────────────────
describe('loginSchema', () => {
  it('正常なデータは通過する', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('roleはoptionalなので省略しても通過する', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('メール形式が不正だとエラー', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('パスワードが空だとエラー', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

// ── contactSchema ────────────────────────────────────────────
describe('contactSchema', () => {
  it('正常なデータは通過する', () => {
    const result = contactSchema.safeParse({
      name: '田中太郎',
      email: 'test@example.com',
      message: 'お問い合わせ内容です',
    });
    expect(result.success).toBe(true);
  });

  it('categoryはoptionalなのでデフォルト値generalが入る', () => {
    const result = contactSchema.safeParse({
      name: '田中太郎',
      email: 'test@example.com',
      message: 'お問い合わせ内容です',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('general');
    }
  });

  it('メッセージが空だとエラー', () => {
    const result = contactSchema.safeParse({
      name: '田中太郎',
      email: 'test@example.com',
      message: '',
    });
    expect(result.success).toBe(false);
  });

  it('名前が空だとエラー', () => {
    const result = contactSchema.safeParse({
      name: '',
      email: 'test@example.com',
      message: 'お問い合わせ内容です',
    });
    expect(result.success).toBe(false);
  });
});

// ── resetPasswordRequestSchema ───────────────────────────────
describe('resetPasswordRequestSchema', () => {
  it('有効なメールアドレスは通過する', () => {
    const result = resetPasswordRequestSchema.safeParse({ email: 'test@example.com' });
    expect(result.success).toBe(true);
  });

  it('メール形式が不正だとエラー', () => {
    const result = resetPasswordRequestSchema.safeParse({ email: 'invalid' });
    expect(result.success).toBe(false);
  });
});

// ── resetPasswordConfirmSchema ───────────────────────────────
describe('resetPasswordConfirmSchema', () => {
  it('正常なデータは通過する', () => {
    const result = resetPasswordConfirmSchema.safeParse({
      token: 'valid-token-abc',
      newPassword: 'newpassword123',
    });
    expect(result.success).toBe(true);
  });

  it('トークンが空だとエラー', () => {
    const result = resetPasswordConfirmSchema.safeParse({
      token: '',
      newPassword: 'newpassword123',
    });
    expect(result.success).toBe(false);
  });

  it('新パスワードが5文字以下だとエラー', () => {
    const result = resetPasswordConfirmSchema.safeParse({
      token: 'valid-token',
      newPassword: '12345',
    });
    expect(result.success).toBe(false);
  });
});

// ── adminInviteCodeSchema ────────────────────────────────────
describe('adminInviteCodeSchema', () => {
  it('正常なデータは通過する', () => {
    const result = adminInviteCodeSchema.safeParse({ secret: 'admin-secret' });
    expect(result.success).toBe(true);
  });

  it('expiresInDaysのデフォルト値は7', () => {
    const result = adminInviteCodeSchema.safeParse({ secret: 'admin-secret' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.expiresInDays).toBe(7);
    }
  });

  it('expiresInDaysが365超えるとエラー', () => {
    const result = adminInviteCodeSchema.safeParse({
      secret: 'admin-secret',
      expiresInDays: 366,
    });
    expect(result.success).toBe(false);
  });

  it('secretが空だとエラー', () => {
    const result = adminInviteCodeSchema.safeParse({ secret: '' });
    expect(result.success).toBe(false);
  });
});

// ── medicalInvitePostSchema ──────────────────────────────────
describe('medicalInvitePostSchema', () => {
  it('正常なデータは通過する', () => {
    const result = medicalInvitePostSchema.safeParse({
      providerId: 'provider-001',
      patientId: 'patient-001',
    });
    expect(result.success).toBe(true);
  });

  it('providerIdが空だとエラー', () => {
    const result = medicalInvitePostSchema.safeParse({
      providerId: '',
      patientId: 'patient-001',
    });
    expect(result.success).toBe(false);
  });

  it('patientIdが空だとエラー', () => {
    const result = medicalInvitePostSchema.safeParse({
      providerId: 'provider-001',
      patientId: '',
    });
    expect(result.success).toBe(false);
  });
});

// ── parseBody ────────────────────────────────────────────────
describe('parseBody', () => {
  it('正常なJSONとスキーマが一致するとdataを返す', async () => {
    const req = makeRequest({
      email: 'test@example.com',
      name: '田中太郎',
      password: 'password123',
    });
    const result = await parseBody(req, signupSchema);
    expect(result.error).toBeNull();
    expect(result.data).toMatchObject({
      email: 'test@example.com',
      name: '田中太郎',
    });
  });

  it('不正なJSONだとerrorを返す', async () => {
    const req = makeMalformedRequest();
    const result = await parseBody(req, signupSchema);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('スキーマバリデーション失敗時はerrorを返す', async () => {
    const req = makeRequest({
      email: 'not-an-email',
      name: '',
      password: '123',
    });
    const result = await parseBody(req, signupSchema);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('バリデーション失敗時のレスポンスはステータス400', async () => {
    const req = makeRequest({ email: 'invalid' });
    const result = await parseBody(req, signupSchema);
    expect(result.error).not.toBeNull();
    if (result.error) {
      expect(result.error.status).toBe(400);
    }
  });
});
