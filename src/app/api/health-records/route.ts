import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Prisma Client初期化確認
async function ensurePrismaConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected successfully');
  } catch (error) {
    console.error('❌ Prisma connection failed:', error);
    throw new Error('Database connection failed');
  }
}

// 型定義を追加
interface HealthRecordResponse {
  id: string;
  date: Date;
  time: string;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  pulse: number | null;
  weight: number | null;
  exercise: any;
  meal: any;
  dailyLife: string | null;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Prisma接続確認
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('🔍 Fetching records for userId:', userId);
    
    // 健康記録を取得
    const records = await prisma.healthRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    console.log('📊 Found records:', records.length);
    
    // レスポンス形式を整形
    const formattedRecords: HealthRecordResponse[] = records.map((record: any) => ({
      id: record.id,
      date: record.date,
      time: record.time,
      bloodPressure: {
        systolic: record.bloodPressureSystolic,
        diastolic: record.bloodPressureDiastolic
      },
      pulse: record.pulse,
      weight: record.weight,
      exercise: record.exercise,
      meal: record.meal,
      dailyLife: record.dailyLife,
      createdAt: record.createdAt
    }));
    
    return NextResponse.json({ records: formattedRecords });
    
  } catch (error: any) {
    console.error('❌ Health Records API Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // Prismaエラーの詳細処理
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この日時の記録は既に存在します。' },
        { status: 409 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: '記録が見つかりません。' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnection();
    
    const { userId, healthRecord } = await request.json();
    
    console.log('💾 Saving health record for userId:', userId);
    console.log('📝 Health record data:', healthRecord);
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    if (!healthRecord.bloodPressure?.systolic || !healthRecord.bloodPressure?.diastolic) {
      return NextResponse.json({ error: 'Blood pressure is required' }, { status: 400 });
    }
    
    // ユーザーが存在するかチェック、存在しない場合は作成
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('👤 Creating new user:', userId);
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          name: `User ${userId}`
        }
      });
    }
    
    // 🆕 既存のレコードをチェック（同じ日付・時間のレコード）
    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        userId: userId,
        date: new Date(healthRecord.date),
        time: healthRecord.time
      }
    });
    
    let savedRecord;
    
    if (existingRecord) {
      // 既存のレコードを更新
      console.log('🔄 Updating existing record:', existingRecord.id);
      savedRecord = await prisma.healthRecord.update({
        where: { id: existingRecord.id },
        data: {
          bloodPressureSystolic: parseInt(healthRecord.bloodPressure.systolic),
          bloodPressureDiastolic: parseInt(healthRecord.bloodPressure.diastolic),
          pulse: healthRecord.pulse ? parseInt(healthRecord.pulse) : null,
          weight: healthRecord.weight ? parseFloat(healthRecord.weight) : null,
          exercise: healthRecord.exercise || null,
          meal: healthRecord.meal || null,
          dailyLife: healthRecord.dailyLife || null,
        }
      });
    } else {
      // 新しいレコードを作成
      console.log('✨ Creating new record');
      savedRecord = await prisma.healthRecord.create({
        data: {
          userId,
          date: new Date(healthRecord.date),
          time: healthRecord.time,
          bloodPressureSystolic: parseInt(healthRecord.bloodPressure.systolic),
          bloodPressureDiastolic: parseInt(healthRecord.bloodPressure.diastolic),
          pulse: healthRecord.pulse ? parseInt(healthRecord.pulse) : null,
          weight: healthRecord.weight ? parseFloat(healthRecord.weight) : null,
          exercise: healthRecord.exercise || null,
          meal: healthRecord.meal || null,
          dailyLife: healthRecord.dailyLife || null,
        }
      });
    }
    
    console.log('✅ Health record saved successfully:', savedRecord.id);
    
    return NextResponse.json({ 
      success: true, 
      record: {
        id: savedRecord.id,
        date: savedRecord.date,
        time: savedRecord.time,
        bloodPressure: {
          systolic: savedRecord.bloodPressureSystolic,
          diastolic: savedRecord.bloodPressureDiastolic
        },
        pulse: savedRecord.pulse,
        weight: savedRecord.weight,
        exercise: savedRecord.exercise,
        meal: savedRecord.meal,
        dailyLife: savedRecord.dailyLife
      }
    });
    
  } catch (error: any) {
    console.error('❌ Health record creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to save health record',
      details: error.message 
    }, { status: 500 });
  }
}

// 健康記録削除
export async function DELETE(request: NextRequest) {
  try {
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    
    console.log('🗑️ Deleting health record:', { recordId, userId, date, time });
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    let deletedRecord;
    
    if (recordId) {
      // recordIdが指定されている場合（特定のレコードを削除）
      deletedRecord = await prisma.healthRecord.delete({
        where: { id: recordId }
      });
      console.log('✅ Deleted record by ID:', deletedRecord.id);
    } else if (date && time) {
      // dateとtimeが指定されている場合（同じ日付・時間のレコードを削除）
      const existingRecord = await prisma.healthRecord.findFirst({
        where: {
          userId: userId,
          date: new Date(date),
          time: time
        }
      });
      
      if (!existingRecord) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }
      
      deletedRecord = await prisma.healthRecord.delete({
        where: { id: existingRecord.id }
      });
      console.log('✅ Deleted record by date/time:', deletedRecord.id);
    } else {
      return NextResponse.json({ error: 'Either recordId or (userId, date, time) is required' }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true,
      deletedRecord: {
        id: deletedRecord.id,
        date: deletedRecord.date,
        time: deletedRecord.time
      }
    });
    
  } catch (error: any) {
    console.error('❌ Health Records API Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    // Prismaエラーの詳細処理
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この日時の記録は既に存在します。' },
        { status: 409 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: '記録が見つかりません。' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}