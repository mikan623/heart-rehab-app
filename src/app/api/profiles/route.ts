import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';

// プロフィール取得
export async function GET(request: NextRequest) {
  try {
    // Prismaが無効の場合は早期終了
    if (!prisma) {
      return NextResponse.json({ 
        profile: null, 
        message: 'Database not available' 
      });
    }
    
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
    // Prismaが無効の場合は早期終了
    if (!prisma) {
      return NextResponse.json({ 
        error: 'Database not available',
        message: 'Using local storage mode'
      }, { status: 503 });
    }
    
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
          // LINE ログイン時に取得したメールがあればそれを優先して保存
          email: profile.email || `${userId}@example.com`,
          name: profile.displayName || `User ${userId}`
        }
      });
    } else if (profile.email || profile.displayName) {
      // 既存ユーザーの場合も、メールや名前が渡ってきたら更新
      user = await prisma.user.update({
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