import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

// 患者（利用者）側：招待メッセージ一覧
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
        { invites: [], error: 'Database not available' },
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
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('❌ /api/patient/invites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}


