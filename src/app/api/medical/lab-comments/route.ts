import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 医療従事者：承認済み患者の血液/CPXにコメント投稿
// POST: { providerId, patientId, kind: "blood" | "cpx", targetId, content }

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    const providerId = body?.providerId as string | undefined;
    const patientId = body?.patientId as string | undefined;
    const kind = body?.kind as 'blood' | 'cpx' | undefined;
    const targetId = body?.targetId as string | undefined;
    const content = (body?.content as string | undefined)?.trim();

    if (!providerId || !patientId || !kind || !targetId || !content) {
      return NextResponse.json(
        { error: 'providerId, patientId, kind, targetId, content are required' },
        { status: 400 }
      );
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'content is too long' }, { status: 400 });
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

    if (kind === 'blood') {
      const blood = await prisma.bloodData.findUnique({
        where: { id: targetId },
        select: { id: true, userId: true },
      });
      if (!blood) return NextResponse.json({ error: 'BloodData not found' }, { status: 404 });
      if (blood.userId !== patientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const created = await prisma.medicalLabComment.create({
        data: { providerId, patientId, bloodDataId: targetId, content },
      });
      return NextResponse.json({ success: true, comment: created });
    }

    const cpx = await prisma.cardiopulmonaryExerciseTest.findUnique({
      where: { id: targetId },
      select: { id: true, bloodData: { select: { userId: true } } },
    });
    if (!cpx) return NextResponse.json({ error: 'CPX test not found' }, { status: 404 });
    if (cpx.bloodData.userId !== patientId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const created = await prisma.medicalLabComment.create({
      data: { providerId, patientId, cpxTestId: targetId, content },
    });
    return NextResponse.json({ success: true, comment: created });
  } catch (error: any) {
    console.error('❌ /api/medical/lab-comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


