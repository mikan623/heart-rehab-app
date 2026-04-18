"use client";

import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";
import { buildLiffUrl } from "@/lib/liffUrl";

// 家族メンバーの型定義
interface FamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  lineUserId?: string;
  isRegistered: boolean; // string から boolean に変更
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeFamilyMembers = (raw: unknown): FamilyMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map((m) => ({
      id: typeof m.id === 'string' ? m.id : '',
      name: typeof m.name === 'string' ? m.name : '',
      email: typeof m.email === 'string' ? m.email : '',
      relationship: typeof m.relationship === 'string' ? m.relationship : '',
      lineUserId: typeof m.lineUserId === 'string' ? m.lineUserId : undefined,
      isRegistered: m.isRegistered === true || m.isRegistered === 'true',
    }))
    .filter((m) => m.id || m.name || m.email);
};

type Props = {
  userId: string;
  initialFamilyMembers: FamilyMember[];
  initialReminderEnabled: boolean;
  initialReminderTime: string;
  initialSelfLinkCode: string | null;
};

export default function FamilyPage({ userId, initialFamilyMembers, initialReminderEnabled, initialReminderTime, initialSelfLinkCode }: Props) {
  const currentUserId = userId;
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>(initialFamilyMembers);

  // 🆕 追加：LINEミニアプリ最適化用の状態（デフォルト値）
  const [isLineApp] = useState(false);
  const [lineSafeArea] = useState({ top: 0, bottom: 0 });

  // 家族用招待QRコード用の状態（全体用）
  const [inviteQrUrl, setInviteQrUrl] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // 記録忘れリマインダー設定
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderEnabled);
  const [reminderTime, setReminderTime] = useState(initialReminderTime);

  // 本人用招待コード（公式LINEとの連携用）
  const [selfLinkCode, setSelfLinkCode] = useState<string | null>(initialSelfLinkCode);
  const isFirstRender = useRef(true);

  // 本人用招待コードを取得
  const fetchSelfLinkCode = async (userId: string) => {
    try {
      if (!userId) return;
      const res = await apiFetch(`/api/self-link-code?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        console.error('❌ self-link-code 取得失敗:', res.status);
        return;
      }
      const data = await res.json();
      if (data.code) {
        setSelfLinkCode(data.code);
      }
    } catch (error) {
      console.error('❌ self-link-code 取得エラー:', error);
    }
  };


  // 設定変更時に保存（localStorage + DB）。初回レンダー（SSRからの初期値）はスキップ
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (typeof window === 'undefined') return;

    // localStorage
    localStorage.setItem('reminderEnabled', String(reminderEnabled));
    localStorage.setItem('reminderTime', reminderTime);

    // DB
    const saveToDb = async () => {
      if (!currentUserId) return;
      try {
        await apiFetch('/api/reminder-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, reminderEnabled, reminderTime }),
        });
      } catch (error) {
        console.error('❌ リマインダー設定保存エラー:', error);
      }
    };

    saveToDb();
  }, [reminderEnabled, reminderTime, currentUserId]);

  // 少なくとも1人でもLINE通知先があるかどうか（家族の登録状況から判定）
  const hasLineShareDestination = familyMembers.some(
    (member) => Boolean(member.lineUserId) && Boolean(member.isRegistered)
  );


  // 家族用招待QRコードを生成（家族メンバー共通）
  const generateFamilyInviteQr = async () => {
    try {
      if (!currentUserId) {
        alert('ユーザー情報の取得に失敗しました。もう一度ページを開き直してください。');
        return;
      }

      setGeneratingInvite(true);

      const response = await apiFetch('/api/family-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        console.error('❌ 招待リンク作成失敗:', response.status);
        alert('招待用QRコードの作成に失敗しました。時間をおいて再度お試しください。');
        return;
      }

      const data = await response.json();
      const inviteId = typeof data.inviteId === 'string' ? data.inviteId : '';

      // LIFF の URL を生成（LINE上で開く想定）
      let inviteUrl = '';
      const liffUrl = buildLiffUrl(`/family-invite?familyInviteId=${inviteId}`);
      if (liffUrl) {
        inviteUrl = liffUrl;
      } else if (typeof window !== 'undefined') {
        inviteUrl = `${window.location.origin}/family-invite?familyInviteId=${inviteId}`;
      }

      setInviteQrUrl(inviteUrl);

      console.log('✅ 家族招待URL生成:', inviteUrl);
    } catch (error) {
      console.error('❌ 招待QR生成エラー:', error);
      alert('招待用QRコードの作成に失敗しました。');
    } finally {
      setGeneratingInvite(false);
    }
  };

  // 家族メンバーを削除する関数（データベース連携）
  const removeFamilyMember = async (id: string) => {
    try {
      // データベースのIDかチェック（cuidの形式）
      if (id.length > 15) {
        // データベースから削除
        const response = await apiFetch(`/api/family-members?memberId=${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log('✅ データベースから削除成功');
        } else {
          console.error('❌ データベース削除失敗');
        }
      }
      
      // ローカルステートから削除
      setFamilyMembers(prev => {
        const updated = prev.filter(member => member.id !== id);
        localStorage.setItem('familyMembers', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('削除エラー:', error);
      // エラーでもローカルからは削除
      setFamilyMembers(prev => {
        const updated = prev.filter(member => member.id !== id);
        localStorage.setItem('familyMembers', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // ※ 共有設定画面では、記録忘れリマインダーのON/OFFと時刻のみを管理します。

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* 🆕 LINEアプリ用スタイル */}
      {typeof window !== 'undefined' && isLineApp && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .line-app-container {
              height: calc(100vh - 60px);
              overflow-y: auto;
              -webkit-overflow-scrolling: touch;
            }
            .line-app-container input,
            .line-app-container select,
            .line-app-container textarea {
              font-size: 16px !important;
              transform: translateZ(0);
            }
            .line-app-container input[type="number"] {
              -webkit-appearance: textfield;
              -moz-appearance: textfield;
            }
            .line-app-container input:not([type="number"]),
            .line-app-container select,
            .line-app-container textarea {
              -webkit-appearance: none;
            }
            .line-app-container button {
              min-height: 44px;
              padding: 12px 16px;
            }
            .line-app-container * {
              -webkit-overflow-scrolling: touch;
            }
          `
        }} />
      )}
      <PageHeader
        title="家族共有設定"
        isLineApp={isLineApp}
        lineSafeAreaTop={isLineApp ? lineSafeArea.top : undefined}
      />

      {/* メインコンテンツ */}
      <main 
        className={`p-4 md:p-6 space-y-6 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '16px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '16px',
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        {/* 家族メンバー管理セクション */}
        <div className="bg-orange-50 rounded-lg border-2 border-orange-300 p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
              👨‍👩‍👧‍👦 家族メンバー
            </h2>
          </div>

          {/* 共通QRコード表示エリア：左 = 家族用招待QR / 右 = 公式アカウントQR */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-gray-800">家族用招待QRコード</p>
              {inviteQrUrl && (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      inviteQrUrl
                    )}`}
                    alt="家族用招待QRコード"
                    className="w-40 h-40 bg-white p-2 rounded-lg border border-orange-200"
                  />
                </>
              )}
              <p className="text-xs text-gray-500 text-center break-all">
                「📱 家族用QRコードを表示」ボタンを押すと、ここに招待用QRコードが表示されます。
              </p>
            <button
                onClick={generateFamilyInviteQr}
                disabled={generatingInvite || !currentUserId}
                className="mt-1 py-2 px-4 rounded-lg font-semibold text-sm md:text-base border border-orange-400 text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-60"
            >
                {generatingInvite ? 'QRコード生成中...' : '📱 家族用QRコードを表示'}
            </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">心臓リハビリ手帳 公式LINEアカウント</p>
              <img
                src="/line-official-qr.png"
                alt="心臓リハビリ手帳 公式LINEアカウント QRコード"
                className="w-40 h-40 bg-white p-2 rounded-lg border border-green-300"
              />
              <p className="text-xs text-gray-500 text-center">
                このQRコードをLINEアプリで読み取ると、心臓リハビリ手帳の公式アカウントを友だち追加できます。
              </p>
            </div>
          </div>

          {/* 共有設定セクション（QRコードの直下） */}
          <div className="bg-blue-50 rounded-lg border-2 border-blue-300 p-4 md:p-6 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
            📤 共有設定
          </h2>

          <div className="space-y-4 mb-2">
            {/* 健康記録の自動共有ステータス */}
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border-2 ${
                hasLineShareDestination
                  ? 'bg-white border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div
                className={`w-7 h-7 flex items-center justify-center rounded border-2 ${
                  hasLineShareDestination ? 'border-blue-400 bg-blue-50' : 'border-gray-400 bg-white'
                }`}
              >
                {hasLineShareDestination && (
                  <span className="text-blue-500 text-xl">✓</span>
                )}
              </div>
              <div>
                <p
                  className={`text-lg font-semibold ${
                    hasLineShareDestination ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  健康記録は自動でLINEに共有されます
                </p>
                <p
                  className={`text-xs mt-1 ${
                    hasLineShareDestination ? 'text-gray-500' : 'text-gray-400'
                  }`}
                >
                  {hasLineShareDestination
                    ? '健康記録を保存すると、ご家族と本人のLINEに自動で通知されます。'
                    : 'ご家族やご自身のLINE連携を設定すると、健康記録を保存したときに自動で通知されます。'}
                </p>
              </div>
            </div>

            {/* リマインダー機能（オン・オフ＋時刻設定） */}
            <label className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-50">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="w-7 h-7 text-blue-500"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                <div>
                  <p className="text-lg font-semibold text-gray-800">記録忘れリマインダーを使う</p>
                  <p className="text-xs text-gray-500 mt-1">
                    毎日指定した時間に、記録を忘れないようLINEでお知らせする設定です。
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:pr-2">
                <span className="text-xs text-gray-500">通知時刻</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="border border-blue-300 rounded-md px-2 py-1 text-sm text-gray-800 bg-white"
                />
              </div>
            </label>
          </div>
        </div>

          {/* 家族メンバーリスト（名前と削除のみ） */}
          <div className="space-y-3">
            {familyMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border-2 border-orange-200 px-4 py-3 flex justify-between items-center">
                <span className="text-lg font-bold text-gray-800">
                  {member.name || '（名前未設定）'}
                </span>
                <button
                  onClick={() => removeFamilyMember(member.id)}
                  className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 font-medium text-sm"
                >
                  🗑️ 削除
                </button>
              </div>
            ))}
            {familyMembers.length === 0 && (
              <div className="text-center py-8 bg-orange-100 rounded-lg">
                <p className="text-lg font-bold text-gray-700 mb-1">家族メンバーが登録されていません</p>
                <p className="text-sm text-gray-600">「➕ 追加」ボタンから家族メンバーを追加してください</p>
              </div>
            )}
          </div>
        </div>

        {/* 本人用招待コード案内（公式LINEに送るコード） */}
        {selfLinkCode && (
          <section className="mt-6 bg-green-50 border border-green-300 px-4 py-3 rounded-lg">
            <p className="text-green-800 text-sm font-semibold mb-1">
              ご自身のLINEにも健康記録の通知を受け取りたい方へ
            </p>
            <p className="text-green-800 text-xs md:text-sm mb-2">
              公式アカウントを友だち追加したあと、
              <span className="font-bold"> このコードをトークで送信してください。</span>
              （1回送るだけでOKです）
            </p>
            <div className="inline-block bg-white px-4 py-2 rounded-md border border-green-400 font-mono text-lg tracking-widest text-green-900">
              {selfLinkCode}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
