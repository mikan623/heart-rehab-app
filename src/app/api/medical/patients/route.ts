import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
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
    const connected = await ensurePrismaConnection();

    if (!connected || !prisma) {
      console.log('⚠️ Database not available for medical patients search');
      return NextResponse.json(
        { error: 'Database not available', patients: [] },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();

    if (!name) {
      // 名前未入力時は空配列を返す（エラーにはしない）
      return NextResponse.json({ patients: [] });
    }

    console.log('🔍 Searching patients by name (Profile.displayName / User.name):', name);

    const profiles = await prisma.profile.findMany({
      where: {
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
            email: true,
          },
        },
      },
    });

    const patients = profiles.map((p) => ({
      userId: p.userId,
      displayName: p.displayName || p.user?.name || null,
      age: p.age,
      gender: p.gender,
      email: p.user?.email || null,
    }));

    console.log('📋 Patients found:', patients.length);

    return NextResponse.json({ patients });
  } catch (error: any) {
    console.error('❌ Medical patients search API error:', {
      message: error?.message,
      stack: error?.stack,
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


