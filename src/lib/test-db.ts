import { prisma } from './prisma';

export async function testDatabaseConnection() {
  try {
    // データベース接続テスト
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // テーブル存在確認
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}