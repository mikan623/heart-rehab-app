import type { NextConfig } from "next";

const securityHeaders = [
  // クリックジャッキング対策
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // MIMEスニッフィング対策
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // リファラー情報の制限
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 権限ポリシー（不要なブラウザ機能を制限）
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // HTTPS 強制（本番環境のみ有効）
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  // XSS 対策 CSP
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js のインラインスクリプト（nonce なし構成のため unsafe-inline を許容）
      // LIFF SDK は static.line-scdn.net から読み込み
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://d.line-scdn.net",
      "style-src 'self' 'unsafe-inline'",
      // LINE プロフィール画像は複数の LINE CDN ドメインから配信される
      "img-src 'self' data: blob: https://profile.line-scdn.net https://obs.line-scdn.net https://d.line-scdn.net",
      "font-src 'self'",
      // LIFF SDK 初期化時に liff.line.me へ API リクエストが発生する（必須）
      "connect-src 'self' https://liff.line.me https://api.line.me https://access.line.me",
      // LIFF OAuth フローで access.line.me の iframe が生成されることがある
      "frame-src 'self' https://liff.line.me https://access.line.me",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  // ビルド時のデータベース接続を完全に無効化
  webpack: (config, { isServer }) => {
    if (isServer) {
      // サーバー側のビルド時にPrismaの接続をスキップ
      config.externals = config.externals || [];
      config.externals.push({
        '@prisma/client': 'commonjs @prisma/client',
      });
    }
    return config;
  },
};

export default nextConfig;