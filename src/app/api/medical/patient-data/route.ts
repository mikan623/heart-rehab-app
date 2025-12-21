import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 医療従事者専用：承認済み患者のデータを取得
// GET: ?providerId=...&patientId=...

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const patientId = searchParams.get('patientId');

    if (!providerId || !patientId) {
      return NextResponse.json({ error: 'providerId and patientId are required' }, { status: 400 });
    }

    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { role: true },
    });
    if (!provider || provider.role !== 'medical') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const access = await prisma.medicalInvite.findUnique({
      where: { providerId_patientId: { providerId, patientId } },
      select: { status: true },
    });
    if (!access || access.status !== 'accepted') {
      return NextResponse.json({ error: 'Not approved' }, { status: 403 });
    }

    const [records, bloodDataList] = await Promise.all([
      prisma.healthRecord.findMany({
        where: { userId: patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          medicalComments: {
            orderBy: { createdAt: 'asc' },
            include: {
              provider: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.bloodData.findMany({
        where: { userId: patientId },
        orderBy: { createdAt: 'desc' },
        include: {
          cpxTests: { orderBy: { createdAt: 'asc' } },
        },
      }),
    ]);

    // healthRecords を既存の /api/health-records と同じ形に整形
    const formattedRecords = records.map((record: any) => ({
      id: record.id,
      date: record.date,
      time: record.time,
      bloodPressure: {
        systolic: record.bloodPressureSystolic,
        diastolic: record.bloodPressureDiastolic,
      },
      pulse: record.pulse,
      weight: record.weight,
      exercise: record.exercise,
      meal: record.meal,
      dailyLife: record.dailyLife,
      medicationTaken: record.medicationTaken,
      createdAt: record.createdAt,
      medicalComments: (record.medicalComments || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        provider: {
          id: c.provider?.id,
          name: c.provider?.name ?? null,
          email: c.provider?.email,
        },
      })),
    }));

    return NextResponse.json({ records: formattedRecords, bloodDataList });
  } catch (error: any) {
    console.error('❌ /api/medical/patient-data GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


