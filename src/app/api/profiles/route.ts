import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// プロフィール取得
export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnection();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('🔍 Fetching profile for userId:', userId);
    
    // プロフィールを取得（最新のものを1件）
    const profile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    
    if (!profile) {
      return NextResponse.json({ profile: null, message: 'Profile not found' });
    }
    
    console.log('📊 Profile found:', profile.id);
    
    return NextResponse.json({ profile });
    
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch profile',
      details: error.message 
    }, { status: 500 });
  }
}

// プロフィール保存・更新
export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnection();
    
    const { userId, profile } = await request.json();
    
    console.log('💾 Saving profile for userId:', userId);
    console.log('📝 Profile data:', profile);
    
    // バリデーション
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
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
          name: profile.displayName || `User ${userId}`
        }
      });
    }
    
    // 既存のプロフィールを確認
    const existingProfile = await prisma.profile.findFirst({
      where: { userId }
    });
    
    let savedProfile;
    
    if (existingProfile) {
      // 更新
      console.log('🔄 Updating existing profile:', existingProfile.id);
      savedProfile = await prisma.profile.update({
        where: { id: existingProfile.id },
        data: {
          displayName: profile.displayName || null,
          age: profile.age ? parseInt(profile.age) : null,
          gender: profile.gender || null,
          height: profile.height ? parseFloat(profile.height) : null,
          targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
          diseases: profile.diseases || [],
          medications: profile.medications || null,
          physicalFunction: profile.physicalFunction || null,
          emergencyContact: profile.emergencyContact || null,
        }
      });
    } else {
      // 新規作成
      console.log('✨ Creating new profile');
      savedProfile = await prisma.profile.create({
        data: {
          userId,
          displayName: profile.displayName || null,
          age: profile.age ? parseInt(profile.age) : null,
          gender: profile.gender || null,
          height: profile.height ? parseFloat(profile.height) : null,
          targetWeight: profile.targetWeight ? parseFloat(profile.targetWeight) : null,
          diseases: profile.diseases || [],
          medications: profile.medications || null,
          physicalFunction: profile.physicalFunction || null,
          emergencyContact: profile.emergencyContact || null,
        }
      });
    }
    
    console.log('✅ Profile saved successfully:', savedProfile.id);
    
    return NextResponse.json({ 
      success: true,
      profile: savedProfile
    });
    
  } catch (error: any) {
    console.error('❌ Profile save error:', error);
    return NextResponse.json({ 
      error: 'Failed to save profile',
      details: error.message 
    }, { status: 500 });
  }
}