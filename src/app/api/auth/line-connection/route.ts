import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

/**
 * LINE 連携状態を取得
 * GET /api/auth/line-connection?userId=...
 */
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ 
        lineConnected: false,
        message: 'Database not available' 
      });
    }
    
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    
    const userId = auth.userId;
    
    console.log('🔍 LINE 連携状態を取得:', userId);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lineConnected: true, lineUserId: true }
    });
    
    if (!user) {
      return NextResponse.json({ 
        lineConnected: false,
        lineUserId: null 
      });
    }
    
    console.log('✅ LINE 連携状態:', user.lineConnected);
    
    return NextResponse.json({ 
      lineConnected: user.lineConnected || false,
      lineUserId: user.lineUserId || null
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ LINE 連携状態取得エラー:', error);
    return NextResponse.json({ 
      lineConnected: false,
      error: message 
    }, { status: 500 });
  }
}

/**
 * LINE 連携状態を更新
 * POST /api/auth/line-connection
 * Body: { userId, lineConnected, lineUserId }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    
    const { userId: bodyUserId, lineConnected, lineUserId } = await request.json();
    const userId = auth.userId;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    console.log('💾 LINE 連携状態を更新:', { userId, lineConnected, lineUserId });
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // LINE 連携状態を更新
    // ⚠️ authType は更新しない（既存の authType を保持して、LINE連携後もメールログイン可能にする）
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        lineConnected: lineConnected || false,
        lineUserId: lineUserId || null,
        // authType は変更しない
      },
      select: { id: true, lineConnected: true, lineUserId: true, authType: true }
    });
    
    console.log('✅ LINE 連携状態を更新成功:', updatedUser);
    
    return NextResponse.json({ 
      success: true,
      user: updatedUser
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ LINE 連携状態更新エラー:', error);
    return NextResponse.json({ 
      error: 'Failed to update LINE connection status',
      details: message,
      success: false
    }, { status: 500 });
  }
}

