import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 利用者側：医療従事者からのコメント通知一覧
// GET: ?patientId=...

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json(
        { comments: [], error: 'Database not available' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    if (!patientId) {
      return NextResponse.json({ error: 'patientId is required' }, { status: 400 });
    }

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
            systolic: (c.healthRecord as any).bloodPressureSystolic,
            diastolic: (c.healthRecord as any).bloodPressureDiastolic,
          },
          pulse: (c.healthRecord as any).pulse ?? null,
          weight: (c.healthRecord as any).weight ?? null,
          exercise: (c.healthRecord as any).exercise ?? null,
          meal: (c.healthRecord as any).meal ?? null,
          dailyLife: (c.healthRecord as any).dailyLife ?? null,
          medicationTaken: (c.healthRecord as any).medicationTaken ?? null,
        },
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    console.error('❌ /api/patient/comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}


