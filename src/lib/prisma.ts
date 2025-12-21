import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// データベースURLがない場合はPrismaを無効化
let prisma: PrismaClient | undefined;

if (process.env.DATABASE_URL) {
  prisma = globalThis.prisma ?? new PrismaClient();
  // serverless環境では production でも使い回さないと接続が増えすぎるため、常に global に保持する
  globalThis.prisma = prisma;
}

export default prisma;

// データベース接続を確認する関数
export async function ensurePrismaConnection() {
  if (!prisma) {
    console.warn('⚠️ Prisma is disabled (no DATABASE_URL)');
    return false;
  }
  
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
    return false;
  }
}