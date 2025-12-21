import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 利用者側：未読数（招待pending + messagesLastSeen以降のコメント）をまとめて返す
// GET: ?patientId=...&since=UnixMs

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ total: 0, error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const sinceStr = searchParams.get('since') || '0';
    const sinceMs = Number(sinceStr);
    const since = Number.isFinite(sinceMs) && sinceMs > 0 ? new Date(sinceMs) : new Date(0);

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

    const [pendingInvites, unreadHealthComments, unreadLabComments] = await Promise.all([
      prisma.medicalInvite.count({ where: { patientId, status: 'pending' } }),
      prisma.medicalComment.count({ where: { patientId, createdAt: { gt: since } } }),
      prisma.medicalLabComment.count({ where: { patientId, createdAt: { gt: since } } }),
    ]);

    const total = pendingInvites + unreadHealthComments + unreadLabComments;

    return NextResponse.json({
      total,
      breakdown: {
        pendingInvites,
        unreadHealthComments,
        unreadLabComments,
      },
    });
  } catch (error: any) {
    console.error('❌ /api/patient/unread-count GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


