import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma from '@/lib/prisma';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/?returnTo=/profile');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/?returnTo=/profile');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  if (!prisma) return null;
  let initialProfile = null;

  if (prisma) {
    try {
      initialProfile = await prisma.profile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      });
    } catch (e) {
      console.error('profile DB fetch failed:', e);
    }
  }

  return (
    <ProfileClient
      userId={userId}
      initialProfile={initialProfile}
    />
  );
}
