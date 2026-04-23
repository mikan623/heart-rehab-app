'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/PageHeader';
import { apiFetch } from '@/lib/api';
// （デスクトップナビは NavigationBar に統一）

// （デスクトップナビは NavigationBar に統一）

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((v) => typeof v === 'string');

type BloodValueKey =
  | 'hbA1c'
  | 'randomBloodSugar'
  | 'totalCholesterol'
  | 'triglycerides'
  | 'hdlCholesterol'
  | 'ldlCholesterol'
  | 'bun'
  | 'creatinine'
  | 'uricAcid'
  | 'hemoglobin'
  | 'bnp';

interface BloodValuesForm {
  hbA1c: string;
  randomBloodSugar: string;
  totalCholesterol: string;
  triglycerides: string;
  hdlCholesterol: string;
  ldlCholesterol: string;
  bun: string;
  creatinine: string;
  uricAcid: string;
  hemoglobin: string;
  bnp: string;
}

interface CPXTestForm {
  id?: string;
  testDate: string;
  cpxRound: number;
  atOneMinBefore: string;
  atDuring: string;
  maxLoad: string;
  loadWeight: string;
  vo2: string;
  mets: string;
  heartRate: string;
  systolicBloodPressure: string;
  findings: string | null;
}

interface BloodData {
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
  cpxTests: Array<
    Omit<CPXTestForm, 'atOneMinBefore' | 'atDuring' | 'maxLoad' | 'loadWeight' | 'vo2' | 'mets' | 'heartRate' | 'systolicBloodPressure'> & {
      atOneMinBefore: number | null;
      atDuring: number | null;
      maxLoad: number | null;
      loadWeight: number | null;
      vo2: number | null;
      mets: number | null;
      heartRate: number | null;
      systolicBloodPressure: number | null;
    }
  >;
  createdAt: string;
}

type Props = {
  userId: string;
  initialBloodDataList: BloodData[];
};

export default function BloodDataClient({ userId, initialBloodDataList }: Props) {
  const [bloodDataList, setBloodDataList] = useState<BloodData[]>(initialBloodDataList);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 日付フォーマット（サーバー/クライアントで一致する形式）
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // ページモード: 'list' | 'new' | 'edit'
  const [pageMode, setPageMode] = useState<'list' | 'new' | 'edit'>('list');
  const [recordType, setRecordType] = useState<'blood' | 'cpx' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const createEmptyCpxRow = (overrides: Partial<CPXTestForm> = {}): CPXTestForm => ({
    testDate: '',
    cpxRound: 1,
    atOneMinBefore: '',
    atDuring: '',
    maxLoad: '',
    loadWeight: '',
    vo2: '',
    mets: '',
    heartRate: '',
    systolicBloodPressure: '',
    findings: null,
    ...overrides,
  });

  const normalizeCpxTests = (tests: BloodData['cpxTests'] | undefined): CPXTestForm[] =>
    (tests || []).map((t) => ({
      id: t.id,
      testDate: t.testDate || '',
      cpxRound: t.cpxRound ?? 1,
      atOneMinBefore: t.atOneMinBefore === null || t.atOneMinBefore === undefined ? '' : String(t.atOneMinBefore),
      atDuring: t.atDuring === null || t.atDuring === undefined ? '' : String(t.atDuring),
      maxLoad: t.maxLoad === null || t.maxLoad === undefined ? '' : String(t.maxLoad),
      loadWeight: t.loadWeight === null || t.loadWeight === undefined ? '' : String(t.loadWeight),
      vo2: t.vo2 === null || t.vo2 === undefined ? '' : String(t.vo2),
      mets: t.mets === null || t.mets === undefined ? '' : String(t.mets),
      heartRate: t.heartRate === null || t.heartRate === undefined ? '' : String(t.heartRate),
      systolicBloodPressure:
        t.systolicBloodPressure === null || t.systolicBloodPressure === undefined ? '' : String(t.systolicBloodPressure),
      findings: t.findings ?? null,
    }));

  // 入力フォーム
  const [testDate, setTestDate] = useState<string>('');
  const [bloodValues, setBloodValues] = useState<BloodValuesForm>({
    hbA1c: '',
    randomBloodSugar: '',
    totalCholesterol: '',
    triglycerides: '',
    hdlCholesterol: '',
    ldlCholesterol: '',
    bun: '',
    creatinine: '',
    uricAcid: '',
    hemoglobin: '',
    bnp: '',
  });
  const [cpxTests, setCpxTests] = useState<CPXTestForm[]>([
    {
      testDate: '',
      cpxRound: 1,
      atOneMinBefore: '',
      atDuring: '',
      maxLoad: '',
      loadWeight: '',
      vo2: '',
      mets: '',
      heartRate: '',
      systolicBloodPressure: '',
      findings: null,
    }
  ]);

  const blockInvalidKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 数値入力で指数表記や符号を禁止（小数点は許可）
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const toHalfWidthNumberLike = (s: string) =>
    s
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[，,]/g, '.')
      .replace(/[。．]/g, '.');

  // NOTE:
  // - 「最大値へ自動補正（クランプ）」はしない
  // - 入力は「桁数上限で打ち止め」まで（範囲チェックは API で実施）
  const sanitizeDecimal1000 = (raw: string, maxDecimals = 3, maxIntDigits = 4) => {
    const v0 = toHalfWidthNumberLike(String(raw ?? ''));
    const cleaned = v0.replace(/[^0-9.]/g, '');
    const [intPartRaw, decPartRaw = ''] = cleaned.split('.');
    const intPart = intPartRaw.replace(/^0+(?=\d)/, '').slice(0, maxIntDigits);
    const decPart = decPartRaw.slice(0, maxDecimals);
    const hasDot = cleaned.includes('.');
    if (hasDot) {
      if (decPart.length) return `${intPart || '0'}.${decPart}`;
      // 末尾 "." を保持（入力途中を許可）
      return `${intPart || '0'}.`;
    }
    // 「0だけ」は小数入力へ誘導（0. にする）
    if ((intPart || '') === '0' && maxDecimals > 0) return '0.';
    const v = intPart || '';
    if (!v) return '';
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return String(n);
  };

  const normalizeDecimalOnBlur = (s: string) => {
    const v = String(s ?? '').trim();
    if (!v) return '';
    if (v === '.' || v === '0.' || v === '0' || /^0\.0*$/.test(v)) return '';
    if (v.endsWith('.')) return v.slice(0, -1);
    return v;
  };

  const toNullableNumber = (raw: string) => {
    const v = String(raw ?? '').trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const labelForErrorKey = (key: string) => {
    const bloodMap: Record<string, string> = {
      hbA1c: 'HbA1c',
      randomBloodSugar: '随時血糖',
      totalCholesterol: '総コレステロール',
      triglycerides: '中性脂肪',
      hdlCholesterol: 'HDLコレステロール',
      ldlCholesterol: 'LDLコレステロール',
      bun: 'BUN',
      creatinine: 'Cr',
      uricAcid: '尿酸',
      hemoglobin: 'ヘモグロビン',
      bnp: 'BNP',
    };
    const cpxMap: Record<string, string> = {
      cpxRound: '回数',
      atOneMinBefore: 'AT1分前',
      atDuring: 'AT中',
      maxLoad: '最大負荷時',
      loadWeight: '負荷量(W)',
      vo2: 'VO2',
      mets: 'Mets',
      heartRate: '心拍数',
      systolicBloodPressure: '収縮期血圧',
    };
    if (key === 'testDate') return '検査日';
    if (key.startsWith('bloodValues.')) {
      const k = key.replace('bloodValues.', '');
      return `血液: ${bloodMap[k] || k}`;
    }
    const m1 = key.match(/^cpxTests\.(\d+)\.(.+)$/);
    if (m1) {
      const idx = Number(m1[1]) + 1;
      const k = m1[2];
      return `CPX #${idx}: ${cpxMap[k] || k}`;
    }
    const m2 = key.match(/^cpx\.(.+)$/);
    if (m2) {
      const k = m2[1];
      return `CPX: ${cpxMap[k] || k}`;
    }
    return key;
  };

  const openSectionForErrorKey = (key: string) => {
    if (key.startsWith('bloodValues.')) setRecordType('blood');
    if (key.startsWith('cpxTests.') || key.startsWith('cpx.')) setRecordType('cpx');
  };

  // CPX記録モードでは、上の検査日を各CPXに自動適用（下の検査日入力は不要）
  useEffect(() => {
    if (!testDate) return;
    if (recordType !== 'cpx') return;
    setCpxTests((prev) =>
      prev.map((t) => ({
        ...t,
        testDate,
      }))
    );
  }, [testDate, recordType]);

  const hasAnyBloodValue = (item: BloodData) => {
    return (
      item.hbA1c !== null ||
      item.randomBloodSugar !== null ||
      item.totalCholesterol !== null ||
      item.triglycerides !== null ||
      item.hdlCholesterol !== null ||
      item.ldlCholesterol !== null ||
      item.bun !== null ||
      item.creatinine !== null ||
      item.uricAcid !== null ||
      item.hemoglobin !== null ||
      item.bnp !== null
    );
  };

  type CPXCardItem = (BloodData['cpxTests'][number] & { bloodDataId: string; parentCreatedAt: string });

  const bloodCards = bloodDataList.filter(hasAnyBloodValue);
  const cpxCards: CPXCardItem[] = bloodDataList
    .flatMap((bd) =>
      (bd.cpxTests || []).map((cpx) => ({
        ...cpx,
        bloodDataId: bd.id,
        parentCreatedAt: bd.createdAt,
      }))
    )
    .sort((a, b) => {
      const da = a.testDate || '';
      const db = b.testDate || '';
      if (da !== db) return db.localeCompare(da); // testDate desc
      return (b.cpxRound ?? 0) - (a.cpxRound ?? 0);
    });

  const openCpxEditByBloodDataId = (bloodDataId: string) => {
    const parent = bloodDataList.find((b) => b.id === bloodDataId);
    if (parent) handleEditCPX(parent);
  };


  const fetchBloodDataList = async () => {
    if (!userId) return;

    try {
      const response = await apiFetch(`/api/blood-data?userId=${userId}`);
      const data = await response.json();
      setBloodDataList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('血液データ取得エラー:', error);
    }
  };

  const resetForm = () => {
    setTestDate('');
    setBloodValues({
      hbA1c: '',
      randomBloodSugar: '',
      totalCholesterol: '',
      triglycerides: '',
      hdlCholesterol: '',
      ldlCholesterol: '',
      bun: '',
      creatinine: '',
      uricAcid: '',
      hemoglobin: '',
      bnp: '',
    });
    setCpxTests([
      {
        testDate: '',
        cpxRound: 1,
        atOneMinBefore: '',
        atDuring: '',
        maxLoad: '',
        loadWeight: '',
        vo2: '',
        mets: '',
        heartRate: '',
        systolicBloodPressure: '',
        findings: null,
      }
    ]);
  };

  const handleSave = async () => {
    if (!testDate || !userId) {
      setFormError('入力内容にエラーがあります。赤字の項目を確認してください。');
      setFieldErrors((prev) => ({ ...prev, testDate: '検査日を入力してください' }));
      return;
    }

    setSaveStatus('saving');
    setFormError(null);
    setFieldErrors({});
    try {
      const payload = {
        mode: recordType || 'blood',
        userId,
        testDate,
        ...(recordType === 'cpx'
          ? {
              cpxTests: cpxTests
                .filter((t) => t.testDate)
                .map((t) => ({
                  ...t,
                  atOneMinBefore: toNullableNumber(t.atOneMinBefore),
                  atDuring: toNullableNumber(t.atDuring),
                  maxLoad: toNullableNumber(t.maxLoad),
                  loadWeight: toNullableNumber(t.loadWeight),
                  vo2: toNullableNumber(t.vo2),
                  mets: toNullableNumber(t.mets),
                  heartRate: toNullableNumber(t.heartRate),
                  systolicBloodPressure: toNullableNumber(t.systolicBloodPressure),
                })),
            } // CPXのみ
            : {
              bloodValues: (() => {
                const keys: BloodValueKey[] = [
                  'hbA1c',
                  'randomBloodSugar',
                  'totalCholesterol',
                  'triglycerides',
                  'hdlCholesterol',
                  'ldlCholesterol',
                  'bun',
                  'creatinine',
                  'uricAcid',
                  'hemoglobin',
                  'bnp',
                ];
                return Object.fromEntries(keys.map((k) => [k, toNullableNumber(bloodValues[k])]));
              })(),
              cpxTests: cpxTests
                .filter((t) => t.testDate)
                .map((t) => ({
                  ...t,
                  atOneMinBefore: toNullableNumber(t.atOneMinBefore),
                  atDuring: toNullableNumber(t.atDuring),
                  maxLoad: toNullableNumber(t.maxLoad),
                  loadWeight: toNullableNumber(t.loadWeight),
                  vo2: toNullableNumber(t.vo2),
                  mets: toNullableNumber(t.mets),
                  heartRate: toNullableNumber(t.heartRate),
                  systolicBloodPressure: toNullableNumber(t.systolicBloodPressure),
                })),
            }), // 互換: blood側でもCPX送信は許可
      };

      const method = pageMode === 'edit' ? 'PUT' : 'POST';
      const url = pageMode === 'edit' ? `/api/blood-data` : `/api/blood-data`;
      const body = pageMode === 'edit' ? { ...payload, id: editingId } : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const fieldErrors =
          isRecord(data) && isStringRecord(data.fieldErrors) ? data.fieldErrors : undefined;
        if (response.status === 400 && fieldErrors) {
          const fe = fieldErrors;
          setFormError('入力内容にエラーがあります。赤字の項目を確認してください。');
          setFieldErrors(fe);
          const firstKey = Object.keys(fe)[0];
          if (firstKey) openSectionForErrorKey(firstKey);
          setSaveStatus('idle');
          return;
        }
        const errorMessage = isRecord(data) && typeof data.error === 'string' ? data.error : undefined;
        throw new Error(errorMessage || '保存に失敗しました');
      }

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        resetForm();
        setPageMode('list');
        fetchBloodDataList();
      }, 1500);
    } catch (error) {
      console.error('保存エラー:', error);
      setFormError('保存に失敗しました。入力内容を確認して再度お試しください。');
      setSaveStatus('idle');
    }
  };

  const handleEdit = (bloodData: BloodData) => {
    setEditingId(bloodData.id);
    setTestDate(bloodData.testDate);
    // 編集は従来通り「血液データ（＋CPX）」編集として扱う（必要なら後で分割導線も追加）
    setRecordType('blood');
    setBloodValues({
      hbA1c: bloodData.hbA1c === null ? '' : String(bloodData.hbA1c),
      randomBloodSugar: bloodData.randomBloodSugar === null ? '' : String(bloodData.randomBloodSugar),
      totalCholesterol: bloodData.totalCholesterol === null ? '' : String(bloodData.totalCholesterol),
      triglycerides: bloodData.triglycerides === null ? '' : String(bloodData.triglycerides),
      hdlCholesterol: bloodData.hdlCholesterol === null ? '' : String(bloodData.hdlCholesterol),
      ldlCholesterol: bloodData.ldlCholesterol === null ? '' : String(bloodData.ldlCholesterol),
      bun: bloodData.bun === null ? '' : String(bloodData.bun),
      creatinine: bloodData.creatinine === null ? '' : String(bloodData.creatinine),
      uricAcid: bloodData.uricAcid === null ? '' : String(bloodData.uricAcid),
      hemoglobin: bloodData.hemoglobin === null ? '' : String(bloodData.hemoglobin),
      bnp: bloodData.bnp === null ? '' : String(bloodData.bnp),
    });
    const normalized = normalizeCpxTests(bloodData.cpxTests);
    setCpxTests(normalized.length > 0 ? normalized : [createEmptyCpxRow()]);
    setPageMode('edit');
  };

  // 運動負荷試験（CPX）の編集として開く
  const handleEditCPX = (bloodData: BloodData) => {
    setEditingId(bloodData.id);
    setTestDate(bloodData.testDate);
    setRecordType('cpx');
    // 血液値は保持（画面では非表示だが将来の切替用）
    setBloodValues({
      hbA1c: bloodData.hbA1c === null ? '' : String(bloodData.hbA1c),
      randomBloodSugar: bloodData.randomBloodSugar === null ? '' : String(bloodData.randomBloodSugar),
      totalCholesterol: bloodData.totalCholesterol === null ? '' : String(bloodData.totalCholesterol),
      triglycerides: bloodData.triglycerides === null ? '' : String(bloodData.triglycerides),
      hdlCholesterol: bloodData.hdlCholesterol === null ? '' : String(bloodData.hdlCholesterol),
      ldlCholesterol: bloodData.ldlCholesterol === null ? '' : String(bloodData.ldlCholesterol),
      bun: bloodData.bun === null ? '' : String(bloodData.bun),
      creatinine: bloodData.creatinine === null ? '' : String(bloodData.creatinine),
      uricAcid: bloodData.uricAcid === null ? '' : String(bloodData.uricAcid),
      hemoglobin: bloodData.hemoglobin === null ? '' : String(bloodData.hemoglobin),
      bnp: bloodData.bnp === null ? '' : String(bloodData.bnp),
    });
    const normalizedCpx = normalizeCpxTests(bloodData.cpxTests);
    setCpxTests(
      normalizedCpx.length > 0
        ? normalizedCpx
        : [createEmptyCpxRow({ testDate: bloodData.testDate, cpxRound: 1 })]
    );
    setPageMode('edit');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この検査データを削除しますか？（運動負荷試験も一緒に削除されます）')) return;
    try {
      const res = await apiFetch(`/api/blood-data?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      await fetchBloodDataList();
    } catch (e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  const handleDeleteCPX = async (cpxId: string) => {
    if (!confirm('この運動負荷試験（CPX）を削除しますか？')) return;
    try {
      const res = await apiFetch(`/api/blood-data?cpxId=${encodeURIComponent(cpxId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      await fetchBloodDataList();
    } catch (e) {
      console.error('CPX削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  const handleAddCPXRow = () => {
    const nextRound = Math.max(...cpxTests.map(t => t.cpxRound), 0) + 1;
    setCpxTests([...cpxTests, createEmptyCpxRow({ testDate: '', cpxRound: nextRound })]);
  };

  const handleRemoveCPXRow = (index: number) => {
    setCpxTests(cpxTests.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="検査結果記録"
        subtitle="血液検査・運動負荷試験を記録"
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* メインコンテンツ */}

        {/* メインコンテンツ */}

        {/* リスト表示 */}
        {pageMode === 'list' && (
          <>
            <div id="tour-blood-add" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => {
                  resetForm();
                  setRecordType('blood');
                  setPageMode('new');
                }}
                className="w-full bg-gradient-to-r from-orange-400 to-pink-400 text-white font-bold py-3 px-4 rounded-lg hover:from-orange-500 hover:to-pink-500 transition-all duration-200 click-animate"
              >
                🩸 血液検査データを記録する
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setRecordType('cpx');
                  setPageMode('new');
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 click-animate"
              >
                🏃 運動負荷試験のデータを記録する
              </button>
            </div>

            <div id="tour-blood-tabs" className="space-y-4">
              {/* 血液検査データ */}
              <div className="bg-white/60 rounded-lg p-4 border border-orange-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3">🩸 血液検査データ</h3>
                {bloodCards.length === 0 ? (
                  <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                    血液検査データがまだ登録されていません
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
                    {bloodCards.map((item) => {
                      return (
                        <div
                          key={`blood_${item.id}`}
                          className="min-w-[280px] md:min-w-[360px] snap-start bg-white rounded-xl p-5 shadow-md border border-orange-100 transition hover:-translate-y-0.5"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-lg font-bold text-gray-800">
                                {formatDate(item.testDate)}
                              </h4>
                              <p className="text-xs text-gray-500">
                                登録: {formatDateTime(item.createdAt)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  handleEdit(item);
                                }}
                                className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-all duration-200 click-animate text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={(e) => {
                                  handleDelete(item.id);
                                }}
                                className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                              >
                                削除
                              </button>
                            </div>
                          </div>

                          {/* 全項目（重複表示なし・文字少し大きめ） */}
                          <div className="grid grid-cols-2 gap-3 text-[15px] md:text-base text-gray-800">
                            {item.hbA1c !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">HbA1c:</span>
                                <span className="font-bold ml-2">{item.hbA1c}%</span>
                              </div>
                            )}
                            {item.randomBloodSugar !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">随時血糖:</span>
                                <span className="font-bold ml-2">{item.randomBloodSugar}mg/dL</span>
                              </div>
                            )}
                            {item.totalCholesterol !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">総コレステロール:</span>
                                <span className="font-bold ml-2">{item.totalCholesterol}mg/dL</span>
                              </div>
                            )}
                            {item.triglycerides !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">中性脂肪:</span>
                                <span className="font-bold ml-2">{item.triglycerides}mg/dL</span>
                              </div>
                            )}
                            {item.hdlCholesterol !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">HDL:</span>
                                <span className="font-bold ml-2">{item.hdlCholesterol}mg/dL</span>
                              </div>
                            )}
                            {item.ldlCholesterol !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">LDL:</span>
                                <span className="font-bold ml-2">{item.ldlCholesterol}mg/dL</span>
                              </div>
                            )}
                            {item.bun !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">BUN:</span>
                                <span className="font-bold ml-2">{item.bun}mg/dL</span>
                              </div>
                            )}
                            {item.creatinine !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">Cr:</span>
                                <span className="font-bold ml-2">{item.creatinine}mg/dL</span>
                              </div>
                            )}
                            {item.uricAcid !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">尿酸:</span>
                                <span className="font-bold ml-2">{item.uricAcid}mg/dL</span>
                              </div>
                            )}
                            {item.hemoglobin !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">Hb:</span>
                                <span className="font-bold ml-2">{item.hemoglobin}</span>
                              </div>
                            )}
                            {item.bnp !== null && (
                              <div>
                                <span className="text-gray-600 font-semibold">BNP:</span>
                                <span className="font-bold ml-2">{item.bnp}pg/mL</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 運動負荷試験（CPX）データ */}
              <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3">🏃 運動負荷試験データ</h3>
                {cpxCards.length === 0 ? (
                  <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                    運動負荷試験データがまだ登録されていません
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2">
                    {cpxCards.map((cpx, idx) => {
                      const cardId = cpx.id || `${cpx.bloodDataId}_${cpx.cpxRound}_${idx}`;
                      return (
                        <div
                          key={`cpx_${cardId}`}
                          className="min-w-[280px] md:min-w-[360px] snap-start bg-white rounded-xl p-5 shadow-md border border-blue-100 transition hover:-translate-y-0.5"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="text-lg font-bold text-gray-800">
                                {cpx.testDate ? formatDate(cpx.testDate) : '日付未設定'} / CPX #{cpx.cpxRound}
                              </h4>
                              <p className="text-xs text-gray-500">
                                登録: {formatDateTime(cpx.parentCreatedAt)}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  openCpxEditByBloodDataId(cpx.bloodDataId);
                                }}
                                className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-all duration-200 click-animate text-sm"
                              >
                                編集
                              </button>
                              <button
                                onClick={(e) => {
                                  cpx.id && handleDeleteCPX(cpx.id);
                                }}
                                disabled={!cpx.id}
                                className={`bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm ${
                                  !cpx.id ? 'opacity-50 cursor-not-allowed hover:bg-red-500' : ''
                                }`}
                              >
                                削除
                              </button>
                            </div>
                          </div>

                          {/* 全項目（重複表示なし・文字少し大きめ） */}
                          <div className="grid grid-cols-2 gap-3 text-[15px] md:text-base text-gray-800">
                            {cpx.loadWeight !== null && (
                              <div><span className="text-gray-600 font-semibold">負荷:</span><span className="font-bold ml-2">{cpx.loadWeight}W</span></div>
                            )}
                            {cpx.vo2 !== null && (
                              <div><span className="text-gray-600 font-semibold">VO2:</span><span className="font-bold ml-2">{cpx.vo2}</span></div>
                            )}
                            {cpx.mets !== null && (
                              <div><span className="text-gray-600 font-semibold">Mets:</span><span className="font-bold ml-2">{cpx.mets}</span></div>
                            )}
                            {cpx.heartRate !== null && (
                              <div><span className="text-gray-600 font-semibold">心拍:</span><span className="font-bold ml-2">{cpx.heartRate}bpm</span></div>
                            )}
                            {cpx.systolicBloodPressure !== null && (
                              <div><span className="text-gray-600 font-semibold">収縮期血圧:</span><span className="font-bold ml-2">{cpx.systolicBloodPressure}mmHg</span></div>
                            )}
                            {cpx.maxLoad !== null && (
                              <div><span className="text-gray-600 font-semibold">最大負荷:</span><span className="font-bold ml-2">{cpx.maxLoad}</span></div>
                            )}
                            {cpx.atOneMinBefore !== null && (
                              <div><span className="text-gray-600 font-semibold">AT1分前:</span><span className="font-bold ml-2">{cpx.atOneMinBefore}</span></div>
                            )}
                            {cpx.atDuring !== null && (
                              <div><span className="text-gray-600 font-semibold">AT中:</span><span className="font-bold ml-2">{cpx.atDuring}</span></div>
                            )}
                          </div>
                          {cpx.findings && (
                            <div className="mt-3 border-t border-gray-200 pt-3 text-[15px] md:text-base text-gray-800">
                              <span className="text-gray-600 font-semibold">所見:</span>
                              <span className="ml-2">{cpx.findings}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 入力・編集フォーム */}
        {(pageMode === 'new' || pageMode === 'edit') && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-start justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {pageMode === 'new'
                  ? ((recordType || 'blood') === 'cpx' ? '運動負荷試験データ新規登録' : '血液検査データ新規登録')
                  : '血液データ編集'}
              </h2>
              <div className="flex items-center gap-2">
                {pageMode === 'edit' && editingId && (
                  <button
                    onClick={() => {
                      handleDelete(editingId);
                      resetForm();
                      setRecordType(null);
                      setPageMode('list');
                    }}
                    className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                  >
                    削除
                  </button>
                )}
                <button
                  onClick={() => {
                    resetForm();
                    setRecordType(null);
                    setPageMode('list');
                  }}
                  className="text-gray-500 hover:text-gray-700 font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 検査日 */}
            <div className="mb-6">
              <label className="block text-gray-700 font-bold mb-2">検査日 *</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => {
                  setFormError(null);
                  clearFieldError('testDate');
                  setTestDate(e.target.value);
                }}
                className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  fieldErrors['testDate'] ? 'border-red-400' : 'border-orange-300'
                }`}
              />
              {fieldErrors['testDate'] && <p className="mt-2 text-sm text-red-600">{fieldErrors['testDate']}</p>}
            </div>

            {formError && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* 血液検査結果 */}
            {(recordType || 'blood') !== 'cpx' && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">検査結果</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* HbA1c */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">HbA1c (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.hbA1c}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.hbA1c');
                      setBloodValues({ ...bloodValues, hbA1c: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.hbA1c);
                      if (next !== bloodValues.hbA1c) setBloodValues({ ...bloodValues, hbA1c: next });
                      if (!next) {
                        setFieldErrors((prev) => ({ ...prev, 'bloodValues.hbA1c': '0より大きい〜1000 の範囲で入力してください' }));
                      }
                    }}
                    placeholder="4.3～5.8"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.hbA1c'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.hbA1c'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.hbA1c']}</p>
                  )}
                </div>

                {/* 随時血糖 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">随時血糖 (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.randomBloodSugar}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.randomBloodSugar');
                      setBloodValues({ ...bloodValues, randomBloodSugar: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.randomBloodSugar);
                      if (next !== bloodValues.randomBloodSugar) setBloodValues({ ...bloodValues, randomBloodSugar: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.randomBloodSugar': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="140未満"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.randomBloodSugar'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.randomBloodSugar'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.randomBloodSugar']}</p>
                  )}
                </div>

                {/* 総コレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">総コレステロール (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.totalCholesterol}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.totalCholesterol');
                      setBloodValues({ ...bloodValues, totalCholesterol: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.totalCholesterol);
                      if (next !== bloodValues.totalCholesterol) setBloodValues({ ...bloodValues, totalCholesterol: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.totalCholesterol': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="130～220"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.totalCholesterol'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.totalCholesterol'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.totalCholesterol']}</p>
                  )}
                </div>

                {/* 中性脂肪 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">中性脂肪 (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.triglycerides}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.triglycerides');
                      setBloodValues({ ...bloodValues, triglycerides: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.triglycerides);
                      if (next !== bloodValues.triglycerides) setBloodValues({ ...bloodValues, triglycerides: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.triglycerides': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="30～150"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.triglycerides'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.triglycerides'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.triglycerides']}</p>
                  )}
                </div>

                {/* HDLコレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">HDLコレステロール (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.hdlCholesterol}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.hdlCholesterol');
                      setBloodValues({ ...bloodValues, hdlCholesterol: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.hdlCholesterol);
                      if (next !== bloodValues.hdlCholesterol) setBloodValues({ ...bloodValues, hdlCholesterol: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.hdlCholesterol': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="40～100"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.hdlCholesterol'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.hdlCholesterol'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.hdlCholesterol']}</p>
                  )}
                </div>

                {/* LDLコレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">LDLコレステロール (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.ldlCholesterol}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.ldlCholesterol');
                      setBloodValues({ ...bloodValues, ldlCholesterol: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.ldlCholesterol);
                      if (next !== bloodValues.ldlCholesterol) setBloodValues({ ...bloodValues, ldlCholesterol: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.ldlCholesterol': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="70～139"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.ldlCholesterol'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.ldlCholesterol'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.ldlCholesterol']}</p>
                  )}
                </div>

                {/* BUN */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">BUN (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.bun}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.bun');
                      setBloodValues({ ...bloodValues, bun: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.bun);
                      if (next !== bloodValues.bun) setBloodValues({ ...bloodValues, bun: next });
                      if (!next) {
                        setFieldErrors((prev) => ({ ...prev, 'bloodValues.bun': '0より大きい〜1000 の範囲で入力してください' }));
                      }
                    }}
                    placeholder="8～20"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.bun'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.bun'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.bun']}</p>
                  )}
                </div>

                {/* Cr (クレアチニン) */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">Cr (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.creatinine}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.creatinine');
                      setBloodValues({ ...bloodValues, creatinine: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.creatinine);
                      if (next !== bloodValues.creatinine) setBloodValues({ ...bloodValues, creatinine: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.creatinine': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="0.3～0.8"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.creatinine'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.creatinine'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.creatinine']}</p>
                  )}
                </div>

                {/* 尿酸 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">尿酸 (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.uricAcid}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.uricAcid');
                      setBloodValues({ ...bloodValues, uricAcid: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.uricAcid);
                      if (next !== bloodValues.uricAcid) setBloodValues({ ...bloodValues, uricAcid: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.uricAcid': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="2.6～6"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.uricAcid'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.uricAcid'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.uricAcid']}</p>
                  )}
                </div>

                {/* ヘモグロビン */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">ヘモグロビン (mg/dL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.hemoglobin}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.hemoglobin');
                      setBloodValues({ ...bloodValues, hemoglobin: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.hemoglobin);
                      if (next !== bloodValues.hemoglobin) setBloodValues({ ...bloodValues, hemoglobin: next });
                      if (!next) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          'bloodValues.hemoglobin': '0より大きい〜1000 の範囲で入力してください',
                        }));
                      }
                    }}
                    placeholder="12～18"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.hemoglobin'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.hemoglobin'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.hemoglobin']}</p>
                  )}
                </div>

                {/* BNP */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">BNP (pg/mL)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    onKeyDown={blockInvalidKeys}
                    value={bloodValues.bnp}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('bloodValues.bnp');
                      setBloodValues({ ...bloodValues, bnp: sanitizeDecimal1000(e.target.value, 3, 4) });
                    }}
                    onBlur={() => {
                      const next = normalizeDecimalOnBlur(bloodValues.bnp);
                      if (next !== bloodValues.bnp) setBloodValues({ ...bloodValues, bnp: next });
                      if (!next) {
                        setFieldErrors((prev) => ({ ...prev, 'bloodValues.bnp': '0より大きい〜1000 の範囲で入力してください' }));
                      }
                    }}
                    placeholder="18以下"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      fieldErrors['bloodValues.bnp'] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {fieldErrors['bloodValues.bnp'] && (
                    <p className="mt-2 text-sm text-red-600">{fieldErrors['bloodValues.bnp']}</p>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* 運動負荷試験データ */}
            {(recordType || 'blood') !== 'blood' && (
            <div className="mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">運動負荷試験と運動処方の記録</h3>
              </div>

              <div className="space-y-4">
                {cpxTests.map((cpx, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-800">CPX #{cpx.cpxRound}</h4>
                      {cpxTests.length > 1 && (
                        <button
                          onClick={() => handleRemoveCPXRow(index)}
                          className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                        >
                          削除
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* 検査日は上の「検査日」を使用（ここは表示のみ） */}
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600">
                          検査日: <span className="font-bold text-gray-800">{testDate ? formatDate(testDate) : '未入力'}</span>
                        </p>
                      </div>

                      {/* AT1分前 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">AT1分前</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.atOneMinBefore}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.atOneMinBefore`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].atOneMinBefore = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].atOneMinBefore);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.atOneMinBefore`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].atOneMinBefore = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.atOneMinBefore`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.atOneMinBefore`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.atOneMinBefore`]}</p>
                        )}
                      </div>

                      {/* AT中 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">AT中</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.atDuring}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.atDuring`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].atDuring = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].atDuring);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.atDuring`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].atDuring = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.atDuring`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.atDuring`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.atDuring`]}</p>
                        )}
                      </div>

                      {/* 最大負荷時 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">最大負荷時</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.maxLoad}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.maxLoad`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].maxLoad = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].maxLoad);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.maxLoad`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].maxLoad = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.maxLoad`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.maxLoad`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.maxLoad`]}</p>
                        )}
                      </div>

                      {/* 負荷量(W) */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">負荷量 (W)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.loadWeight}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.loadWeight`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].loadWeight = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].loadWeight);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.loadWeight`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].loadWeight = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.loadWeight`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.loadWeight`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.loadWeight`]}</p>
                        )}
                      </div>

                      {/* VO2 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">VO2 (ml/min/kg)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.vo2}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.vo2`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].vo2 = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].vo2);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.vo2`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].vo2 = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.vo2`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.vo2`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.vo2`]}</p>
                        )}
                      </div>

                      {/* Mets */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">Mets</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.mets}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.mets`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].mets = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].mets);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.mets`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].mets = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.mets`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.mets`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.mets`]}</p>
                        )}
                      </div>

                      {/* 心拍数 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">心拍数 (bpm)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.heartRate}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.heartRate`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].heartRate = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].heartRate);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.heartRate`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].heartRate = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.heartRate`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.heartRate`] && (
                          <p className="mt-2 text-sm text-red-600">{fieldErrors[`cpxTests.${index}.heartRate`]}</p>
                        )}
                      </div>

                      {/* 収縮期血圧 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">収縮期血圧 (mmHg)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          onKeyDown={blockInvalidKeys}
                          value={cpx.systolicBloodPressure}
                          onChange={(e) => {
                            setFormError(null);
                            clearFieldError(`cpxTests.${index}.systolicBloodPressure`);
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].systolicBloodPressure = sanitizeDecimal1000(e.target.value, 3, 4);
                            setCpxTests(newCpxTests);
                          }}
                          onBlur={() => {
                            const newCpxTests = [...cpxTests];
                            const next = normalizeDecimalOnBlur(newCpxTests[index].systolicBloodPressure);
                            if (!next) {
                              setFieldErrors((prev) => ({
                                ...prev,
                                [`cpxTests.${index}.systolicBloodPressure`]: '0より大きい〜1000 の範囲で入力してください',
                              }));
                            }
                            newCpxTests[index].systolicBloodPressure = next;
                            setCpxTests(newCpxTests);
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm ${
                            fieldErrors[`cpxTests.${index}.systolicBloodPressure`] ? 'border-red-400' : 'border-gray-300'
                          }`}
                        />
                        {fieldErrors[`cpxTests.${index}.systolicBloodPressure`] && (
                          <p className="mt-2 text-sm text-red-600">
                            {fieldErrors[`cpxTests.${index}.systolicBloodPressure`]}
                          </p>
                        )}
                      </div>

                      {/* 所見 */}
                      <div className="md:col-span-2">
                        <label className="block text-gray-600 text-sm mb-1">所見</label>
                        <textarea
                          value={cpx.findings || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].findings = e.target.value || null;
                            setCpxTests(newCpxTests);
                          }}
                          placeholder="所見やメモを入力..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* 操作ボタン */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className={`flex-1 font-bold py-3 px-4 rounded-lg transition-all duration-200 click-animate text-white ${
                  saveStatus === 'saving'
                    ? 'bg-yellow-500 save-saving'
                    : saveStatus === 'saved'
                    ? 'bg-green-500 save-saved'
                    : 'bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500'
                }`}
              >
                {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済' : '保存する'}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setPageMode('list');
                }}
                className="flex-1 bg-gray-400 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 transition-all duration-200 click-animate"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
