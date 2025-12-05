import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

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
  medicationTaken: boolean | null;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Prisma接続確認
    const connected = await ensurePrismaConnection();
    
    // データベースがない場合は空の配列を返す
    if (!connected || !prisma) {
      console.log('⚠️ Database not available, returning empty array');
      return NextResponse.json({ records: [] });
    }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
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
      medicationTaken: record.medicationTaken,
      createdAt: record.createdAt
    }));
    
    return NextResponse.json({ records: formattedRecords });
    
  } catch (error: any) {
    console.error('❌ Health Records API Error:', {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    });
    
    // エラー時は空の配列を返す（GETは読み取り専用だから）
    return NextResponse.json({ records: [] });
  }
}

// 家族にLINEメッセージを送信するヘルパー
async function notifyFamilyMembers(userId: string, savedRecord: any) {
  try {
    if (!prisma || !process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.log('⚠️ LINE通知スキップ: PrismaまたはLINE_CHANNEL_ACCESS_TOKENが未設定');
      return;
    }

    // 患者プロフィール（名前があれば使う）
    const profile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { displayName: true },
    });

    // 登録済みの家族メンバーを取得
    const familyMembers = await prisma.familyMember.findMany({
      where: {
        userId,
        isRegistered: true,
        lineUserId: { not: null },
      },
    });

    if (!familyMembers.length) {
      console.log('👨‍👩‍👧‍👦 家族メンバーなし、LINE通知スキップ');
      return;
    }

    // 送信メッセージを作成
    const namePart = profile?.displayName
      ? `${profile.displayName} さんの健康記録です。\n\n`
      : '';

    const message =
      `💖 健康記録のお知らせ 💖\n\n` +
      namePart +
      `📅 日付: ${savedRecord.date}\n` +
      `⏰ 時間: ${savedRecord.time}\n` +
      `🩺 血圧: ${savedRecord.bloodPressureSystolic}/${savedRecord.bloodPressureDiastolic} mmHg\n` +
      `💓 脈拍: ${savedRecord.pulse ?? '-'} 回/分\n` +
      `⚖️ 体重: ${savedRecord.weight ?? '-'} kg\n` +
      (savedRecord.dailyLife ? `📝 メモ: ${savedRecord.dailyLife}\n` : '') +
      `\n心臓ちゃんより 💖`;

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    for (const member of familyMembers) {
      if (!member.lineUserId) continue;

      const body = {
        to: member.lineUserId,
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      };

      try {
        const res = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('❌ LINE送信失敗:', {
            status: res.status,
            body: text,
          });
        } else {
          console.log('✅ 家族へのLINE通知送信成功:', member.id);
        }
      } catch (err) {
        console.error('❌ LINE送信エラー:', err);
      }
    }
  } catch (error) {
    console.error('❌ 家族通知ヘルパーエラー:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    
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
    
    // ⚠️ データベースが接続できない場合はローカルストレージを使用
    if (!connected || !prisma) {
      console.log('⚠️ Database not available, returning 503 to use localStorage');
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
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
    // dateを文字列として比較する
    const existingRecord = await prisma.healthRecord.findFirst({
      where: {
        userId: userId,
        date: healthRecord.date,  // ✅ 文字列のまま使用
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
          medicationTaken: healthRecord.medicationTaken || false,
        }
      });
    } else {
      // 新しいレコードを作成
      console.log('✨ Creating new record');
      savedRecord = await prisma.healthRecord.create({
        data: {
          userId,
          date: healthRecord.date,  // ✅ 文字列のまま使用
          time: healthRecord.time,
          bloodPressureSystolic: parseInt(healthRecord.bloodPressure.systolic),
          bloodPressureDiastolic: parseInt(healthRecord.bloodPressure.diastolic),
          pulse: healthRecord.pulse ? parseInt(healthRecord.pulse) : null,
          weight: healthRecord.weight ? parseFloat(healthRecord.weight) : null,
          exercise: healthRecord.exercise || null,
          meal: healthRecord.meal || null,
          dailyLife: healthRecord.dailyLife || null,
          medicationTaken: healthRecord.medicationTaken || false,
        }
      });
    }
    
    console.log('✅ Health record saved successfully:', savedRecord.id);

    // 🆕 家族へLINEで健康記録を通知（エラーは握りつぶす）
    notifyFamilyMembers(userId, savedRecord).catch((err) => {
      console.error('❌ 家族通知非同期エラー:', err);
    });
    
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
        dailyLife: savedRecord.dailyLife,
        medicationTaken: savedRecord.medicationTaken
      }
    });
    
  } catch (error: any) {
    console.error('❌ Health record creation error:', {
      message: error.message,
      code: error.code,
      details: error
    });
    
    // DB接続がない場合はローカルストレージを使うよう指示
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ 
        error: 'Database not available. Using local storage instead.',
        success: false
      }, { status: 503 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to save health record',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// 健康記録削除
export async function DELETE(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    
    // ⚠️ データベースが接続できない場合は503を返す
    if (!connected || !prisma) {
      console.log('⚠️ Database not available for delete');
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
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
          date: date,  // ✅ 文字列のまま使用
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