import prisma, { ensurePrismaConnection } from './prisma';

export async function testDatabaseConnection() {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.error('❌ Database not available (no DATABASE_URL or connection failed)');
      return false;
    }
    console.log('✅ Database connection successful');
    
    // テーブル存在確認
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  } finally {
    // prisma は共有インスタンスなので、ここで disconnect しない
  }
}