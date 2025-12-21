import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 患者（利用者）側：招待を承認/拒否
// POST: { patientId, inviteId, action } action: "accept" | "decline"

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    const patientId = body?.patientId as string | undefined;
    const inviteId = body?.inviteId as string | undefined;
    const action = body?.action as 'accept' | 'decline' | undefined;

    if (!patientId || !inviteId || (action !== 'accept' && action !== 'decline')) {
      return NextResponse.json({ error: 'patientId, inviteId, and action are required' }, { status: 400 });
    }

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { role: true },
    });
    if (!patient || patient.role !== 'patient') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invite = await prisma.medicalInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, patientId: true },
    });
    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (invite.patientId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.medicalInvite.update({
      where: { id: inviteId },
      data: { status: action === 'accept' ? 'accepted' : 'declined' },
    });

    return NextResponse.json({ success: true, invite: updated });
  } catch (error: any) {
    console.error('❌ /api/patient/invites/respond POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


