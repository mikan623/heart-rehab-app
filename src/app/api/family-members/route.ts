import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// 家族メンバー一覧取得
export async function GET(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        familyMembers: [],
        message: 'Database not available' 
      });
    }
    
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('🔍 Fetching family members for userId:', userId);
    
    // 家族メンバーを取得
    const familyMembers = await prisma.familyMember.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('📊 Found family members:', familyMembers.length);
    
    return NextResponse.json({ familyMembers });
    
  } catch (error: any) {
    console.error('Family members fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch family members',
      details: error.message 
    }, { status: 500 });
  }
}

// 家族メンバー追加・更新
export async function POST(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { userId, familyMember } = await request.json();
    
    console.log('💾 Saving family member for userId:', userId);
    console.log('📝 Family member data:', familyMember);
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // ✅ 修正：初期追加時は name・relationship が空でもOK
    // （ユーザーが後から入力する）
    
    // ユーザーが存在するかチェック、存在しない場合は作成
    let user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      console.log('👤 Creating new user:', userId);
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          name: `User ${userId}`
        }
      });
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
    
    // 家族メンバーを作成
    const savedFamilyMember = await prisma.familyMember.create({
      data: {
        userId,
        name: familyMember.name || '',
        email: familyMember.email || '',
        relationship: familyMember.relationship || '',
        lineUserId: familyMember.lineUserId || null,
        isRegistered: familyMember.isRegistered || false,
      }
    });
    
    console.log('✅ Family member saved successfully:', savedFamilyMember.id);
    
    return NextResponse.json({ 
      success: true,
      familyMember: savedFamilyMember
    });
    
  } catch (error: any) {
    console.error('❌ Family member save error:', error);

    // 一意制約違反（保険）
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '同じ家族情報が既に登録されています。' },
        { status: 409 }
      );
    }

    return NextResponse.json({ 
      error: 'Failed to save family member',
      details: error.message 
    }, { status: 500 });
  }
}

// 家族メンバー更新
export async function PATCH(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { memberId, ...updates } = await request.json();
    
    console.log('🔄 Updating family member:', memberId);
    
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }
    
    const updatedMember = await prisma.familyMember.update({
      where: { id: memberId },
      data: updates
    });
    
    console.log('✅ Family member updated successfully');
    
    return NextResponse.json({ 
      success: true,
      familyMember: updatedMember
    });
    
  } catch (error: any) {
    console.error('❌ Family member update error:', error);
    return NextResponse.json({ 
      error: 'Failed to update family member',
      details: error.message 
    }, { status: 500 });
  }
}

// 家族メンバー削除
export async function DELETE(request: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        success: false
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }
    
    console.log('🗑️ Deleting family member:', memberId);
    
    await prisma.familyMember.delete({
      where: { id: memberId }
    });
    
    console.log('✅ Family member deleted successfully');
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('❌ Family member delete error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete family member',
      details: error.message 
    }, { status: 500 });
  }
}