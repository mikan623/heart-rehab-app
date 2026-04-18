import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import ProfileClient from './ProfileClient';

export default async function ProfilePage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();
  let initialProfile = null;

  if (connected && prisma) {
    initialProfile = await prisma.profile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  return (
    <ProfileClient
      userId={userId}
      initialProfile={initialProfile}
    />
  );
}
