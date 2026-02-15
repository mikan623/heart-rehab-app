import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// GET /api/reminder-settings?userId=...
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = auth.userId;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Reminder settings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 },
    );
  }
}

// POST /api/reminder-settings
// Body: { userId, reminderEnabled, reminderTime }
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = isRecord(body) ? body : {};
    const bodyUserId = typeof data.userId === 'string' ? data.userId : undefined;
    const reminderEnabled = typeof data.reminderEnabled === 'boolean' ? data.reminderEnabled : undefined;
    const reminderTime = typeof data.reminderTime === 'string' ? data.reminderTime : undefined;
    const userId = auth.userId;

    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connected = await ensurePrismaConnection();
    if (!connected || !prisma) {
      console.warn('⚠️ Database not available for reminder settings save');
      return NextResponse.json(
        { error: 'Database not available', success: false },
        { status: 503 },
      );
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Reminder settings POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? message : undefined },
      { status: 500 },
    );
  }
}








