'use client';

import React, { useState } from 'react';
import { clearLineLogin, clearSession } from '@/lib/auth';
import PageHeader from '@/components/PageHeader';
import { apiFetch } from '@/lib/api';

interface Patient {
  userId: string;
  displayName: string | null;
  age: number | null;
  gender: string | null;
  email: string | null;
}

interface HealthRecord {
  id: string;
  date: string;
  time: string;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  pulse: number | null;
  weight: number | null;
  exercise: { type?: string; duration?: string } | null;
  meal: { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null;
  dailyLife: string | null;
  medicationTaken: boolean | null;
  createdAt: string;
  medicalComments?: {
    id: string;
    content: string;
    createdAt: string;
    provider: { id: string; name: string | null; email: string };
  }[];
}

interface BloodData {
  id: string;
  userId: string;
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
  cpxTests?: CPXTest[];
  labComments?: {
    id: string;
    content: string;
    createdAt: string;
    provider: { id: string; name: string | null; email: string };
  }[];
  createdAt: string;
}

type InviteStatus = 'pending' | 'accepted' | 'declined';

type InvitesResponse = {
  invites?: Array<{ patientId?: string; status?: InviteStatus }>;
  error?: string;
};

type PatientsResponse = {
  patients?: Patient[];
  error?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.error === 'string' ? value.error : undefined;

const isPatient = (value: unknown): value is Patient =>
  isRecord(value) &&
  typeof value.userId === 'string' &&
  'displayName' in value;

const getPatients = (value: unknown): Patient[] =>
  isRecord(value) && Array.isArray(value.patients) ? value.patients.filter(isPatient) : [];

const getInvites = (value: unknown): InvitesResponse['invites'] =>
  isRecord(value) && Array.isArray(value.invites) ? value.invites : [];

interface CPXTest {
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
  labComments?: {
    id: string;
    content: string;
    createdAt: string;
    provider: { id: string; name: string | null; email: string };
  }[];
  createdAt: string;
}

type Props = { userId: string };

const formatDateTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function MedicalClient({ userId }: Props) {
  const [searchName, setSearchName] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inviteStatusByPatientId, setInviteStatusByPatientId] = useState<Record<string, 'pending' | 'accepted' | 'declined'>>({});
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [bloodDataList, setBloodDataList] = useState<BloodData[]>([]);
  const [loadingBloodData, setLoadingBloodData] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const providerId = userId;
  const [commentTarget, setCommentTarget] = useState<{ recordId: string; patientId: string; date: string; time: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const [labCommentTarget, setLabCommentTarget] = useState<{
    kind: 'blood' | 'cpx';
    targetId: string;
    patientId: string;
    label: string;
  } | null>(null);
  const [labCommentText, setLabCommentText] = useState('');
  const [labCommentSaving, setLabCommentSaving] = useState(false);

  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('justLoggedOut', '1');
        sessionStorage.removeItem('redirectedToLiff');
      }

      await apiFetch('/api/auth/logout', { method: 'POST' });

      clearSession();
      clearLineLogin();

      if (typeof window !== 'undefined' && window.liff) {
        try {
          const liff = window.liff;
          if (liff?.isLoggedIn && typeof liff.isLoggedIn === 'function' && liff.isLoggedIn()) {
            liff.logout();
          }
        } catch {
          // ignore
        }
      }

      if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage);
        keys.forEach((key) => {
          if (
            key.includes('profile') ||
            key.includes('healthRecords') ||
            key.includes('familyMembers')
          ) {
            localStorage.removeItem(key);
          }
        });

        localStorage.removeItem('loginRole');
        window.location.replace('/');
      }
    } catch (e) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('justLoggedOut');
      }
      console.error(e);
      alert('ログアウトに失敗しました');
    }
  };

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

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  type FetchResult<T = unknown> =
    | { ok: true; status: number; data: T }
    | { ok: false; status: number; data: T };

  const fetchJsonWithRetry = async (url: string, init?: RequestInit, retries = 2): Promise<FetchResult> => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...init, cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, status: res.status, data };
        if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
          await sleep(350 * (attempt + 1));
          continue;
        }
        return { ok: false, status: res.status, data };
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          await sleep(350 * (attempt + 1));
          continue;
        }
        throw lastErr;
      }
    }
    throw lastErr;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const keyword = searchName.trim();
    if (!keyword) {
      setPatients([]);
      setSelectedPatient(null);
      setRecords([]);
      return;
    }

    try {
      setSearching(true);
      setSelectedPatient(null);
      setRecords([]);

      const res = await apiFetch(`/api/medical/patients?name=${encodeURIComponent(keyword)}`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        setError(getErrorMessage(data) || '患者検索に失敗しました');
        setPatients([]);
        return;
      }

      setPatients(getPatients(data));
      // 招待ステータスをマージ（承認済/招待中表示）
      if (providerId) {
        try {
          const invRes = await apiFetch(`/api/medical/invites?providerId=${encodeURIComponent(providerId)}`, { cache: 'no-store' });
          const invData = await invRes.json();
          if (invRes.ok) {
            const map: Record<string, 'pending' | 'accepted' | 'declined'> = {};
            (getInvites(invData) || []).forEach((inv) => {
              if (inv?.patientId) map[inv.patientId] = inv.status;
            });
            setInviteStatusByPatientId(map);
          } else {
            setInviteStatusByPatientId({});
          }
        } catch {
          setInviteStatusByPatientId({});
        }
      }
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
      setPatients([]);
      setInviteStatusByPatientId({});
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (patientId: string) => {
    if (!providerId) {
      setError('ログイン情報が取得できませんでした');
      return;
    }
    try {
      setInviteLoadingId(patientId);
      setError(null);
      const { ok, data } = await fetchJsonWithRetry(
        '/api/medical/invites',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId, patientId }),
        },
        2
      );
      if (!ok) {
        setError(getErrorMessage(data) || '招待の作成に失敗しました');
        return;
      }
      alert('招待を送信しました。利用者側が承認すると閲覧できます。');
      setInviteStatusByPatientId((prev) => ({ ...prev, [patientId]: 'pending' }));
    } catch (err) {
      console.error(err);
      setError('招待の作成に失敗しました');
    } finally {
      setInviteLoadingId(null);
    }
  };

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setError(null);
    setRecords([]);
    setBloodDataList([]);

    try {
      setLoadingRecords(true);
      setLoadingBloodData(true);

      if (!providerId) {
        setError('ログイン情報が取得できませんでした');
        return;
      }

      const res = await fetch(
        `/api/medical/patient-data?providerId=${encodeURIComponent(providerId)}&patientId=${encodeURIComponent(patient.userId)}`,
        { cache: 'no-store' }
      );
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          setError('この利用者はまだ承認していません。先に招待を送って、承認後に閲覧できます。');
          return;
        }
        setError(data?.error || '患者データの取得に失敗しました');
        return;
      }

      setRecords(data.records || []);
      setBloodDataList(data.bloodDataList || []);
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
    } finally {
      setLoadingRecords(false);
      setLoadingBloodData(false);
    }
  };

  const openComment = (patientId: string, record: HealthRecord) => {
    setCommentTarget({ recordId: record.id, patientId, date: record.date, time: record.time });
    setCommentText('');
  };

  const submitComment = async () => {
    if (!providerId || !commentTarget) return;
    const content = commentText.trim();
    if (!content) {
      alert('コメントを入力してください');
      return;
    }
    try {
      setCommentSaving(true);
      const { ok, data } = await fetchJsonWithRetry(
        '/api/medical/comments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            patientId: commentTarget.patientId,
            healthRecordId: commentTarget.recordId,
            content,
          }),
        },
        2
      );
      if (!ok) {
        alert(getErrorMessage(data) || 'コメント送信に失敗しました');
        return;
      }
      alert('コメントを送信しました（利用者のメッセージに届きます）');
      // コメント履歴を即反映
      if (selectedPatient) {
        await handleSelectPatient(selectedPatient);
      }
      setCommentTarget(null);
      setCommentText('');
    } catch (e) {
      console.error(e);
      alert('コメント送信に失敗しました');
    } finally {
      setCommentSaving(false);
    }
  };

  const openLabComment = (kind: 'blood' | 'cpx', patientId: string, targetId: string, label: string) => {
    setLabCommentTarget({ kind, patientId, targetId, label });
    setLabCommentText('');
  };

  const submitLabComment = async () => {
    if (!providerId || !labCommentTarget) return;
    const content = labCommentText.trim();
    if (!content) {
      alert('コメントを入力してください');
      return;
    }
    try {
      setLabCommentSaving(true);
      const { ok, data } = await fetchJsonWithRetry(
        '/api/medical/lab-comments',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            patientId: labCommentTarget.patientId,
            kind: labCommentTarget.kind,
            targetId: labCommentTarget.targetId,
            content,
          }),
        },
        2
      );
      if (!ok) {
        alert(getErrorMessage(data) || 'コメント送信に失敗しました');
        return;
      }
      alert('コメントを送信しました（利用者のメッセージに届きます）');
      if (selectedPatient) {
        await handleSelectPatient(selectedPatient);
      }
      setLabCommentTarget(null);
      setLabCommentText('');
    } catch (e) {
      console.error(e);
      alert('コメント送信に失敗しました');
    } finally {
      setLabCommentSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader
        title="医療従事者"
        desktopTitleClassName="text-lg md:text-2xl font-bold text-orange-800"
        rightContent={
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50"
          >
            ログアウト
          </button>
        }
      />

      <main className="max-w-6xl mx-auto p-4 pb-28">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                患者検索・データ閲覧
              </h2>
              <p className="text-sm md:text-base text-gray-600 mt-1">
                患者さんを検索して、招待→承認後に健康記録 / 血液検査 / CPX を確認できます。
        </p>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-orange-200 p-4 md:p-6 mb-6"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="font-bold text-gray-800">患者名で検索</div>
              <span className="text-xs text-gray-500">部分一致OK</span>
            </div>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="例）山田太郎"
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            />
            <button
              type="submit"
              disabled={searching}
                className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white text-sm md:text-base font-bold shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {searching ? '検索中…' : '検索する'}
            </button>
          </div>
        </form>

        {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

          <div className="grid lg:grid-cols-2 gap-6">
          {/* 左：患者一覧 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-800">患者一覧</h3>
              <span className="text-xs text-gray-500">{patients.length} 件</span>
            </div>

            {patients.length === 0 && !searching && (
              <p className="text-sm text-gray-500">まだ検索結果がありません。</p>
            )}

            {patients.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {patients.map((patient) => (
                  <li
                    key={patient.userId}
                    className="py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <div className="w-full min-w-0">
                      <p className="text-sm md:text-base font-bold text-gray-900">
                        {patient.displayName || '名前未登録'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {patient.age != null ? `${patient.age}歳` : '年齢未登録'} /{' '}
                        {patient.gender || '性別未登録'}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-gray-400 mt-0.5 break-all">
                          {patient.email}
                        </p>
                      )}
                      {inviteStatusByPatientId[patient.userId] === 'accepted' && (
                        <span className="inline-flex mt-2 text-xs px-2 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 font-bold">
                          承認済
                        </span>
                      )}
                      {inviteStatusByPatientId[patient.userId] === 'pending' && (
                        <span className="inline-flex mt-2 text-xs px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                          招待中
                        </span>
                      )}
                    </div>
                    <div className="w-full sm:w-auto shrink-0 flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={
                          inviteLoadingId === patient.userId ||
                          inviteStatusByPatientId[patient.userId] === 'accepted' ||
                          inviteStatusByPatientId[patient.userId] === 'pending'
                        }
                        onClick={() => handleInvite(patient.userId)}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 rounded-xl bg-orange-500 text-white text-xs md:text-sm font-bold hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {inviteStatusByPatientId[patient.userId] === 'accepted'
                          ? '承認済'
                          : inviteStatusByPatientId[patient.userId] === 'pending'
                            ? '招待済'
                            : inviteLoadingId === patient.userId
                              ? '招待中…'
                              : '招待する'}
                      </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                        className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 rounded-xl border border-pink-300 text-pink-600 text-xs md:text-sm font-bold hover:bg-pink-50"
                    >
                      記録を見る
                    </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 右：健康記録一覧 */}
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-800">患者データ</h3>
              {selectedPatient && (
                <span className="text-xs px-2 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-semibold">
                  選択中
                </span>
              )}
            </div>

            {!selectedPatient && (
              <p className="text-sm text-gray-500">
                左の一覧から患者さんを選択すると、ここに健康記録が表示されます。
              </p>
            )}

            {selectedPatient && (
              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50/60 p-3">
                <p className="text-sm font-bold text-gray-900">
                  {selectedPatient.displayName || '名前未登録'} さんの記録
                </p>
                <p className="text-xs text-gray-500">
                  {selectedPatient.age != null ? `${selectedPatient.age}歳` : '年齢未登録'} /{' '}
                  {selectedPatient.gender || '性別未登録'}
                </p>
              </div>
            )}

            {loadingRecords && (
              <p className="text-sm text-gray-500">健康記録を読み込み中です…</p>
            )}

            {!loadingRecords && selectedPatient && records.length === 0 && (
              <p className="text-sm text-gray-500">まだ健康記録が登録されていません。</p>
            )}

            {!loadingRecords && records.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-3">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-xl p-3 text-xs md:text-sm bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-gray-800">
                        {record.date} {record.time}
                      </span>
                      {record.medicationTaken && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] md:text-xs font-semibold">
                          服薬済み
                        </span>
                      )}
                    </div>
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => selectedPatient && openComment(selectedPatient.userId, record)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                      >
                        コメントする
                      </button>
                    </div>
                    <p className="text-gray-800">
                      🩺 血圧: {record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic} mmHg
                    </p>
                    <p className="text-gray-800">
                      💓 脈拍: {record.pulse != null ? `${record.pulse} 回/分` : '-'}
                    </p>
                    <p className="text-gray-800">
                      ⚖️ 体重: {record.weight != null ? `${record.weight} kg` : '-'}
                    </p>
                    {record.exercise && (
                      <p className="text-gray-800">
                        🏃‍♀️ 運動: {record.exercise?.type || '-'}{' '}
                        {record.exercise?.duration
                          ? `(${record.exercise.duration})`
                          : ''}
                      </p>
                    )}
                    {record.meal && (
                      <p className="text-gray-800">
                        🍽 食事:{' '}
                        {[
                          ...(record.meal?.staple ?? []),
                          ...(record.meal?.mainDish ?? []),
                          ...(record.meal?.sideDish ?? []),
                          record.meal?.other ?? '',
                        ]
                          .filter(Boolean)
                          .join('、') || '-'}
                      </p>
                    )}
                    {record.dailyLife && (
                      (() => {
                        const symptomsMatch = record.dailyLife.match(/【症状】([^【]*)/);
                        const memoMatch = record.dailyLife.match(/【メモ】(.*)/);
                        const symptoms = symptomsMatch ? symptomsMatch[1].trim() : '';
                        const memo = memoMatch ? memoMatch[1].trim() : '';
                        
                        return (
                          <>
                            {symptoms && (
                              <p className="text-gray-800">
                                💭 自覚症状: {symptoms}
                              </p>
                            )}
                            {memo && (
                      <p className="text-gray-800">
                                📝 その他: {memo}
                      </p>
                    )}
                          </>
                        );
                      })()
                    )}

                    {/* コメント履歴 */}
                    {(record.medicalComments?.length || 0) > 0 && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <div className="text-xs font-bold text-gray-700 mb-2">💬 コメント</div>
                        <div className="space-y-2">
                          {(record.medicalComments || []).map((c) => (
                            <div key={c.id} className="rounded-lg border border-blue-100 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] font-semibold text-gray-800 truncate">
                                  {c.provider?.name || c.provider?.email || '医療従事者'}
                                </div>
                                <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                  {formatDateTime(c.createdAt)}
                                </div>
                              </div>
                              <div className="mt-1 whitespace-pre-wrap text-[12px] text-gray-800">
                                {c.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 血液検査データ */}
            {selectedPatient && (
              <div className="mt-6">
                <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2">🩸 血液検査データ</h3>
                {loadingBloodData && <p className="text-sm text-gray-500">血液検査データを読み込み中です…</p>}
                {!loadingBloodData && bloodDataList.filter(hasAnyBloodValue).length === 0 && (
                  <p className="text-sm text-gray-500">血液検査データはまだ登録されていません。</p>
                )}
                {!loadingBloodData && bloodDataList.filter(hasAnyBloodValue).length > 0 && (
                  <div className="max-h-72 overflow-y-auto space-y-3">
                    {bloodDataList.filter(hasAnyBloodValue).map((b) => (
                      <div key={b.id} className="border border-gray-200 rounded-xl p-3 text-xs md:text-sm bg-orange-50">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-gray-800">{b.testDate}</span>
                          <span className="text-[10px] md:text-xs text-gray-500">
                            登録: {formatDateTime(b.createdAt)}
                          </span>
                        </div>
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              selectedPatient &&
                              openLabComment('blood', selectedPatient.userId, b.id, `血液検査: ${b.testDate}`)
                            }
                            className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
                          >
                            コメントする
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-800">
                          {b.hbA1c != null && <p><strong>HbA1c:</strong> {b.hbA1c}%</p>}
                          {b.randomBloodSugar != null && <p><strong>随時血糖:</strong> {b.randomBloodSugar} mg/dL</p>}
                          {b.totalCholesterol != null && <p><strong>総コレステロール:</strong> {b.totalCholesterol} mg/dL</p>}
                          {b.triglycerides != null && <p><strong>中性脂肪:</strong> {b.triglycerides} mg/dL</p>}
                          {b.hdlCholesterol != null && <p><strong>HDL:</strong> {b.hdlCholesterol} mg/dL</p>}
                          {b.ldlCholesterol != null && <p><strong>LDL:</strong> {b.ldlCholesterol} mg/dL</p>}
                          {b.bun != null && <p><strong>BUN:</strong> {b.bun} mg/dL</p>}
                          {b.creatinine != null && <p><strong>Cr:</strong> {b.creatinine} mg/dL</p>}
                          {b.uricAcid != null && <p><strong>尿酸:</strong> {b.uricAcid} mg/dL</p>}
                          {b.hemoglobin != null && <p><strong>Hb:</strong> {b.hemoglobin}</p>}
                          {b.bnp != null && <p><strong>BNP:</strong> {b.bnp} pg/mL</p>}
                        </div>

                        {/* コメント履歴（血液） */}
                        {(b.labComments?.length || 0) > 0 && (
                          <div className="mt-3 border-t border-orange-200 pt-3">
                            <div className="text-xs font-bold text-gray-700 mb-2">💬 コメント</div>
                            <div className="space-y-2">
                              {(b.labComments || []).map((c) => (
                                <div key={c.id} className="rounded-lg border border-purple-100 bg-white p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-[11px] font-semibold text-gray-800 truncate">
                                      {c.provider?.name || c.provider?.email || '医療従事者'}
                                    </div>
                                    <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                      {formatDateTime(c.createdAt)}
                                    </div>
                                  </div>
                                  <div className="mt-1 whitespace-pre-wrap text-[12px] text-gray-800">
                                    {c.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 運動負荷試験（CPX）データ */}
            {selectedPatient && (
              <div className="mt-6">
                <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2">🏃 運動負荷試験（CPX）データ</h3>
                {loadingBloodData && <p className="text-sm text-gray-500">運動負荷試験データを読み込み中です…</p>}
                {!loadingBloodData &&
                  bloodDataList.flatMap((b) => b.cpxTests || []).length === 0 && (
                    <p className="text-sm text-gray-500">運動負荷試験データはまだ登録されていません。</p>
                  )}
                {!loadingBloodData &&
                  bloodDataList.flatMap((b) => b.cpxTests || []).length > 0 && (
                    <div className="max-h-72 overflow-y-auto space-y-3">
                      {bloodDataList
                        .flatMap((b) => (b.cpxTests || []).map((c) => ({ c, parentDate: b.testDate })))
                        .sort((a, b) => (b.c.testDate || b.parentDate).localeCompare(a.c.testDate || a.parentDate))
                        .map(({ c, parentDate }) => (
                          <div key={c.id} className="border border-gray-200 rounded-xl p-3 text-xs md:text-sm bg-blue-50">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-semibold text-gray-800">
                                {(c.testDate || parentDate)} / CPX #{c.cpxRound}
                              </span>
                              <span className="text-[10px] md:text-xs text-gray-500">
                                登録: {formatDateTime(c.createdAt)}
                              </span>
                            </div>
                            <div className="mb-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  selectedPatient &&
                                  openLabComment(
                                    'cpx',
                                    selectedPatient.userId,
                                    c.id,
                                    `CPX: ${(c.testDate || parentDate)} / #${c.cpxRound}`
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700"
                              >
                                コメントする
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-gray-800">
                              {c.loadWeight != null && <p><strong>負荷:</strong> {c.loadWeight} W</p>}
                              {c.vo2 != null && <p><strong>VO2:</strong> {c.vo2}</p>}
                              {c.mets != null && <p><strong>Mets:</strong> {c.mets}</p>}
                              {c.heartRate != null && <p><strong>心拍:</strong> {c.heartRate} bpm</p>}
                              {c.systolicBloodPressure != null && <p><strong>収縮期血圧:</strong> {c.systolicBloodPressure} mmHg</p>}
                              {c.maxLoad != null && <p><strong>最大負荷:</strong> {c.maxLoad}</p>}
                              {c.atOneMinBefore != null && <p><strong>AT1分前:</strong> {c.atOneMinBefore}</p>}
                              {c.atDuring != null && <p><strong>AT中:</strong> {c.atDuring}</p>}
                            </div>
                            {c.findings && (
                              <p className="mt-2 text-gray-800">
                                <strong>所見:</strong> {c.findings}
                      </p>
                    )}

                            {/* コメント履歴（CPX） */}
                            {(c.labComments?.length || 0) > 0 && (
                              <div className="mt-3 border-t border-blue-200 pt-3">
                                <div className="text-xs font-bold text-gray-700 mb-2">💬 コメント</div>
                                <div className="space-y-2">
                                  {(c.labComments || []).map((cc) => (
                                    <div key={cc.id} className="rounded-lg border border-purple-100 bg-white p-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="text-[11px] font-semibold text-gray-800 truncate">
                                          {cc.provider?.name || cc.provider?.email || '医療従事者'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 whitespace-nowrap">
                                          {formatDateTime(cc.createdAt)}
                                        </div>
                                      </div>
                                      <div className="mt-1 whitespace-pre-wrap text-[12px] text-gray-800">
                                        {cc.content}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
            )}
          </section>
        </div>
      </div>
      </main>

      {/* コメント投稿モーダル */}
      {commentTarget && (
        <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-gray-900">コメントを送る</div>
                <div className="text-xs text-gray-600 mt-1">
                  対象: {commentTarget.date} {commentTarget.time}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCommentTarget(null)}
                className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="例）血圧が高めなので、塩分を少し控えてみましょう。体重は安定しています。"
              className="mt-4 w-full min-h-[120px] rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setCommentTarget(null)}
                className="flex-1 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={commentSaving}
                onClick={submitComment}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-60"
              >
                {commentSaving ? '送信中…' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 検査（血液/CPX）コメント投稿モーダル */}
      {labCommentTarget && (
        <div className="fixed inset-0 z-[110] bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-gray-900">検査コメントを送る</div>
                <div className="text-xs text-gray-600 mt-1">{labCommentTarget.label}</div>
              </div>
              <button
                type="button"
                onClick={() => setLabCommentTarget(null)}
                className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <textarea
              value={labCommentText}
              onChange={(e) => setLabCommentText(e.target.value)}
              placeholder="例）HbA1cが高めです。食事と運動を見直してみましょう。"
              className="mt-4 w-full min-h-[120px] rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setLabCommentTarget(null)}
                className="flex-1 py-2 rounded-xl bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={labCommentSaving}
                onClick={submitLabComment}
                className="flex-1 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-60"
              >
                {labCommentSaving ? '送信中…' : '送信する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
