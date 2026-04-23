import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import CalendarClient from './CalendarClient';

type HealthRecord = {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  exercise: { type: string; duration: string };
  weight: string;
  meal: { staple: string[]; mainDish: string[]; sideDish: string[]; other: string };
  dailyLife?: string;
  medicationTaken?: boolean;
};

type SavedRecords = Record<string, Record<string, HealthRecord>>;

export default async function CalendarPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/?returnTo=/calendar');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/?returnTo=/calendar');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();
  let initialSavedRecords: SavedRecords = {};
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

    for (const r of records) {
      const dateKey = r.date.split('T')[0];
      const timeKey = r.time;
      if (!initialSavedRecords[dateKey]) initialSavedRecords[dateKey] = {};
      initialSavedRecords[dateKey][timeKey] = {
        bloodPressure: {
          systolic: String(r.bloodPressureSystolic),
          diastolic: String(r.bloodPressureDiastolic),
        },
        pulse: r.pulse != null ? String(r.pulse) : '',
        weight: r.weight != null ? String(r.weight) : '',
        exercise: (r.exercise as { type?: string; duration?: string } | null)
          ? { type: (r.exercise as { type?: string }).type ?? '', duration: (r.exercise as { duration?: string }).duration ?? '' }
          : { type: '', duration: '' },
        meal: (r.meal as { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null)
          ? {
              staple: (r.meal as { staple?: string[] }).staple ?? [],
              mainDish: (r.meal as { mainDish?: string[] }).mainDish ?? [],
              sideDish: (r.meal as { sideDish?: string[] }).sideDish ?? [],
              other: (r.meal as { other?: string }).other ?? '',
            }
          : { staple: [], mainDish: [], sideDish: [], other: '' },
        dailyLife: r.dailyLife ?? undefined,
        medicationTaken: r.medicationTaken ?? undefined,
      };
    }

    if (profile) {
      initialHeightCm = profile.height ?? null;
    }
  }

  return (
    <CalendarClient
      userId={userId}
      initialSavedRecords={initialSavedRecords}
      initialHeightCm={initialHeightCm}
    />
  );
}
