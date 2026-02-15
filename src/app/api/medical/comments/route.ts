import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// 医療従事者：承認済み患者の健康記録にコメント投稿
// POST: { providerId, patientId, healthRecordId, content }

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (auth.role !== 'medical') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    const data = isRecord(body) ? body : {};
    const providerId = auth.userId;
    const patientId = typeof data.patientId === 'string' ? data.patientId : undefined;
    const healthRecordId = typeof data.healthRecordId === 'string' ? data.healthRecordId : undefined;
    const content = typeof data.content === 'string' ? data.content.trim() : undefined;

    if (!patientId || !healthRecordId || !content) {
      return NextResponse.json(
        { error: 'patientId, healthRecordId, content are required' },
        { status: 400 }
      );
    }
    if (content.length > 2000) {
      return NextResponse.json({ error: 'content is too long' }, { status: 400 });
    }

    const access = await prisma.medicalInvite.findUnique({
      where: { providerId_patientId: { providerId, patientId } },
      select: { status: true },
    });
    if (!access || access.status !== 'accepted') {
      return NextResponse.json({ error: 'Not approved' }, { status: 403 });
    }

    // healthRecord が患者のものか確認
    const record = await prisma.healthRecord.findUnique({
      where: { id: healthRecordId },
      select: { id: true, userId: true },
    });
    if (!record) {
      return NextResponse.json({ error: 'Health record not found' }, { status: 404 });
    }
    if (record.userId !== patientId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const created = await prisma.medicalComment.create({
      data: { providerId, patientId, healthRecordId, content },
    });

    return NextResponse.json({ success: true, comment: created });
  } catch (error: unknown) {
    console.error('❌ /api/medical/comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


