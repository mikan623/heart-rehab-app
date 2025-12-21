import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 患者（利用者）側：招待メッセージ一覧
// GET: ?patientId=...

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ invites: [], error: 'Database not available' }, { status: 503 });
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
    if (!patient || patient.role !== 'patient') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await prisma.medicalInvite.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        provider: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      invites: invites.map((i) => ({
        id: i.id,
        providerId: i.providerId,
        patientId: i.patientId,
        status: i.status,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt,
        provider: {
          id: i.provider.id,
          name: i.provider.name,
          email: i.provider.email,
        },
      })),
    });
  } catch (error: any) {
    console.error('❌ /api/patient/invites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


