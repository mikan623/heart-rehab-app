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
    
    if (!familyMember.name || !familyMember.relationship) {
      return NextResponse.json({ error: 'Name and relationship are required' }, { status: 400 });
    }
    
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
    
    // 家族メンバーを作成
    const savedFamilyMember = await prisma.familyMember.create({
      data: {
        userId,
        name: familyMember.name,
        relationship: familyMember.relationship,
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
    return NextResponse.json({ 
      error: 'Failed to save family member',
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