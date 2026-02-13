import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';

// プロフィール取得
export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prismaが無効の場合は早期終了
    if (!prisma) {
      return NextResponse.json({ 
        profile: null, 
        message: 'Database not available' 
      });
    }
    
    await ensurePrismaConnection();
    
    const userId = auth.userId;
    
    console.log('🔍 Fetching profile for userId:', userId);
    
    // プロフィールを取得（最新のものを1件）
    const profile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    
    if (!profile) {
      console.log('❌ Profile not found for userId:', userId);
      // デバッグ用：この userId に関連するすべてのプロフィールを取得
      const allProfiles = await prisma.profile.findMany({
        where: { userId },
      });
      console.log('📋 All profiles for this userId:', allProfiles.length, allProfiles);
      return NextResponse.json({ profile: null, message: 'Profile not found' });
    }
    
    console.log('📊 Profile found:', profile.id, profile);
    
    return NextResponse.json({ profile });
    
  } catch (error: any) {
    console.error('Profile fetch error:', error);
    
    const errorMessage = typeof error === 'object' ? (error?.message || 'Unknown error') : String(error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch profile',
      details: errorMessage
    }, { status: 500 });
  }
}

// プロフィール保存・更新
export async function POST(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prismaが無効の場合は早期終了
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        message: 'Using local storage mode'
      }, { status: 503 });
    }
    
    await ensurePrismaConnection();
    
    const { userId: bodyUserId, profile } = await request.json();
    const userId = auth.userId;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    console.log('💾 Saving profile for userId:', userId);
    console.log('📝 Profile data:', profile);
    
    // バリデーション
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (profile.email || profile.displayName) {
      // 既存ユーザーの場合も、メールや名前が渡ってきたら更新
      // ⚠️ authType は変更しない（LINE連携時に authType を保持する）
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: profile.email || user.email,
          name: profile.displayName || user.name,
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
          riskFactors: profile.riskFactors || [],
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
          riskFactors: profile.riskFactors || [],
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
    
    const errorMessage = typeof error === 'object' ? (error?.message || 'Unknown error') : String(error);
    
    return NextResponse.json({ 
      error: 'Failed to save profile',
      details: errorMessage
    }, { status: 500 });
  }
}