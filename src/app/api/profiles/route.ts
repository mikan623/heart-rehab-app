import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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
    
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    
    const userId = auth.userId;
    
    
    const profile = await prisma.profile.findFirst({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json({ profile: null, message: 'Profile not found' });
    }
    
    return NextResponse.json({ profile });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Profile fetch error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch profile',
      details: message
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
    
    if (!prisma) return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    
    const { userId: bodyUserId, profile } = await request.json();
    const userId = auth.userId;
    if (bodyUserId && bodyUserId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    
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
    
    const profileData = {
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
    };

    const existingProfile = await prisma.profile.findFirst({ where: { userId } });

    const savedProfile = existingProfile
      ? await prisma.profile.update({ where: { id: existingProfile.id }, data: profileData })
      : await prisma.profile.create({ data: { userId, ...profileData } });
    
    return NextResponse.json({ 
      success: true,
      profile: savedProfile
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Profile save error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to save profile',
      details: message
    }, { status: 500 });
  }
}