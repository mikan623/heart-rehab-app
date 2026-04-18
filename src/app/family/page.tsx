import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import FamilyClient from './FamilyClient';

export default async function FamilyPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();

  let initialFamilyMembers: {
    id: string;
    name: string;
    email: string;
    relationship: string;
    lineUserId?: string;
    isRegistered: boolean;
  }[] = [];
  let initialReminderEnabled = false;
  let initialReminderTime = '21:00';
  let initialSelfLinkCode: string | null = null;

  if (connected && prisma) {
    const [familyMembersResult, userResult] = await Promise.all([
      prisma.familyMember.findMany({ where: { userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { reminderEnabled: true, reminderTime: true, selfLinkCode: true },
      }),
    ]);

    initialFamilyMembers = familyMembersResult.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      relationship: m.relationship,
      lineUserId: m.lineUserId ?? undefined,
      isRegistered: m.isRegistered,
    }));

    if (userResult) {
      initialReminderEnabled = userResult.reminderEnabled ?? false;
      initialReminderTime = userResult.reminderTime ?? '21:00';
      initialSelfLinkCode = userResult.selfLinkCode ?? null;
    }
  }

  return (
    <FamilyClient
      userId={userId}
      initialFamilyMembers={initialFamilyMembers}
      initialReminderEnabled={initialReminderEnabled}
      initialReminderTime={initialReminderTime}
      initialSelfLinkCode={initialSelfLinkCode}
    />
  );
}
