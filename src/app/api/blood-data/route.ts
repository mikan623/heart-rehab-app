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
    const { userId, testDate, bloodValues, cpxTests } = data;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }
    
    // 血液データを作成
    const newBloodData = await prisma?.bloodData.create({
      data: {
        userId,
        testDate,
        hbA1c: bloodValues?.hbA1c || null,
        randomBloodSugar: bloodValues?.randomBloodSugar || null,
        totalCholesterol: bloodValues?.totalCholesterol || null,
        triglycerides: bloodValues?.triglycerides || null,
        hdlCholesterol: bloodValues?.hdlCholesterol || null,
        ldlCholesterol: bloodValues?.ldlCholesterol || null,
        bun: bloodValues?.bun || null,
        creatinine: bloodValues?.creatinine || null,
        uricAcid: bloodValues?.uricAcid || null,
        hemoglobin: bloodValues?.hemoglobin || null,
        bnp: bloodValues?.bnp || null,
      },
      include: {
        cpxTests: true
      }
    });
    
    // CPX検査データがあれば追加
    if (cpxTests && cpxTests.length > 0) {
      for (const cpx of cpxTests) {
        await prisma?.cardiopulmonaryExerciseTest.create({
          data: {
            bloodDataId: newBloodData.id,
            testDate: cpx.testDate,
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
    const { id, testDate, bloodValues, cpxTests } = data;
    
    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }
    
    // 血液データを更新
    const updatedBloodData = await prisma?.bloodData.update({
      where: { id },
      data: {
        testDate,
        hbA1c: bloodValues?.hbA1c || null,
        randomBloodSugar: bloodValues?.randomBloodSugar || null,
        totalCholesterol: bloodValues?.totalCholesterol || null,
        triglycerides: bloodValues?.triglycerides || null,
        hdlCholesterol: bloodValues?.hdlCholesterol || null,
        ldlCholesterol: bloodValues?.ldlCholesterol || null,
        bun: bloodValues?.bun || null,
        creatinine: bloodValues?.creatinine || null,
        uricAcid: bloodValues?.uricAcid || null,
        hemoglobin: bloodValues?.hemoglobin || null,
        bnp: bloodValues?.bnp || null,
      },
      include: {
        cpxTests: true
      }
    });
    
    // 既存のCPX検査を削除
    await prisma?.cardiopulmonaryExerciseTest.deleteMany({
      where: { bloodDataId: id }
    });
    
    // 新しいCPX検査データを追加
    if (cpxTests && cpxTests.length > 0) {
      for (const cpx of cpxTests) {
        await prisma?.cardiopulmonaryExerciseTest.create({
          data: {
            bloodDataId: id,
            testDate: cpx.testDate,
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
    
    return NextResponse.json(updatedBloodData);
  } catch (error) {
    console.error('❌ Error updating blood data:', error);
    return NextResponse.json(
      { error: 'Failed to update blood data' },
      { status: 500 }
    );
  }
}

