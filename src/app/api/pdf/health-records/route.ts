import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import prisma from '@/lib/prisma';
import { getAuthContext } from '@/lib/server-auth';
import {
  HealthRecordPdfDocument,
  type PdfHealthRecord,
  type PdfMonthSummary,
} from '@/components/pdf/HealthRecordPdfDocument';

export const dynamic = 'force-dynamic';

function buildMealSummary(meal: unknown): string | null {
  if (!meal || typeof meal !== 'object') return null;
  const m = meal as Record<string, unknown>;
  const parts: string[] = [];
  const join = (v: unknown) =>
    Array.isArray(v) ? v.filter(Boolean).join('・') : typeof v === 'string' ? v : '';
  if (join(m.staple)) parts.push(`主食:${join(m.staple)}`);
  if (join(m.mainDish)) parts.push(`主菜:${join(m.mainDish)}`);
  if (join(m.sideDish)) parts.push(`副菜:${join(m.sideDish)}`);
  return parts.length > 0 ? parts.join(' ') : null;
}

function calcSummary(records: PdfHealthRecord[], month: string): PdfMonthSummary {
  const inMonth = records.filter((r) => r.date.startsWith(month));
  const totalDays = new Set(inMonth.map((r) => r.date)).size;

  const avg = (vals: number[]) =>
    vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;

  const systolicVals = inMonth.map((r) => r.systolic);
  const diastolicVals = inMonth.map((r) => r.diastolic);
  const pulseVals = inMonth.filter((r) => r.pulse != null).map((r) => r.pulse!);
  const weightVals = inMonth.filter((r) => r.weight != null).map((r) => r.weight!);

  const exerciseDays = new Set(
    inMonth.filter((r) => r.exerciseType).map((r) => r.date)
  ).size;

  const medicationDays = new Set(
    inMonth.filter((r) => r.medicationTaken).map((r) => r.date)
  ).size;

  return {
    month,
    avgSystolic: avg(systolicVals),
    avgDiastolic: avg(diastolicVals),
    avgPulse: avg(pulseVals),
    avgWeight: avg(weightVals),
    exerciseDays,
    medicationDays,
    totalDays,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!prisma) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7); // "2026-05"

    const userId = auth.userId;

    // 対象月の初日〜末日
    const [year, mon] = month.split('-').map(Number);
    const from = new Date(year, mon - 1, 1);
    const to = new Date(year, mon, 1);

    const [profile, rawRecords, bloodDataList] = await Promise.all([
      prisma.profile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.healthRecord.findMany({
        where: { userId, createdAt: { gte: from, lt: to } },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      }),
      prisma.bloodData.findMany({
        where: { userId },
        orderBy: { testDate: 'desc' },
        include: {
          cpxTests: { orderBy: { testDate: 'desc' } },
        },
      }),
    ]);

    const records: PdfHealthRecord[] = rawRecords.map((r) => {
      const ex = r.exercise as { type?: string; duration?: string } | null;
      return {
        date: r.date,
        time: r.time,
        systolic: r.bloodPressureSystolic,
        diastolic: r.bloodPressureDiastolic,
        pulse: r.pulse,
        weight: r.weight,
        exerciseType: ex?.type ?? null,
        exerciseDuration: ex?.duration ?? null,
        mealSummary: buildMealSummary(r.meal),
        medicationTaken: r.medicationTaken,
        dailyLife: r.dailyLife,
      };
    });

    const summary = calcSummary(records, month);

    const createdAt = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

    const pdfElement = React.createElement(HealthRecordPdfDocument, {
      profile: {
        displayName: profile?.displayName,
        age: profile?.age,
        gender: profile?.gender,
        height: profile?.height,
        targetWeight: profile?.targetWeight,
        diseases: profile?.diseases ?? [],
        riskFactors: profile?.riskFactors ?? [],
        medications: profile?.medications,
        physicalFunction: profile?.physicalFunction,
        emergencyContact: profile?.emergencyContact,
      },
      records,
      bloodDataList: bloodDataList.map((b) => ({
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
          testDate: c.testDate,
          cpxRound: c.cpxRound,
          loadWeight: c.loadWeight,
          vo2: c.vo2,
          mets: c.mets,
          heartRate: c.heartRate,
          systolicBloodPressure: c.systolicBloodPressure,
          atDuring: c.atDuring,
          findings: c.findings,
        })),
      })),
      summary,
      createdAt,
    // renderToBuffer は Document 要素を直接期待するが、ラッパー経由のため型キャスト
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(pdfElement);

    const filename = `心臓リハビリ手帳_${month}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('❌ PDF generation error:', error);
    return NextResponse.json({ error: 'PDF生成に失敗しました' }, { status: 500 });
  }
}
