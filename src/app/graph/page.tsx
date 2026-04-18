import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import GraphClient from './GraphClient';

type HealthRecord = {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  weight: string;
  medicationTaken?: boolean;
  dailyLife?: string;
};

export default async function GraphPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();
  let initialSavedRecords: { [date: string]: { [time: string]: HealthRecord } } = {};
  let initialTargetWeight: number | null = null;
  let initialHeightCm: number | null = null;

  if (connected && prisma) {
    const [records, profile] = await Promise.all([
      prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.profile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    // 日付→時刻→記録 のマップに整形
    for (const r of records) {
      const date = r.date.includes('T') ? r.date.split('T')[0] : r.date.replace(/\//g, '-');
      const time = r.time || '08:00';
      if (!initialSavedRecords[date]) initialSavedRecords[date] = {};
      initialSavedRecords[date][time] = {
        bloodPressure: {
          systolic: String(r.bloodPressureSystolic),
          diastolic: String(r.bloodPressureDiastolic),
        },
        pulse: r.pulse != null ? String(r.pulse) : '',
        weight: r.weight != null ? String(r.weight) : '',
        medicationTaken: r.medicationTaken ?? undefined,
        dailyLife: r.dailyLife ?? undefined,
      };
    }

    if (profile) {
      initialTargetWeight = profile.targetWeight ?? null;
      initialHeightCm = profile.height ?? null;
    }
  }

  return (
    <GraphClient
      userId={userId}
      initialSavedRecords={initialSavedRecords}
      initialTargetWeight={initialTargetWeight}
      initialHeightCm={initialHeightCm}
    />
  );
}
