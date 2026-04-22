import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';
import type { HealthRecord, Prisma } from '@prisma/client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const dynamic = 'force-dynamic';

// 型定義を追加
interface HealthRecordResponse {
  id: string;
  date: string;
  time: string;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  pulse: number | null;
  weight: number | null;
  exercise: Prisma.JsonValue | null;
  meal: Prisma.JsonValue | null;
  dailyLife: string | null;
  medicationTaken: boolean | null;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prisma接続確認
    const connected = await ensurePrismaConnection();
    
    // データベースがない場合は空の配列を返す
    if (!connected || !prisma) {
      console.log('⚠️ Database not available, returning empty array');
      return NextResponse.json(
        { records: [], error: 'Database not available' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    
    const userId = auth.userId;
    
    console.log('🔍 Fetching records for userId:', userId);
    
    // 健康記録を取得
    const records = await prisma.healthRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    console.log('📊 Found records:', records.length);
    
    // レスポンス形式を整形
    const formattedRecords: HealthRecordResponse[] = records.map((record) => ({
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
    
    return NextResponse.json({ records: formattedRecords }, { headers: { 'Cache-Control': 'no-store' } });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
    console.error('❌ Health Records API Error:', {
      message,
      code,
      timestamp: new Date().toISOString(),
    });
    
    // エラー時は status を返す（クライアント側でリトライ/フォールバックできるようにする）
    return NextResponse.json(
      { records: [], error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

// 家族・本人にLINEメッセージを送信するヘルパー
async function notifyFamilyMembers(userId: string, savedRecord: HealthRecord) {
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

    // このユーザーに紐づく家族メンバーを取得（LINEユーザーIDが登録されている人すべて）
    const familyMembers = await prisma.familyMember.findMany({
      where: {
        userId,
        lineUserId: { not: null },
      },
    });

    // 本人の Messaging API userId も取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lineUserId: true },
    });

    if (!familyMembers.length && !user?.lineUserId) {
      console.log('👨‍👩‍👧‍👦 家族メンバーおよび本人LINE未連携のため、LINE通知スキップ');
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

    // 家族全員に送信
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

    // 本人にも送信（連携済みの場合）
    if (user?.lineUserId) {
      const selfBody = {
        to: user.lineUserId,
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
          body: JSON.stringify(selfBody),
        });

        if (!res.ok) {
          const text = await res.text();
          console.error('❌ 本人へのLINE送信失敗:', {
            status: res.status,
            body: text,
          });
        } else {
          console.log('✅ 本人へのLINE通知送信成功:', user.lineUserId);
        }
      } catch (err) {
        console.error('❌ 本人へのLINE送信エラー:', err);
      }
    }
  } catch (error) {
    console.error('❌ 家族・本人通知ヘルパーエラー:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await ensurePrismaConnection();

    const { userId: bodyUserId, healthRecord } = await request.json();
    const userId = auth.userId;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    console.log('💾 Saving health record for userId:', userId);
    console.log('📝 Health record data:', healthRecord);
    
    // バリデーション（複数項目をまとめて返す）
    const fieldErrors: Record<string, string> = {};
    const addErr = (k: string, msg: string) => {
      if (!fieldErrors[k]) fieldErrors[k] = msg;
    };

    if (!userId) addErr('userId', 'ユーザーIDが不正です');

    if (!healthRecord?.date) addErr('date', '日付が未指定です');
    if (!healthRecord?.time) addErr('time', '時間が未指定です');

    const sysRaw = healthRecord?.bloodPressure?.systolic;
    const diaRaw = healthRecord?.bloodPressure?.diastolic;
    if (!sysRaw) addErr('bloodPressure.systolic', '収縮期血圧（上）は必須です');
    if (!diaRaw) addErr('bloodPressure.diastolic', '拡張期血圧（下）は必須です');

    const pulseRaw = healthRecord?.pulse;
    if (!pulseRaw) addErr('pulse', '脈拍は必須です');

    const systolic = sysRaw ? Number(sysRaw) : NaN;
    const diastolic = diaRaw ? Number(diaRaw) : NaN;
    const pulse = pulseRaw ? Number(pulseRaw) : NaN;

    // 収縮期: 1〜299
    if (sysRaw && (!Number.isFinite(systolic) || systolic <= 0 || systolic >= 300)) {
      addErr('bloodPressure.systolic', '収縮期血圧（上）は 1〜299 mmHg の範囲で入力してください');
    }
    // 拡張期: 1〜299
    if (diaRaw && (!Number.isFinite(diastolic) || diastolic <= 0 || diastolic >= 300)) {
      addErr('bloodPressure.diastolic', '拡張期血圧（下）は 1〜299 mmHg の範囲で入力してください');
    }
    // 脈拍: 1〜299
    if (pulseRaw && (!Number.isFinite(pulse) || pulse <= 0 || pulse >= 300)) {
      addErr('pulse', '脈拍は 1〜299 回/分 の範囲で入力してください');
    }

    // 体重: 任意、0より大きい〜200（小数OK） ※ 0（0.0含む）は不可
    const weightRaw = healthRecord?.weight;
    if (weightRaw !== null && weightRaw !== undefined && String(weightRaw).trim() !== '') {
      const weight = Number(weightRaw);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 200) {
        addErr('weight', '体重は 0より大きい〜200 kg の範囲で入力してください');
      }
    }

    // 運動時間: 任意、1〜1440 ※ 0（0.0含む）は不可
    const durRaw = healthRecord?.exercise?.duration;
    if (durRaw !== null && durRaw !== undefined && String(durRaw).trim() !== '') {
      const dur = Number(durRaw);
      if (!Number.isFinite(dur) || dur <= 0 || dur > 1440) {
        addErr('exercise.duration', '運動時間は 1〜1440 分の範囲で入力してください');
      }
    }

    // 文字数制限
    const mealOther = healthRecord?.meal?.other;
    if (mealOther !== null && mealOther !== undefined && String(mealOther).length > 200) {
      addErr('meal.other', '食事内容（その他）は 200 文字以内で入力してください');
    }
    const dailyLife = healthRecord?.dailyLife;
    if (dailyLife !== null && dailyLife !== undefined && String(dailyLife).length > 400) {
      addErr('dailyLife', '自覚症状やその他は 400 文字以内で入力してください');
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    
    // ⚠️ データベースが接続できない場合はローカルストレージを使用
    if (!connected || !prisma) {
      console.log('⚠️ Database not available, returning 503 to use localStorage');
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
          pulse:
            healthRecord.pulse !== null && healthRecord.pulse !== undefined && String(healthRecord.pulse).trim() !== ''
              ? parseInt(healthRecord.pulse)
              : null,
          weight:
            healthRecord.weight !== null && healthRecord.weight !== undefined && String(healthRecord.weight).trim() !== ''
              ? parseFloat(healthRecord.weight)
              : null,
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
          pulse:
            healthRecord.pulse !== null && healthRecord.pulse !== undefined && String(healthRecord.pulse).trim() !== ''
              ? parseInt(healthRecord.pulse)
              : null,
          weight:
            healthRecord.weight !== null && healthRecord.weight !== undefined && String(healthRecord.weight).trim() !== ''
              ? parseFloat(healthRecord.weight)
              : null,
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
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
    console.error('❌ Health record creation error:', {
      message,
      code,
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
      details: process.env.NODE_ENV === 'development' ? message : undefined
    }, { status: 500 });
  }
}

// 健康記録削除
export async function DELETE(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const userId = auth.userId;
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    
    console.log('🗑️ Deleting health record:', { recordId, userId, date, time });
    
    let deletedRecord;
    
    if (recordId) {
      // recordIdが指定されている場合（特定のレコードを削除）
      const record = await prisma.healthRecord.findUnique({
        where: { id: recordId },
        select: { id: true, userId: true, date: true, time: true },
      });
      if (!record || record.userId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      deletedRecord = await prisma.healthRecord.delete({ where: { id: recordId } });
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
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('❌ Health Records API Error:', {
      message,
      stack,
      timestamp: new Date().toISOString(),
    });
    
    // Prismaエラーの詳細処理
    if (isRecord(error) && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'この日時の記録は既に存在します。' },
        { status: 409 }
      );
    }
    
    const errCode = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errCode === 'P2025') {
      return NextResponse.json(
        { error: '記録が見つかりません。' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'サーバーエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? errMsg : undefined
      },
      { status: 500 }
    );
  }
}