import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (auth.role !== 'medical') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prisma 接続確認
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });

    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();

    if (!name) {
      // 名前未入力時は空配列を返す（エラーにはしない）
      return NextResponse.json({ patients: [] });
    }

    const providerId = auth.userId;

    const acceptedInvites = await prisma.medicalInvite.findMany({
      where: { providerId, status: 'accepted' },
      select: { patientId: true },
    });

    const acceptedPatientIds = acceptedInvites.map((i) => i.patientId);

    if (!acceptedPatientIds.length) {
      return NextResponse.json({ patients: [] });
    }

    console.log('🔍 Searching patients by name (Profile.displayName / User.name):', name);

    const profiles = await prisma.profile.findMany({
      where: {
        userId: { in: acceptedPatientIds }, // 承認済み患者のみを対象にする
        OR: [
          {
            displayName: {
              contains: name,
              mode: 'insensitive',
            },
          },
          {
            user: {
              name: {
                contains: name,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 50,
      select: {
        userId: true,
        displayName: true,
        age: true,
        gender: true,
        user: {
          select: {
            name: true,
            // email: true,
          },
        },
      },
    });

    const patients = profiles.map((p) => ({
      userId: p.userId,
      displayName: p.displayName || p.user?.name || null,
      age: p.age,
      gender: p.gender,
      // email: p.user?.email || null,
    }));

    console.log('📋 Patients found:', patients.length);

    return NextResponse.json({ patients });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('❌ Medical patients search API error:', {
      message,
      stack,
    });

    return NextResponse.json(
      {
        error: 'Failed to search patients',
        patients: [],
      },
      { status: 500 }
    );
  }
}


