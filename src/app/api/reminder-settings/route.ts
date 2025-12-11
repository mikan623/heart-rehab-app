import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// GET /api/reminder-settings?userId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for reminder settings');
      // DBがない場合でも画面が動くようにデフォルト値を返す
      return NextResponse.json({
        reminderEnabled: false,
        reminderTime: '21:00',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reminderEnabled: true, reminderTime: true },
    });

    if (!user) {
      return NextResponse.json({
        reminderEnabled: false,
        reminderTime: '21:00',
      });
    }

    return NextResponse.json({
      reminderEnabled: user.reminderEnabled ?? false,
      reminderTime: user.reminderTime || '21:00',
    });
  } catch (error: any) {
    console.error('❌ Reminder settings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 },
    );
  }
}

// POST /api/reminder-settings
// Body: { userId, reminderEnabled, reminderTime }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, reminderEnabled, reminderTime } = body as {
      userId?: string;
      reminderEnabled?: boolean;
      reminderTime?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for reminder settings save');
      return NextResponse.json(
        { error: 'Database not available', success: false },
        { status: 503 },
      );
    }

    // ユーザーが存在しない場合は作成
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          name: 'User',
          authType: 'line',
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        reminderEnabled: !!reminderEnabled,
        reminderTime: reminderTime || '21:00',
      },
      select: {
        id: true,
        reminderEnabled: true,
        reminderTime: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('❌ Reminder settings POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
      { status: 500 },
    );
  }
}



