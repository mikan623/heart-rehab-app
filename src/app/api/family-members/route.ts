import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

// 家族メンバー一覧取得
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ 
        familyMembers: [],
        message: 'Database not available' 
      });
    }
    
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    
    const userId = auth.userId;
    
    console.log('🔍 Fetching family members for userId:', userId);
    
    // 家族メンバーを取得
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('📊 Found family members:', familyMembers.length);
    
    return NextResponse.json({ familyMembers });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Family members fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch family members',
      details: message 
    }, { status: 500 });
  }
}

// 家族メンバー追加・更新
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
    
    const { userId: bodyUserId, familyMember } = await request.json();
    const userId = auth.userId;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    console.log('💾 Saving family member for userId:', userId);
    console.log('📝 Family member data:', familyMember);
    
    // ✅ 修正：初期追加時は name・relationship が空でもOK
    // （ユーザーが後から入力する）
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 重複チェック（メール）
    if (familyMember.email) {
      const existingByEmail = await prisma.familyMember.findFirst({
        where: {
          userId,
          email: familyMember.email,
        },
      });
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'このメールアドレスはすでに家族として登録されています。' },
          { status: 409 }
        );
      }
    }

    // 重複チェック（LINE userId）
    if (familyMember.lineUserId) {
      const existingByLineId = await prisma.familyMember.findFirst({
        where: {
          userId,
          lineUserId: familyMember.lineUserId,
        },
      });
      if (existingByLineId) {
        return NextResponse.json(
          { error: 'このLINEアカウントはすでに家族として登録されています。' },
          { status: 409 }
        );
      }
    }
    
    // linkCode を生成（ユーザー別に一意）
    let linkCode: string | null = null;
    const generateCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
    let tries = 0;
    while (!linkCode && tries < 5) {
      const candidate = generateCode();
      const exists = await prisma.familyMember.findFirst({
        where: { userId, linkCode: candidate },
      });
      if (!exists) linkCode = candidate;
      tries += 1;
    }
    
    // 家族メンバーを作成
    const savedFamilyMember = await prisma.familyMember.create({
      data: {
        userId,
        name: familyMember.name || '',
        email: familyMember.email || '',
        relationship: familyMember.relationship || '',
        // lineUserId は Webhook 経由で登録するためここでは保存しない
        lineUserId: null,
        isRegistered: false,
        linkCode,
      }
    });
    
    console.log('✅ Family member saved successfully:', savedFamilyMember.id);
    
    return NextResponse.json({ 
      success: true,
      familyMember: savedFamilyMember
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Family member save error:', error);

    // 一意制約違反（保険）
    if (isRecord(error) && error.code === 'P2002') {
      return NextResponse.json(
        { error: '同じ家族情報が既に登録されています。' },
        { status: 409 }
      );
    }

    return NextResponse.json({ 
      error: 'Failed to save family member',
      details: message 
    }, { status: 500 });
  }
}

// 家族メンバー更新
export async function PATCH(request: NextRequest) {
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
    
    const { memberId, ...updates } = await request.json();
    
    console.log('🔄 Updating family member:', memberId);
    
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }
    
    const existing = await prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updatedMember = await prisma.familyMember.update({
      where: { id: memberId },
      data: updates,
    });
    
    console.log('✅ Family member updated successfully');
    
    return NextResponse.json({ 
      success: true,
      familyMember: updatedMember
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Family member update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update family member',
      details: message 
    }, { status: 500 });
  }
}

// 家族メンバー削除
export async function DELETE(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }
    
    console.log('🗑️ Deleting family member:', memberId);
    
    const existing = await prisma.familyMember.findUnique({
      where: { id: memberId },
      select: { id: true, userId: true },
    });
    if (!existing || existing.userId !== auth.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.familyMember.delete({
      where: { id: memberId },
    });
    
    console.log('✅ Family member deleted successfully');
    
    return NextResponse.json({ success: true });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Family member delete error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete family member',
      details: message 
    }, { status: 500 });
  }
}