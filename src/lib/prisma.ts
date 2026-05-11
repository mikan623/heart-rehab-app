import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// DIRECT_URL が未設定の場合は DATABASE_URL にフォールバック
// schema.prisma に directUrl を定義しているが、実行時は url のみ使用するため
// ECS 等 DIRECT_URL を持たない環境でも PrismaClient が初期化できるようにする
if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

let prisma: PrismaClient | undefined;

if (process.env.DATABASE_URL) {
  try {
    prisma = globalThis.prisma ?? new PrismaClient();
    globalThis.prisma = prisma;
  } catch (e) {
    console.error('Prisma initialization failed:', e);
  }
}

export default prisma;