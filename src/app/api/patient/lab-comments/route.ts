import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

// 利用者側：血液/CPXへの医療コメント通知一覧
// GET: ?patientId=...

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json(
        { comments: [], error: 'Database not available' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const patientId = auth.userId;

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { role: true },
    });
    // medicalアカウントでも利用者モードでメッセージ閲覧できるようにする
    if (!patient || (patient.role !== 'patient' && patient.role !== 'medical')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    }

    const comments = await prisma.medicalLabComment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        provider: { select: { id: true, name: true, email: true } },
        bloodData: true,
        cpxTest: {
          include: {
            bloodData: true,
          },
        },
      },
    });

    return NextResponse.json({
      comments: comments.map((c: any) => ({
        id: c.id,
        createdAt: c.createdAt,
        content: c.content,
        provider: c.provider,
        kind: c.bloodDataId ? 'blood' : 'cpx',
        bloodData: c.bloodData
          ? {
              id: c.bloodData.id,
              testDate: c.bloodData.testDate,
              values: {
                hbA1c: c.bloodData.hbA1c,
                randomBloodSugar: c.bloodData.randomBloodSugar,
                totalCholesterol: c.bloodData.totalCholesterol,
                triglycerides: c.bloodData.triglycerides,
                hdlCholesterol: c.bloodData.hdlCholesterol,
                ldlCholesterol: c.bloodData.ldlCholesterol,
                bun: c.bloodData.bun,
                creatinine: c.bloodData.creatinine,
                uricAcid: c.bloodData.uricAcid,
                hemoglobin: c.bloodData.hemoglobin,
                bnp: c.bloodData.bnp,
              },
            }
          : null,
        cpx: c.cpxTest
          ? {
              id: c.cpxTest.id,
              testDate: c.cpxTest.testDate,
              cpxRound: c.cpxTest.cpxRound,
              values: {
                loadWeight: c.cpxTest.loadWeight,
                vo2: c.cpxTest.vo2,
                mets: c.cpxTest.mets,
                heartRate: c.cpxTest.heartRate,
                systolicBloodPressure: c.cpxTest.systolicBloodPressure,
                findings: c.cpxTest.findings,
              },
              parentBloodTestDate: c.cpxTest.bloodData?.testDate || null,
            }
          : null,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('❌ /api/patient/lab-comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}


