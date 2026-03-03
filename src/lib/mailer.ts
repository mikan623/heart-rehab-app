import nodemailer from 'nodemailer';

type PasswordResetEmailParams = {
  to: string;
  resetUrl: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  const port = portRaw ? Number(portRaw) : null;
  const secure = port === 465;

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from, secure };
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const cfg = getSmtpConfig();

  // 開発・検証用フォールバック：SMTP未設定ならログ出力のみ
  if (!cfg) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP is not configured');
    }
    console.log('[DEV] Password reset URL:', params.resetUrl);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const subject = 'パスワード再設定のご案内';
  const text = [
    'パスワード再設定のリクエストを受け付けました。',
    '',
    '下記URLから新しいパスワードを設定してください（有効期限あり）。',
    params.resetUrl,
    '',
    'このメールに心当たりがない場合は破棄してください。',
  ].join('\n');

  await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    subject,
    text,
  });
}

