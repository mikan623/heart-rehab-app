"use client";

import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { getCurrentUserId } from '@/lib/auth';

type InviteStatus = 'pending' | 'accepted' | 'declined' | string;

interface InviteItem {
  id: string;
  providerId: string;
  patientId: string;
  status: InviteStatus;
  createdAt: string;
  updatedAt: string;
  provider: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  provider: {
    id: string;
    name: string | null;
    email: string;
  };
  healthRecord: {
    id: string;
    date: string;
    time: string;
    bloodPressure: { systolic: number; diastolic: number };
    pulse: number | null;
    weight: number | null;
    exercise: { type?: string; duration?: string } | null;
    meal: { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null;
    dailyLife: string | null;
    medicationTaken: boolean | null;
  };
}

interface LabCommentItem {
  id: string;
  content: string;
  createdAt: string;
  provider?: { id?: string; name?: string | null; email?: string };
  kind: 'blood' | 'cpx';
  bloodData?: { testDate?: string | null } | null;
  cpx?: { testDate?: string | null; parentBloodTestDate?: string | null; cpxRound?: number | null } | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.error === 'string' ? value.error : undefined;

const isInviteItem = (value: unknown): value is InviteItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.providerId === 'string' &&
  typeof value.patientId === 'string' &&
  typeof value.status === 'string';

const isCommentItem = (value: unknown): value is CommentItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.content === 'string' &&
  isRecord(value.healthRecord);

const isLabCommentItem = (value: unknown): value is LabCommentItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.content === 'string' &&
  typeof value.kind === 'string';

const getInvites = (value: unknown): InviteItem[] =>
  isRecord(value) && Array.isArray(value.invites) ? value.invites.filter(isInviteItem) : [];

const getComments = (value: unknown): CommentItem[] =>
  isRecord(value) && Array.isArray(value.comments) ? value.comments.filter(isCommentItem) : [];

const getLabComments = (value: unknown): LabCommentItem[] =>
  isRecord(value) && Array.isArray(value.comments) ? value.comments.filter(isLabCommentItem) : [];

export default function MessagesClient() {
  const userId = useMemo(() => getCurrentUserId(), []);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [labComments, setLabComments] = useState<LabCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const fetchAll = async () => {
    try {
      setError(null);
      setLoading(true);
      if (!userId) {
        setInvites([]);
        setComments([]);
        setLoading(false);
        return;
      }
      const [invR, cR, labR] = await Promise.all([
        fetchJsonWithRetry(`/api/patient/invites?patientId=${encodeURIComponent(userId)}`),
        fetchJsonWithRetry(`/api/patient/comments?patientId=${encodeURIComponent(userId)}`),
        fetchJsonWithRetry(`/api/patient/lab-comments?patientId=${encodeURIComponent(userId)}`),
      ]);

      if (!invR.ok) {
        setInvites([]);
        setError(getErrorMessage(invR.data) || '招待の取得に失敗しました');
      } else {
        setInvites(getInvites(invR.data));
      }
      if (!cR.ok) {
        setComments([]);
        setError((prev) => prev || getErrorMessage(cR.data) || 'コメント通知の取得に失敗しました');
      } else {
        setComments(getComments(cR.data));
      }
      if (!labR.ok) {
        setLabComments([]);
        setError((prev) => prev || getErrorMessage(labR.data) || '検査コメント通知の取得に失敗しました');
      } else {
        setLabComments(getLabComments(labR.data));
      }
    } catch (e) {
      console.error(e);
      setError('メッセージの取得に失敗しました');
      setInvites([]);
      setComments([]);
      setLabComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchAll();
      // このページを開いたら未読をリセット（次回以降のバッジ計算に使う）
      // ユーザーIDごとに保持（複数アカウント/ロール切替でも取りこぼさない）
      if (typeof window !== 'undefined' && userId) {
        localStorage.setItem(`messagesLastSeen_${userId}`, String(Date.now()));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (inviteId: string, action: 'accept' | 'decline') => {
    if (!userId) return;
    try {
      setBusyId(inviteId);
      setError(null);
      const { ok, data } = await fetchJsonWithRetry(
        '/api/patient/invites/respond',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: userId, inviteId, action }),
        },
        2
      );
      if (!ok) {
        setError(getErrorMessage(data) || '操作に失敗しました');
        return;
      }
      await fetchAll();
    } catch (e) {
      console.error(e);
      setError('操作に失敗しました');
    } finally {
      setBusyId(null);
    }
  };

  const pendingInvites = invites.filter((i) => i.status === 'pending');
  const otherInvites = invites.filter((i) => i.status !== 'pending');

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <PageHeader title="メッセージ" />

      <main className="max-w-3xl mx-auto p-4 pb-28">
        {/* コメント通知 */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">医療従事者からのコメント</h2>
          <p className="text-sm text-gray-600 mb-4">
            健康記録に対して医療従事者が記載したコメントが届きます。
          </p>
          {!loading && error && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <div className="min-w-0 truncate">{error}</div>
              <button
                type="button"
                onClick={fetchAll}
                className="shrink-0 rounded-md bg-white border border-red-200 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
              >
                再読み込み
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-gray-600">読み込み中...</div>
          ) : comments.length === 0 ? (
            <div className="text-gray-600">コメントはありません。</div>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 truncate">
                        {c.provider?.name || c.provider?.email || '医療従事者'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        対象: {c.healthRecord.date} {c.healthRecord.time} / 受信: {new Date(c.createdAt).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700">
                      コメント
                    </span>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    {c.content}
                  </div>

                  {/* コメント対象の健康記録内容 */}
                  <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50/40 p-3 text-sm text-gray-800">
                    <div className="text-xs font-bold text-orange-700 mb-2">対象の健康記録</div>
                    <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
                      <div>🩺 血圧: {c.healthRecord.bloodPressure?.systolic}/{c.healthRecord.bloodPressure?.diastolic}</div>
                      <div>💓 脈拍: {c.healthRecord.pulse ?? '-'}</div>
                      <div>⚖️ 体重: {c.healthRecord.weight ?? '-'}</div>
                      <div>💊 服薬: {c.healthRecord.medicationTaken ? '済' : '未/不明'}</div>
                    </div>
                    {c.healthRecord.exercise && (
                      <div className="mt-2 text-xs text-gray-700">
                        🏃 運動: {c.healthRecord.exercise?.type || '-'} {c.healthRecord.exercise?.duration ? `(${c.healthRecord.exercise.duration})` : ''}
                      </div>
                    )}
                    {c.healthRecord.meal && (
                      <div className="mt-1 text-xs text-gray-700">
                        🍽 食事: {[
                          c.healthRecord.meal?.staple,
                          c.healthRecord.meal?.mainDish,
                          c.healthRecord.meal?.sideDish,
                          c.healthRecord.meal?.other,
                        ]
                          .flat()
                          .filter(Boolean)
                          .join('、') || '-'}
                      </div>
                    )}
                    {c.healthRecord.dailyLife && (
                      <div className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                        📝 メモ: {c.healthRecord.dailyLife}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 検査（血液/CPX）コメント通知 */}
        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4 mb-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">検査データへのコメント</h2>
          <p className="text-sm text-gray-600 mb-4">
            血液検査・運動負荷試験（CPX）に対するコメントが届きます。
          </p>

          {loading ? (
            <div className="text-gray-600">読み込み中...</div>
          ) : labComments.length === 0 ? (
            <div className="text-gray-600">コメントはありません。</div>
          ) : (
            <div className="space-y-3">
              {labComments.map((c) => (
                <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-gray-800 truncate">
                        {c.provider?.name || c.provider?.email || '医療従事者'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {c.kind === 'blood'
                          ? `血液検査: ${c.bloodData?.testDate || '-'}`
                          : `CPX: ${(c.cpx?.testDate || c.cpx?.parentBloodTestDate) || '-'} / #${c.cpx?.cpxRound ?? '-'}`}
                        {' / '}
                        受信: {new Date(c.createdAt).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700">
                      検査コメント
                    </span>
                  </div>

                  <div className="mt-3 whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    {c.content}
                  </div>

                  {c.kind === 'blood' && c.bloodData?.values && (
                    <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50/40 p-3 text-xs text-gray-800">
                      <div className="font-bold text-orange-700 mb-2">血液検査データ</div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(c.bloodData.values)
                          .filter(([, v]) => v !== null && v !== undefined && v !== '')
                          .slice(0, 10)
                          .map(([k, v]) => (
                            <div key={k}>
                              {k}: {String(v)}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {c.kind === 'cpx' && c.cpx?.values && (
                    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-xs text-gray-800">
                      <div className="font-bold text-blue-700 mb-2">CPXデータ</div>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(c.cpx.values)
                          .filter(([, v]) => v !== null && v !== undefined && v !== '')
                          .map(([k, v]) => (
                            <div key={k}>
                              {k}: {String(v)}
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

        <div className="bg-white rounded-2xl shadow-sm border border-orange-200 p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-1">医療従事者からの招待</h2>
          <p className="text-sm text-gray-600 mb-4">
            承認すると、医療従事者があなたの健康記録・血液検査・運動負荷試験のデータを閲覧できるようになります。
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-gray-600">読み込み中...</div>
          ) : (
            <>
              {pendingInvites.length === 0 && otherInvites.length === 0 && (
                <div className="text-gray-600">招待はありません。</div>
              )}

              {pendingInvites.length > 0 && (
                <div className="mb-6">
                  <div className="text-sm font-bold text-orange-700 mb-2">未対応</div>
                  <div className="space-y-3">
                    {pendingInvites.map((inv) => (
                      <div key={inv.id} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-gray-800 truncate">
                              {inv.provider?.name || inv.provider?.email || '医療従事者'}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              受信: {new Date(inv.createdAt).toLocaleString('ja-JP')}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full bg-white border border-orange-200 text-orange-700">
                            招待
                          </span>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={busyId === inv.id}
                            onClick={() => respond(inv.id, 'accept')}
                            className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                          >
                            承認
                          </button>
                          <button
                            type="button"
                            disabled={busyId === inv.id}
                            onClick={() => respond(inv.id, 'decline')}
                            className="flex-1 rounded-lg bg-gray-200 py-2 text-xs font-bold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                          >
                            拒否
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {otherInvites.length > 0 && (
                <div>
                  <div className="text-sm font-bold text-gray-700 mb-2">履歴</div>
                  <div className="space-y-2">
                    {otherInvites.map((inv) => (
                      <div key={inv.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                        {inv.provider?.name || inv.provider?.email || '医療従事者'} - {inv.status}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
