import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import HealthRecordsClient from './HealthRecordsClient';

export default async function HealthRecordsPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/?returnTo=/health-records');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/?returnTo=/health-records');

  const { userId } = auth;

  // ── DB から初期データを並行取得 ──────────────────────────
  const connected = await ensurePrismaConnection();

  let profile = null;
  let healthRecords: {
    id: string; date: string; time: string;
    bloodPressure: { systolic: number; diastolic: number };
    pulse: number | null; weight: number | null;
    exercise: unknown; dailyLife: string | null; medicationTaken: boolean | null;
  }[] = [];
  let bloodData: {
    id: string; testDate: string;
    hbA1c: number | null; randomBloodSugar: number | null;
    totalCholesterol: number | null; triglycerides: number | null;
    hdlCholesterol: number | null; ldlCholesterol: number | null;
    bun: number | null; creatinine: number | null; uricAcid: number | null;
    hemoglobin: number | null; bnp: number | null;
    cpxTests: {
      id: string; testDate: string; cpxRound: number;
      atOneMinBefore: number | null; atDuring: number | null;
      maxLoad: number | null; loadWeight: number | null;
      vo2: number | null; mets: number | null;
      heartRate: number | null; systolicBloodPressure: number | null;
      findings: string | null;
    }[];
  }[] = [];

  if (connected && prisma) {
    const [profileResult, recordsResult, bloodResult] = await Promise.all([
      prisma.profile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.healthRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bloodData.findMany({
        where: { userId },
        include: { cpxTests: { orderBy: { createdAt: 'desc' } } },
        orderBy: { testDate: 'desc' },
      }),
    ]);

    profile = profileResult;
    healthRecords = recordsResult.map((r) => ({
      id: r.id,
      date: r.date,
      time: r.time,
      bloodPressure: {
        systolic: r.bloodPressureSystolic,
        diastolic: r.bloodPressureDiastolic,
      },
      pulse: r.pulse,
      weight: r.weight,
      exercise: r.exercise,
      dailyLife: r.dailyLife,
      medicationTaken: r.medicationTaken,
    }));
    bloodData = bloodResult.map((b) => ({
      id: b.id,
      testDate: b.testDate,
      hbA1c: b.hbA1c,
      randomBloodSugar: b.randomBloodSugar,
      totalCholesterol: b.totalCholesterol,
      triglycerides: b.triglycerides,
      hdlCholesterol: b.hdlCholesterol,
      ldlCholesterol: b.ldlCholesterol,
      bun: b.bun,
      creatinine: b.creatinine,
      uricAcid: b.uricAcid,
      hemoglobin: b.hemoglobin,
      bnp: b.bnp,
      cpxTests: b.cpxTests.map((c) => ({
        id: c.id,
        testDate: c.testDate,
        cpxRound: c.cpxRound,
        atOneMinBefore: c.atOneMinBefore,
        atDuring: c.atDuring,
        maxLoad: c.maxLoad,
        loadWeight: c.loadWeight,
        vo2: c.vo2,
        mets: c.mets,
        heartRate: c.heartRate,
        systolicBloodPressure: c.systolicBloodPressure,
        findings: c.findings,
      })),
    }));
  }

  return (
    <HealthRecordsClient
      userId={userId}
      displayName={profile?.displayName ?? ''}
      initialProfile={profile ? { ...profile } : null}
      initialRecords={healthRecords}
      initialBloodData={bloodData}
    />
  );
}
