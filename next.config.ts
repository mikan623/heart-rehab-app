import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // デプロイ時はESLintエラーを無視
    ignoreDuringBuilds: true,
  },
  typescript: {
    // デプロイ時はTypeScriptエラーを無視（本当に必要な場合のみ）
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;