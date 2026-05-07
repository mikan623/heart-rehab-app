import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansJP',
  src: 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSansJP/hinted/ttf/NotoSansJP-Regular.ttf',
});

const S = StyleSheet.create({
  page:         { fontFamily: 'NotoSansJP', fontSize: 9, padding: 28, color: '#333' },
  center:       { textAlign: 'center' },
  h1:           { fontSize: 15, color: '#c2410c', textAlign: 'center', marginBottom: 3 },
  h2:           { fontSize: 10, color: '#c2410c', marginTop: 10, marginBottom: 4 },
  sub:          { fontSize: 8, color: '#666', textAlign: 'center', marginBottom: 2 },
  section:      { border: '1pt solid #ccc', padding: 8, marginBottom: 6, borderRadius: 2 },
  row2col:      { flexDirection: 'row', flexWrap: 'wrap' },
  col2:         { width: '50%', marginBottom: 3 },
  label:        { color: '#555', fontFamily: 'NotoSansJP' },
  summaryBox:   { border: '2pt solid #f87171', backgroundColor: '#fff7f7', padding: 8, marginBottom: 8, borderRadius: 3 },
  summaryGrid:  { flexDirection: 'row', flexWrap: 'wrap' },
  summaryCell:  { width: '33%', alignItems: 'center', marginBottom: 6 },
  summaryVal:   { fontSize: 13, color: '#c2410c' },
  summaryLbl:   { fontSize: 7, color: '#555', marginBottom: 1 },
  summaryUnit:  { fontSize: 7, color: '#888' },
  tableHeader:  { flexDirection: 'row', backgroundColor: '#f5f5f5', borderBottom: '1pt solid #ccc', paddingVertical: 3, paddingHorizontal: 4 },
  tableRow:     { flexDirection: 'row', borderBottom: '0.5pt solid #e5e5e5', paddingVertical: 2, paddingHorizontal: 4 },
  th:           { fontSize: 7, color: '#444' },
  td:           { fontSize: 7, color: '#333' },
  cDate:        { width: 46 },
  cTime:        { width: 26 },
  cBP:          { width: 44 },
  cPulse:       { width: 26 },
  cWeight:      { width: 26 },
  cExercise:    { width: 55 },
  cMeal:        { width: 80 },
  cMed:         { width: 22 },
  cLife:        { flex: 1 },
  bloodBox:     { border: '1pt solid #ddd', padding: 6, marginBottom: 6, borderRadius: 2 },
  bloodGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  bloodItem:    { width: '33%', marginBottom: 2 },
});

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type PdfProfile = {
  displayName?: string | null;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  targetWeight?: number | null;
  diseases?: string[];
  riskFactors?: string[];
  medications?: string | null;
  physicalFunction?: string | null;
  emergencyContact?: string | null;
};

export type PdfHealthRecord = {
  date: string;
  time: string;
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  weight?: number | null;
  exerciseType?: string | null;
  exerciseDuration?: string | null;
  mealSummary?: string | null;
  medicationTaken?: boolean | null;
  dailyLife?: string | null;
};

export type PdfCpxTest = {
  testDate: string;
  cpxRound?: number | null;
  loadWeight?: number | null;
  vo2?: number | null;
  mets?: number | null;
  heartRate?: number | null;
  systolicBloodPressure?: number | null;
  atDuring?: number | null;
  findings?: string | null;
};

export type PdfBloodData = {
  testDate: string;
  hbA1c?: number | null;
  randomBloodSugar?: number | null;
  totalCholesterol?: number | null;
  triglycerides?: number | null;
  hdlCholesterol?: number | null;
  ldlCholesterol?: number | null;
  bun?: number | null;
  creatinine?: number | null;
  uricAcid?: number | null;
  hemoglobin?: number | null;
  bnp?: number | null;
  cpxTests?: PdfCpxTest[];
};

export type PdfMonthSummary = {
  month: string;
  avgSystolic?: number;
  avgDiastolic?: number;
  avgPulse?: number;
  avgWeight?: number;
  exerciseDays: number;
  medicationDays: number;
  totalDays: number;
};

export type HealthRecordPdfProps = {
  profile: PdfProfile;
  records: PdfHealthRecord[];
  bloodDataList: PdfBloodData[];
  summary: PdfMonthSummary;
  createdAt: string;
};

// ── ヘルパー ──────────────────────────────────────────────────────────────────

const fmt = (v: unknown, suffix = '') =>
  v != null && v !== '' ? `${v}${suffix}` : '-';

const round1 = (n: number) => Math.round(n * 10) / 10;

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function SummaryCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={S.summaryCell}>
      <Text style={S.summaryLbl}>{label}</Text>
      <Text style={S.summaryVal}>{value}</Text>
      <Text style={S.summaryUnit}>{unit}</Text>
    </View>
  );
}

function RecordTable({ records }: { records: PdfHealthRecord[] }) {
  return (
    <View>
      <View style={S.tableHeader}>
        <Text style={[S.th, S.cDate]}>日付</Text>
        <Text style={[S.th, S.cTime]}>時刻</Text>
        <Text style={[S.th, S.cBP]}>血圧(mmHg)</Text>
        <Text style={[S.th, S.cPulse]}>脈拍</Text>
        <Text style={[S.th, S.cWeight]}>体重</Text>
        <Text style={[S.th, S.cExercise]}>運動</Text>
        <Text style={[S.th, S.cMeal]}>食事</Text>
        <Text style={[S.th, S.cMed]}>服薬</Text>
        <Text style={[S.th, S.cLife]}>日常生活</Text>
      </View>
      {records.map((r, i) => (
        <View key={i} style={S.tableRow} wrap={false}>
          <Text style={[S.td, S.cDate]}>{r.date}</Text>
          <Text style={[S.td, S.cTime]}>{r.time}</Text>
          <Text style={[S.td, S.cBP]}>{r.systolic}/{r.diastolic}</Text>
          <Text style={[S.td, S.cPulse]}>{fmt(r.pulse)}</Text>
          <Text style={[S.td, S.cWeight]}>{fmt(r.weight)}</Text>
          <Text style={[S.td, S.cExercise]}>
            {r.exerciseType ? `${r.exerciseType} ${r.exerciseDuration ?? '-'}分` : '-'}
          </Text>
          <Text style={[S.td, S.cMeal]}>{r.mealSummary ?? '-'}</Text>
          <Text style={[S.td, S.cMed]}>{r.medicationTaken ? '○' : '-'}</Text>
          <Text style={[S.td, S.cLife]}>{r.dailyLife ?? '-'}</Text>
        </View>
      ))}
    </View>
  );
}

function BloodSection({ bloodDataList }: { bloodDataList: PdfBloodData[] }) {
  const hasAny = (b: PdfBloodData) =>
    b.hbA1c != null || b.totalCholesterol != null || b.ldlCholesterol != null ||
    b.hdlCholesterol != null || b.triglycerides != null || b.bnp != null ||
    b.creatinine != null || b.hemoglobin != null || b.randomBloodSugar != null ||
    b.bun != null || b.uricAcid != null;

  const list = bloodDataList.filter(hasAny);
  const cpxList = bloodDataList.flatMap((b) =>
    (b.cpxTests ?? []).map((c) => ({ ...c, parentDate: b.testDate }))
  );

  return (
    <>
      <Text style={S.h2}>【血液検査データ】</Text>
      {list.length === 0 ? (
        <View style={S.section}><Text>未登録</Text></View>
      ) : list.map((b, i) => (
        <View key={i} style={S.bloodBox} wrap={false}>
          <Text style={{ marginBottom: 4, fontFamily: 'NotoSansJP' }}>検査日: {b.testDate}</Text>
          <View style={S.bloodGrid}>
            {([
              ['HbA1c', b.hbA1c, '%'],
              ['随時血糖', b.randomBloodSugar, 'mg/dL'],
              ['総コレステロール', b.totalCholesterol, 'mg/dL'],
              ['中性脂肪', b.triglycerides, 'mg/dL'],
              ['HDL', b.hdlCholesterol, 'mg/dL'],
              ['LDL', b.ldlCholesterol, 'mg/dL'],
              ['BUN', b.bun, 'mg/dL'],
              ['Cr', b.creatinine, 'mg/dL'],
              ['尿酸', b.uricAcid, 'mg/dL'],
              ['Hb', b.hemoglobin, 'g/dL'],
              ['BNP', b.bnp, 'pg/mL'],
            ] as [string, unknown, string][])
              .filter(([, v]) => v != null)
              .map(([label, v, unit], j) => (
                <Text key={j} style={[S.td, S.bloodItem]}>{label}: {fmt(v, unit)}</Text>
              ))}
          </View>
        </View>
      ))}

      <Text style={S.h2}>【CPXデータ】</Text>
      {cpxList.length === 0 ? (
        <View style={S.section}><Text>未登録</Text></View>
      ) : cpxList.map((c, i) => (
        <View key={i} style={S.bloodBox} wrap={false}>
          <Text style={{ marginBottom: 4, fontFamily: 'NotoSansJP' }}>
            検査日: {c.testDate || c.parentDate} / CPX #{fmt(c.cpxRound)}
          </Text>
          <View style={S.bloodGrid}>
            {([
              ['負荷', c.loadWeight, 'W'],
              ['VO2', c.vo2, 'ml/min/kg'],
              ['METs', c.mets, ''],
              ['心拍', c.heartRate, 'bpm'],
              ['収縮期血圧', c.systolicBloodPressure, 'mmHg'],
              ['AT中', c.atDuring, 'ml/min/kg'],
            ] as [string, unknown, string][])
              .filter(([, v]) => v != null)
              .map(([label, v, unit], j) => (
                <Text key={j} style={[S.td, S.bloodItem]}>{label}: {fmt(v, unit)}</Text>
              ))}
          </View>
          {c.findings ? <Text style={[S.td, { marginTop: 2 }]}>所見: {c.findings}</Text> : null}
        </View>
      ))}
    </>
  );
}

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function HealthRecordPdfDocument({
  profile,
  records,
  bloodDataList,
  summary,
  createdAt,
}: HealthRecordPdfProps) {
  const str = (v: unknown) => (v != null && v !== '' ? String(v) : '未設定');
  const monthLabel = summary.month.replace('-', '年') + '月';

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* タイトル */}
        <Text style={S.h1}>心臓リハビリ手帳</Text>
        <Text style={S.sub}>健康記録サマリー（{monthLabel}）</Text>
        <Text style={[S.sub, { marginBottom: 8 }]}>作成日: {createdAt}</Text>

        {/* 月次まとめ */}
        <Text style={S.h2}>【{monthLabel}　月次まとめ】</Text>
        <View style={S.summaryBox}>
          <View style={S.summaryGrid}>
            <SummaryCell
              label="平均血圧"
              value={summary.avgSystolic != null ? `${round1(summary.avgSystolic)}/${round1(summary.avgDiastolic!)}` : '-'}
              unit="mmHg"
            />
            <SummaryCell
              label="平均脈拍"
              value={summary.avgPulse != null ? String(round1(summary.avgPulse)) : '-'}
              unit="回/分"
            />
            <SummaryCell
              label="平均体重"
              value={summary.avgWeight != null ? String(round1(summary.avgWeight)) : '-'}
              unit="kg"
            />
            <SummaryCell label="運動した日" value={String(summary.exerciseDays)} unit={`日 / ${summary.totalDays}日`} />
            <SummaryCell label="服薬した日" value={String(summary.medicationDays)} unit={`日 / ${summary.totalDays}日`} />
            <SummaryCell label="記録日数" value={String(summary.totalDays)} unit="日" />
          </View>
        </View>

        {/* 基本情報 */}
        <Text style={S.h2}>【基本情報】</Text>
        <View style={[S.section, S.row2col]}>
          {([
            ['お名前', str(profile.displayName)],
            ['年齢', profile.age != null ? `${profile.age}歳` : '未設定'],
            ['性別', str(profile.gender)],
            ['身長', profile.height != null ? `${profile.height}cm` : '未設定'],
            ['目標体重', profile.targetWeight != null ? `${profile.targetWeight}kg` : '未設定'],
          ] as [string, string][]).map(([label, value], i) => (
            <View key={i} style={S.col2}>
              <Text><Text style={S.label}>{label}: </Text>{value}</Text>
            </View>
          ))}
        </View>

        {/* 医療情報 */}
        <Text style={S.h2}>【医療情報】</Text>
        <View style={S.section}>
          <Text style={{ marginBottom: 2 }}>
            <Text style={S.label}>基礎疾患: </Text>
            {(profile.diseases ?? []).length > 0 ? profile.diseases!.join('、') : '未設定'}
          </Text>
          <Text style={{ marginBottom: 2 }}>
            <Text style={S.label}>危険因子: </Text>
            {(profile.riskFactors ?? []).length > 0 ? profile.riskFactors!.join('、') : '未設定'}
          </Text>
          <Text style={{ marginBottom: 2 }}>
            <Text style={S.label}>服薬情報: </Text>{str(profile.medications)}
          </Text>
          <Text style={{ marginBottom: 2 }}>
            <Text style={S.label}>身体機能: </Text>{str(profile.physicalFunction)}
          </Text>
          <Text>
            <Text style={S.label}>緊急連絡先: </Text>{str(profile.emergencyContact)}
          </Text>
        </View>

        {/* 健康記録テーブル */}
        <Text style={S.h2}>【健康記録】</Text>
        {records.length === 0 ? (
          <View style={S.section}><Text>この月の記録はありません</Text></View>
        ) : (
          <RecordTable records={records} />
        )}

        {/* 血液・CPX データ */}
        <BloodSection bloodDataList={bloodDataList} />
      </Page>
    </Document>
  );
}
