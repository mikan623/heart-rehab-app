import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import BloodDataClient from './BloodDataClient';

export default async function BloodDataPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/?returnTo=/blood-data');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/?returnTo=/blood-data');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();
  let initialBloodDataList: {
    id: string;
    testDate: string;
    hbA1c: number | null;
    randomBloodSugar: number | null;
    totalCholesterol: number | null;
    triglycerides: number | null;
    hdlCholesterol: number | null;
    ldlCholesterol: number | null;
    bun: number | null;
    creatinine: number | null;
    uricAcid: number | null;
    hemoglobin: number | null;
    bnp: number | null;
    createdAt: string;
    cpxTests: {
      id: string;
      testDate: string;
      cpxRound: number;
      atOneMinBefore: number | null;
      atDuring: number | null;
      maxLoad: number | null;
      loadWeight: number | null;
      vo2: number | null;
      mets: number | null;
      heartRate: number | null;
      systolicBloodPressure: number | null;
      findings: string | null;
    }[];
  }[] = [];

  if (connected && prisma) {
    const result = await prisma.bloodData.findMany({
      where: { userId },
      include: { cpxTests: { orderBy: { createdAt: 'desc' } } },
      orderBy: { testDate: 'desc' },
    });

    initialBloodDataList = result.map((b) => ({
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
      createdAt: b.createdAt.toISOString(),
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
    <BloodDataClient
      userId={userId}
      initialBloodDataList={initialBloodDataList}
    />
  );
}
