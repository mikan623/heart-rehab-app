import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAuthToken } from '@/lib/server-auth';
import prisma, { ensurePrismaConnection } from '@/lib/prisma';
import MessagesClient from './MessagesClient';

export default async function MessagesPage() {
  // ── 認証（サーバー側） ──────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  if (!token) redirect('/');

  const auth = verifyAuthToken(token);
  if (!auth) redirect('/');

  const { userId } = auth;

  // ── DB から初期データ取得 ──────────────────────────────
  const connected = await ensurePrismaConnection();

  let initialInvites: {
    id: string;
    providerId: string;
    patientId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    provider: { id: string; name: string | null; email: string };
  }[] = [];

  let initialComments: {
    id: string;
    content: string;
    createdAt: string;
    provider: { id: string; name: string | null; email: string };
    healthRecord: {
      id: string; date: string; time: string;
      bloodPressure: { systolic: number; diastolic: number };
      pulse: number | null; weight: number | null;
      exercise: { type?: string; duration?: string } | null;
      meal: { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null;
      dailyLife: string | null; medicationTaken: boolean | null;
    };
  }[] = [];

  let initialLabComments: {
    id: string;
    content: string;
    createdAt: string;
    provider: { id: string; name: string | null; email: string } | undefined;
    kind: 'blood' | 'cpx';
    bloodData: { testDate: string | null } | null;
    cpx: { testDate: string | null; parentBloodTestDate: string | null; cpxRound: number | null } | null;
  }[] = [];

  if (connected && prisma) {
    const [invitesResult, commentsResult, labCommentsResult] = await Promise.all([
      prisma.medicalInvite.findMany({
        where: { patientId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 200,
        include: { provider: { select: { id: true, name: true, email: true } } },
      }),
      prisma.medicalComment.findMany({
        where: { patientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          provider: { select: { id: true, name: true, email: true } },
          healthRecord: {
            select: {
              id: true, date: true, time: true,
              bloodPressureSystolic: true, bloodPressureDiastolic: true,
              pulse: true, weight: true, exercise: true, meal: true,
              dailyLife: true, medicationTaken: true,
            },
          },
        },
      }),
      prisma.medicalLabComment.findMany({
        where: { patientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
          provider: { select: { id: true, name: true, email: true } },
          bloodData: true,
          cpxTest: { include: { bloodData: true } },
        },
      }),
    ]);

    initialInvites = invitesResult.map((i) => ({
      id: i.id,
      providerId: i.providerId,
      patientId: i.patientId,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      provider: { id: i.provider.id, name: i.provider.name, email: i.provider.email },
    }));

    initialComments = commentsResult.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      provider: { id: c.provider.id, name: c.provider.name, email: c.provider.email },
      healthRecord: {
        id: c.healthRecord.id,
        date: c.healthRecord.date,
        time: c.healthRecord.time,
        bloodPressure: {
          systolic: c.healthRecord.bloodPressureSystolic,
          diastolic: c.healthRecord.bloodPressureDiastolic,
        },
        pulse: c.healthRecord.pulse,
        weight: c.healthRecord.weight,
        exercise: c.healthRecord.exercise as { type?: string; duration?: string } | null,
        meal: c.healthRecord.meal as { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null,
        dailyLife: c.healthRecord.dailyLife,
        medicationTaken: c.healthRecord.medicationTaken,
      },
    }));

    initialLabComments = labCommentsResult.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      provider: c.provider
        ? { id: c.provider.id, name: c.provider.name, email: c.provider.email }
        : undefined,
      kind: (c.bloodDataId ? 'blood' : 'cpx') as 'blood' | 'cpx',
      bloodData: c.bloodData ? { testDate: c.bloodData.testDate } : null,
      cpx: c.cpxTest
        ? {
            testDate: c.cpxTest.testDate,
            cpxRound: c.cpxTest.cpxRound,
            parentBloodTestDate: c.cpxTest.bloodData?.testDate ?? null,
          }
        : null,
    }));
  }

  return (
    <MessagesClient
      userId={userId}
      initialInvites={initialInvites}
      initialComments={initialComments}
      initialLabComments={initialLabComments}
    />
  );
}
