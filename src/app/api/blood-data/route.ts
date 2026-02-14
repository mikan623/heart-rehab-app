import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

type BloodValueKey =
  | 'hbA1c'
  | 'randomBloodSugar'
  | 'totalCholesterol'
  | 'triglycerides'
  | 'hdlCholesterol'
  | 'ldlCholesterol'
  | 'bun'
  | 'creatinine'
  | 'uricAcid'
  | 'hemoglobin'
  | 'bnp';

type BloodValuesInput = Partial<Record<BloodValueKey, unknown>>;

type CpxTestInput = {
  cpxRound?: unknown;
  atOneMinBefore?: unknown;
  atDuring?: unknown;
  maxLoad?: unknown;
  loadWeight?: unknown;
  vo2?: unknown;
  mets?: unknown;
  heartRate?: unknown;
  systolicBloodPressure?: unknown;
  findings?: unknown;
};

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await ensurePrismaConnection();
    
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const userId = auth.userId;
    
    // 血液データを取得
    const bloodDataList = await prisma?.bloodData.findMany({
      where: { userId },
      include: {
        cpxTests: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { testDate: 'desc' },
    });
    
    return NextResponse.json(bloodDataList);
  } catch (error) {
    console.error('❌ Error fetching blood data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch blood data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await ensurePrismaConnection();
    
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const data = await request.json();
    const { mode, userId: bodyUserId, testDate, bloodValues, cpxTests } = data as {
      mode?: 'blood' | 'cpx';
      userId: string;
      testDate: string;
      bloodValues?: BloodValuesInput;
      cpxTests?: CpxTestInput[];
    };
    const userId = auth.userId;

    const fieldErrors: Record<string, string> = {};
    const addErr = (k: string, msg: string) => {
      if (!fieldErrors[k]) fieldErrors[k] = msg;
    };
    // 0（0.0含む）は入力不可。小数OK、1〜1000 の範囲。
    const parseNum1to1000 = (v: unknown, key: string): number | null => {
      if (v === null || v === undefined || String(v).trim() === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) {
        addErr(key, '数値を入力してください');
        return null;
      }
      if (n <= 0 || n > 1000) {
        addErr(key, '0より大きい〜1000 の範囲で入力してください');
        return null;
      }
      return n;
    };
    
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // バリデーション（>1000 を禁止、小数OK）
    if (mode !== 'cpx') {
      const keys = [
        'hbA1c',
        'randomBloodSugar',
        'totalCholesterol',
        'triglycerides',
        'hdlCholesterol',
        'ldlCholesterol',
        'bun',
        'creatinine',
        'uricAcid',
        'hemoglobin',
        'bnp',
      ];
      for (const k of keys) parseNum1to1000(bloodValues?.[k], `bloodValues.${k}`);
    }
    if (Array.isArray(cpxTests)) {
      cpxTests.forEach((cpx: CpxTestInput, idx: number) => {
        // cpxRound は整数
        const round = cpx?.cpxRound;
        if (round !== null && round !== undefined && String(round).trim() !== '') {
          const n = Number(round);
          if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
            addErr(`cpxTests.${idx}.cpxRound`, 'CPX回数は 1〜1000 の整数で入力してください');
          }
        }
        [
          'atOneMinBefore',
          'atDuring',
          'maxLoad',
          'loadWeight',
          'vo2',
          'mets',
          'heartRate',
          'systolicBloodPressure',
        ].forEach((k) => parseNum1to1000(cpx?.[k], `cpxTests.${idx}.${k}`));
      });
    }
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    
    // 🩸血液のみ / 🏃CPXのみ を両対応
    // CPX-only の場合は、同じ testDate の BloodData を探し、なければ血液値nullで作成する
    let newBloodData =
      mode === 'cpx'
        ? await prisma?.bloodData.findFirst({
            where: { userId, testDate },
            include: { cpxTests: true },
          })
        : null;

    if (!newBloodData) {
      newBloodData = await prisma?.bloodData.create({
        data: {
          userId,
          testDate,
          hbA1c: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.hbA1c, 'bloodValues.hbA1c'),
          randomBloodSugar: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.randomBloodSugar, 'bloodValues.randomBloodSugar'),
          totalCholesterol: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.totalCholesterol, 'bloodValues.totalCholesterol'),
          triglycerides: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.triglycerides, 'bloodValues.triglycerides'),
          hdlCholesterol: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.hdlCholesterol, 'bloodValues.hdlCholesterol'),
          ldlCholesterol: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.ldlCholesterol, 'bloodValues.ldlCholesterol'),
          bun: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.bun, 'bloodValues.bun'),
          creatinine: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.creatinine, 'bloodValues.creatinine'),
          uricAcid: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.uricAcid, 'bloodValues.uricAcid'),
          hemoglobin: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.hemoglobin, 'bloodValues.hemoglobin'),
          bnp: mode === 'cpx' ? null : parseNum1to1000(bloodValues?.bnp, 'bloodValues.bnp'),
        },
        include: { cpxTests: true },
      });
    }
    
    // CPX検査データがあれば追加（blood-only でも送られたら保存できる）
    if (cpxTests && cpxTests.length > 0) {
      for (const cpx of cpxTests) {
        await prisma?.cardiopulmonaryExerciseTest.create({
          data: {
            bloodDataId: newBloodData.id,
            testDate: cpx.testDate || testDate,
            cpxRound: cpx.cpxRound,
            atOneMinBefore: parseNum1to1000(cpx.atOneMinBefore, 'cpx.atOneMinBefore'),
            atDuring: parseNum1to1000(cpx.atDuring, 'cpx.atDuring'),
            maxLoad: parseNum1to1000(cpx.maxLoad, 'cpx.maxLoad'),
            loadWeight: parseNum1to1000(cpx.loadWeight, 'cpx.loadWeight'),
            vo2: parseNum1to1000(cpx.vo2, 'cpx.vo2'),
            mets: parseNum1to1000(cpx.mets, 'cpx.mets'),
            heartRate: parseNum1to1000(cpx.heartRate, 'cpx.heartRate'),
            systolicBloodPressure: parseNum1to1000(cpx.systolicBloodPressure, 'cpx.systolicBloodPressure'),
            findings: cpx.findings || null,
          }
        });
      }
    }
    
    return NextResponse.json(newBloodData, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating blood data:', error);
    return NextResponse.json(
      { error: 'Failed to create blood data' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const data = await request.json();
    const { mode, id, testDate, bloodValues, cpxTests } = data as {
      mode?: 'blood' | 'cpx';
      id: string;
      testDate: string;
      bloodValues?: BloodValuesInput;
      cpxTests?: CpxTestInput[];
    };

    const fieldErrors: Record<string, string> = {};
    const addErr = (k: string, msg: string) => {
      if (!fieldErrors[k]) fieldErrors[k] = msg;
    };
    // 0（0.0含む）は入力不可。小数OK、1〜1000 の範囲。
    const parseNum1to1000 = (v: unknown, key: string): number | null => {
      if (v === null || v === undefined || String(v).trim() === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n)) {
        addErr(key, '数値を入力してください');
        return null;
      }
      if (n <= 0 || n > 1000) {
        addErr(key, '0より大きい〜1000 の範囲で入力してください');
        return null;
      }
      return n;
    };
    
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    // バリデーション（>1000 を禁止、小数OK）
    if (mode !== 'cpx') {
      const keys = [
        'hbA1c',
        'randomBloodSugar',
        'totalCholesterol',
        'triglycerides',
        'hdlCholesterol',
        'ldlCholesterol',
        'bun',
        'creatinine',
        'uricAcid',
        'hemoglobin',
        'bnp',
      ];
      for (const k of keys) parseNum1to1000(bloodValues?.[k], `bloodValues.${k}`);
    }
    if (Array.isArray(cpxTests)) {
      cpxTests.forEach((cpx: CpxTestInput, idx: number) => {
        const round = cpx?.cpxRound;
        if (round !== null && round !== undefined && String(round).trim() !== '') {
          const n = Number(round);
          if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) {
            addErr(`cpxTests.${idx}.cpxRound`, 'CPX回数は 1〜1000 の整数で入力してください');
          }
        }
        [
          'atOneMinBefore',
          'atDuring',
          'maxLoad',
          'loadWeight',
          'vo2',
          'mets',
          'heartRate',
          'systolicBloodPressure',
        ].forEach((k) => parseNum1to1000(cpx?.[k], `cpxTests.${idx}.${k}`));
      });
    }
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    
    // 血液データを更新（CPX-only の場合は血液値は触らない）
    const updatedBloodData = await prisma?.bloodData.update({
      where: { id },
      data: {
        testDate,
        ...(mode === 'cpx'
          ? {}
          : {
              hbA1c: parseNum1to1000(bloodValues?.hbA1c, 'bloodValues.hbA1c'),
              randomBloodSugar: parseNum1to1000(bloodValues?.randomBloodSugar, 'bloodValues.randomBloodSugar'),
              totalCholesterol: parseNum1to1000(bloodValues?.totalCholesterol, 'bloodValues.totalCholesterol'),
              triglycerides: parseNum1to1000(bloodValues?.triglycerides, 'bloodValues.triglycerides'),
              hdlCholesterol: parseNum1to1000(bloodValues?.hdlCholesterol, 'bloodValues.hdlCholesterol'),
              ldlCholesterol: parseNum1to1000(bloodValues?.ldlCholesterol, 'bloodValues.ldlCholesterol'),
              bun: parseNum1to1000(bloodValues?.bun, 'bloodValues.bun'),
              creatinine: parseNum1to1000(bloodValues?.creatinine, 'bloodValues.creatinine'),
              uricAcid: parseNum1to1000(bloodValues?.uricAcid, 'bloodValues.uricAcid'),
              hemoglobin: parseNum1to1000(bloodValues?.hemoglobin, 'bloodValues.hemoglobin'),
              bnp: parseNum1to1000(bloodValues?.bnp, 'bloodValues.bnp'),
            }),
      },
      include: {
        cpxTests: true
      }
    });
    
    // CPX更新がリクエストに含まれる場合のみ置き換える（blood-only 更新でCPXを消さない）
    if (Array.isArray(cpxTests)) {
      await prisma?.cardiopulmonaryExerciseTest.deleteMany({
        where: { bloodDataId: id }
      });
      if (cpxTests.length > 0) {
        for (const cpx of cpxTests) {
          await prisma?.cardiopulmonaryExerciseTest.create({
            data: {
              bloodDataId: id,
              testDate: cpx.testDate || testDate,
              cpxRound: cpx.cpxRound,
              atOneMinBefore: parseNum1to1000(cpx.atOneMinBefore, 'cpx.atOneMinBefore'),
              atDuring: parseNum1to1000(cpx.atDuring, 'cpx.atDuring'),
              maxLoad: parseNum1to1000(cpx.maxLoad, 'cpx.maxLoad'),
              loadWeight: parseNum1to1000(cpx.loadWeight, 'cpx.loadWeight'),
              vo2: parseNum1to1000(cpx.vo2, 'cpx.vo2'),
              mets: parseNum1to1000(cpx.mets, 'cpx.mets'),
              heartRate: parseNum1to1000(cpx.heartRate, 'cpx.heartRate'),
              systolicBloodPressure: parseNum1to1000(cpx.systolicBloodPressure, 'cpx.systolicBloodPressure'),
              findings: cpx.findings || null,
            }
          });
        }
      }
    }
    
    return NextResponse.json(updatedBloodData);
  } catch (error) {
    console.error('❌ Error updating blood data:', error);
    return NextResponse.json(
      { error: 'Failed to update blood data' },
      { status: 500 }
    );
  }
}

// 削除:
// - id: BloodData（親）を削除（紐づくCPXはCascadeで削除）
// - cpxId: CPX（子）を単体削除
export async function DELETE(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();

    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const cpxId = searchParams.get('cpxId');

    if (!id && !cpxId) {
      return NextResponse.json({ error: 'id or cpxId is required' }, { status: 400 });
    }

    if (cpxId) {
      await prisma.cardiopulmonaryExerciseTest.delete({
        where: { id: cpxId },
      });
      return NextResponse.json({ success: true });
    }

    await prisma.bloodData.delete({ where: { id: id! } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting blood data:', error);
    return NextResponse.json({ error: 'Failed to delete blood data' }, { status: 500 });
  }
}

