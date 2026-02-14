import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

// 利用者側：医療従事者からのコメント通知一覧
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

    const comments = await prisma.medicalComment.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        provider: { select: { id: true, name: true, email: true } },
        healthRecord: {
          select: {
            id: true,
            date: true,
            time: true,
            bloodPressureSystolic: true,
            bloodPressureDiastolic: true,
            pulse: true,
            weight: true,
            exercise: true,
            meal: true,
            dailyLife: true,
            medicationTaken: true,
          },
        },
      },
    });

    return NextResponse.json({
      comments: comments.map((c) => ({
        id: c.id,
        providerId: c.providerId,
        patientId: c.patientId,
        healthRecordId: c.healthRecordId,
        content: c.content,
        createdAt: c.createdAt,
        provider: {
          id: c.provider.id,
          name: c.provider.name,
          email: c.provider.email,
        },
        healthRecord: {
          id: c.healthRecord.id,
          date: c.healthRecord.date,
          time: c.healthRecord.time,
          bloodPressure: {
            systolic: c.healthRecord.bloodPressureSystolic,
            diastolic: c.healthRecord.bloodPressureDiastolic,
          },
          pulse: c.healthRecord.pulse ?? null,
          weight: c.healthRecord.weight ?? null,
          exercise: c.healthRecord.exercise ?? null,
          meal: c.healthRecord.meal ?? null,
          dailyLife: c.healthRecord.dailyLife ?? null,
          medicationTaken: c.healthRecord.medicationTaken ?? null,
        },
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('❌ /api/patient/comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}


