import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
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
    const connected = await ensurePrismaConnection();
    
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }
    
    const data = await request.json();
    const { mode, userId, testDate, bloodValues, cpxTests } = data as {
      mode?: 'blood' | 'cpx';
      userId: string;
      testDate: string;
      bloodValues?: any;
      cpxTests?: any[];
    };
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
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
          hbA1c: mode === 'cpx' ? null : (bloodValues?.hbA1c ?? null),
          randomBloodSugar: mode === 'cpx' ? null : (bloodValues?.randomBloodSugar ?? null),
          totalCholesterol: mode === 'cpx' ? null : (bloodValues?.totalCholesterol ?? null),
          triglycerides: mode === 'cpx' ? null : (bloodValues?.triglycerides ?? null),
          hdlCholesterol: mode === 'cpx' ? null : (bloodValues?.hdlCholesterol ?? null),
          ldlCholesterol: mode === 'cpx' ? null : (bloodValues?.ldlCholesterol ?? null),
          bun: mode === 'cpx' ? null : (bloodValues?.bun ?? null),
          creatinine: mode === 'cpx' ? null : (bloodValues?.creatinine ?? null),
          uricAcid: mode === 'cpx' ? null : (bloodValues?.uricAcid ?? null),
          hemoglobin: mode === 'cpx' ? null : (bloodValues?.hemoglobin ?? null),
          bnp: mode === 'cpx' ? null : (bloodValues?.bnp ?? null),
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
            atOneMinBefore: cpx.atOneMinBefore || null,
            atDuring: cpx.atDuring || null,
            maxLoad: cpx.maxLoad || null,
            loadWeight: cpx.loadWeight || null,
            vo2: cpx.vo2 || null,
            mets: cpx.mets || null,
            heartRate: cpx.heartRate || null,
            systolicBloodPressure: cpx.systolicBloodPressure || null,
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
      bloodValues?: any;
      cpxTests?: any[];
    };
    
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
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
              hbA1c: bloodValues?.hbA1c ?? null,
              randomBloodSugar: bloodValues?.randomBloodSugar ?? null,
              totalCholesterol: bloodValues?.totalCholesterol ?? null,
              triglycerides: bloodValues?.triglycerides ?? null,
              hdlCholesterol: bloodValues?.hdlCholesterol ?? null,
              ldlCholesterol: bloodValues?.ldlCholesterol ?? null,
              bun: bloodValues?.bun ?? null,
              creatinine: bloodValues?.creatinine ?? null,
              uricAcid: bloodValues?.uricAcid ?? null,
              hemoglobin: bloodValues?.hemoglobin ?? null,
              bnp: bloodValues?.bnp ?? null,
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
              atOneMinBefore: cpx.atOneMinBefore || null,
              atDuring: cpx.atDuring || null,
              maxLoad: cpx.maxLoad || null,
              loadWeight: cpx.loadWeight || null,
              vo2: cpx.vo2 || null,
              mets: cpx.mets || null,
              heartRate: cpx.heartRate || null,
              systolicBloodPressure: cpx.systolicBloodPressure || null,
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

