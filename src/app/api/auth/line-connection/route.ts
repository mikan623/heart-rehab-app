import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

/**
 * LINE 連携状態を取得
 * GET /api/auth/line-connection?userId=...
 */
export async function GET(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        lineConnected: false,
        message: 'Database not available' 
      });
    }
    
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
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
    
  } catch (error: any) {
    console.error('❌ LINE 連携状態取得エラー:', error);
    return NextResponse.json({ 
      lineConnected: false,
      error: error.message 
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
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { userId, lineConnected, lineUserId } = await request.json();
    
    console.log('💾 LINE 連携状態を更新:', { userId, lineConnected, lineUserId });
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // ユーザーが存在するかチェック
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('👤 ユーザーが見つかりません、作成します:', userId);
      // ユーザーが存在しない場合は作成
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          name: 'User',
          authType: 'line'
        }
      });
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
    
  } catch (error: any) {
    console.error('❌ LINE 連携状態更新エラー:', error);
    return NextResponse.json({ 
      error: 'Failed to update LINE connection status',
      details: error.message,
      success: false
    }, { status: 500 });
  }
}

