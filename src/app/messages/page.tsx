'use client';

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
    exercise: any;
    meal: any;
    dailyLife: string | null;
    medicationTaken: boolean | null;
  };
}

export default function MessagesPage() {
  const userId = useMemo(() => getCurrentUserId(), []);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [labComments, setLabComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      const [invRes, cRes, labRes] = await Promise.all([
        fetch(`/api/patient/invites?patientId=${encodeURIComponent(userId)}`),
        fetch(`/api/patient/comments?patientId=${encodeURIComponent(userId)}`),
        fetch(`/api/patient/lab-comments?patientId=${encodeURIComponent(userId)}`),
      ]);
      const [invData, cData, labData] = await Promise.all([invRes.json(), cRes.json(), labRes.json()]);
      if (!invRes.ok) {
        setInvites([]);
        setError(invData?.error || '招待の取得に失敗しました');
      } else {
        setInvites(invData?.invites || []);
      }
      if (!cRes.ok) {
        setComments([]);
        setError((prev) => prev || cData?.error || 'コメント通知の取得に失敗しました');
      } else {
        setComments(cData?.comments || []);
      }
      if (!labRes.ok) {
        setLabComments([]);
        setError((prev) => prev || labData?.error || '検査コメント通知の取得に失敗しました');
      } else {
        setLabComments(labData?.comments || []);
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
    fetchAll();
    // このページを開いたら未読をリセット（次回以降のバッジ計算に使う）
    if (typeof window !== 'undefined') {
      localStorage.setItem('messagesLastSeen', String(Date.now()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = async (inviteId: string, action: 'accept' | 'decline') => {
    if (!userId) return;
    try {
      setBusyId(inviteId);
      setError(null);
      const res = await fetch('/api/patient/invites/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: userId, inviteId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || '操作に失敗しました');
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
              {labComments.map((c: any) => (
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
                            className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold disabled:opacity-60"
                          >
                            承認する
                          </button>
                          <button
                            type="button"
                            disabled={busyId === inv.id}
                            onClick={() => respond(inv.id, 'decline')}
                            className="flex-1 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-60"
                          >
                            拒否する
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
                      <div key={inv.id} className="rounded-xl border border-gray-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-800 truncate">
                              {inv.provider?.name || inv.provider?.email || '医療従事者'}
                            </div>
                            <div className="text-xs text-gray-600">
                              {new Date(inv.updatedAt).toLocaleString('ja-JP')}
                            </div>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              inv.status === 'accepted'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                          >
                            {inv.status === 'accepted' ? '承認済み' : '拒否'}
                          </span>
                        </div>
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


