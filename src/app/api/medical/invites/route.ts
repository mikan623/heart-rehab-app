import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 医療従事者が患者へ招待を作成 / 一覧取得
// GET: ?providerId=... [&patientId=...]
// POST: { providerId, patientId }

export async function GET(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ invites: [], error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get('providerId');
    const patientId = searchParams.get('patientId');

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { role: true },
    });
    if (!provider || provider.role !== 'medical') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await prisma.medicalInvite.findMany({
      where: {
        providerId,
        ...(patientId ? { patientId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: {
        patient: {
          select: { id: true, email: true, name: true },
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
        patient: {
          id: i.patient.id,
          name: i.patient.name,
          email: i.patient.email,
        },
      })),
    });
  } catch (error: any) {
    console.error('❌ /api/medical/invites GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    const providerId = body?.providerId as string | undefined;
    const patientId = body?.patientId as string | undefined;

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

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // 既に存在する場合は status を pending に戻す（再招待）
    const invite = await prisma.medicalInvite.upsert({
      where: { providerId_patientId: { providerId, patientId } },
      create: { providerId, patientId, status: 'pending' },
      update: { status: 'pending' },
    });

    return NextResponse.json({ invite });
  } catch (error: any) {
    console.error('❌ /api/medical/invites POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


