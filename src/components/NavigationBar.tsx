"use client";
import { useState, useEffect } from "react";
import { clearLineLogin, clearSession, getCurrentUserId } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { HealthRecordIcon, CalendarIcon, ProfileIcon, GraphIcon, FamilyIcon, SettingsIcon, TestIcon } from './NavIcons';

type StoredUser = {
  userId: string;
  displayName: string;
};

type HealthRecordPrintable = {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  weight: string;
  exercise: { type: string; duration: string };
  meal: { staple: string; mainDish: string; sideDish: string; other: string };
  dailyLife: string;
  medicationTaken?: boolean;
};

type SavedRecords = Record<string, Record<string, HealthRecordPrintable>>;

type ProfilePrintable = {
  displayName?: string;
  age?: string | number | null;
  gender?: string | null;
  targetWeight?: string | number | null;
  diseases?: string[] | null;
  medications?: string | null;
  physicalFunction?: string | null;
  emergencyContact?: string | null;
};

type BloodDataItem = {
  testDate?: string | Date | null;
  hbA1c?: unknown;
  randomBloodSugar?: unknown;
  totalCholesterol?: unknown;
  triglycerides?: unknown;
  hdlCholesterol?: unknown;
  ldlCholesterol?: unknown;
  bun?: unknown;
  creatinine?: unknown;
  uricAcid?: unknown;
  hemoglobin?: unknown;
  bnp?: unknown;
  cpxTests?: CpxTestItem[];
};

type CpxTestItem = {
  testDate?: string | Date | null;
  cpxRound?: unknown;
  loadWeight?: unknown;
  vo2?: unknown;
  mets?: unknown;
  heartRate?: unknown;
  systolicBloodPressure?: unknown;
  maxLoad?: unknown;
  atOneMinBefore?: unknown;
  atDuring?: unknown;
  findings?: unknown;
};

type HealthRecordApi = {
  date: string;
  time: string;
  bloodPressure: { systolic: number | string; diastolic: number | string };
  pulse?: number | null;
  weight?: number | null;
  exercise?: { type?: string; duration?: string } | null;
  meal?: { staple?: string; mainDish?: string; sideDish?: string; other?: string } | null;
  dailyLife?: string | null;
};

type HealthRecordsResponse = { records: HealthRecordApi[] };

type UnreadCountResponse = { total?: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isSavedRecords = (value: unknown): value is SavedRecords => isRecord(value);
const isProfilePrintable = (value: unknown): value is ProfilePrintable => isRecord(value);
const isBloodDataItem = (value: unknown): value is BloodDataItem => isRecord(value);

const parseSavedRecords = (value: unknown): SavedRecords =>
  isSavedRecords(value) ? value : {};

const parseProfile = (value: unknown): ProfilePrintable =>
  isProfilePrintable(value) ? value : {};

const parseBloodDataList = (value: unknown): BloodDataItem[] =>
  Array.isArray(value) ? value.filter(isBloodDataItem) : [];

// 学ぶアイコン
const LearnIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 7V12C2 16.55 3.84 20.74 6.78 23.9C7.94 25.08 9.23 26.01 10.58 26.72C11.04 26.97 11.51 27.19 12 27.38C12.49 27.19 12.96 26.97 13.42 26.72C14.77 26.01 16.06 25.08 17.22 23.9C20.16 20.74 22 16.55 22 12V7L12 2M12 4.18L20 7.5V12C20 16.88 18.72 21.24 16.54 24.8C15.84 25.56 15.09 26.25 14.3 26.87C13.41 26.47 12.56 25.97 11.76 25.38C10.97 24.8 10.25 24.12 9.59 23.4C7.78 21.08 6.54 18.16 6.05 15H12V13H6.05V12C6.05 9.85 6.58 7.82 7.51 6.06C8.45 4.29 9.74 2.84 11.25 1.84V4.18H12Z" />
  </svg>
);

export default function NavigationBar() {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [loginRole, setLoginRole] = useState<'patient' | 'medical' | null>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [printMonth, setPrintMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // localStorageキーをユーザーIDで個別化
  const getStorageKey = (baseKey: string) => {
    try {
      if (user?.userId) {
        return `${baseKey}_${user.userId}`;
      }
      // ローカル開発時はユーザーIDなしでも動くようフォールバック
      return `${baseKey}_local`;
    } catch (error) {
      return `${baseKey}_local`;
    }
  };

  // ローカルストレージからログインユーザー情報を取得
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedId = localStorage.getItem('userId');
      const storedName = localStorage.getItem('userName') || '';
      if (storedId) {
        setUser({ userId: storedId, displayName: storedName });
          }
    } catch (e) {
      console.log('⚠️ NavigationBar: ユーザー情報読み込みエラー（無視）', e);
        }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('loginRole');
    if (stored === 'patient' || stored === 'medical') {
      setLoginRole(stored);
    }
  }, []);

  // 未読数（招待pending + messagesLastSeen以降のコメント数）を取得してバッジ表示
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loginRole === 'medical') {
      setUnreadCount(0);
      return;
    }
    const uid = getCurrentUserId();
    if (!uid) {
      setUnreadCount(0);
      return;
          }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    type FetchResult<T = unknown> =
      | { ok: true; status: number; data: T }
      | { ok: false; status: number; data: T };

    const fetchJsonWithRetry = async (url: string, init?: RequestInit, retries = 2): Promise<FetchResult> => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await apiFetch(url, { ...init, cache: 'no-store' });
          const data = await res.json().catch(() => ({}));
          if (res.ok) return { ok: true, status: res.status, data };
          // 一時障害はリトライ
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

    const fetchCount = async () => {
      try {
        // ユーザーIDごとにlastSeenを分ける（複数アカウント/ロール切替でも取りこぼさない）
        const lastSeenKey = `messagesLastSeen_${uid}`;
        const lastSeen = Number(localStorage.getItem(lastSeenKey) || '0');
        const { ok, data } = await fetchJsonWithRetry(
          `/api/patient/unread-count?patientId=${encodeURIComponent(uid)}&since=${encodeURIComponent(String(lastSeen))}`
        );
        if (!ok) return;
        const total =
          isRecord(data) && 'total' in data ? Number(data.total) : 0;
        setUnreadCount(Number.isFinite(total) ? total : 0);
      } catch (e) {
        console.log('⚠️ NavigationBar: 未読数取得に失敗（無視）', e);
      }
    };

    fetchCount();
    const id = window.setInterval(fetchCount, 30000);
    return () => window.clearInterval(id);
  }, [loginRole]);

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  // 医療機関用データエクスポート（旧機能）は廃止済み

  const formatTime24h = (t: string) => {
    // morning/afternoon/evening を時刻へ
    if (t === 'morning') return '08:00';
    if (t === 'afternoon') return '14:00';
    if (t === 'evening') return '20:00';
    // AM/PM → 24時間
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const mm = m[2];
      const ap = m[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${mm}`;
    }
    // すでに 06:00 形式ならそのまま
    const m24 = t.match(/^\d{1,2}:\d{2}$/);
    if (m24) {
      const [h, mm] = t.split(':');
      return `${String(Number(h)).padStart(2, '0')}:${mm}`;
    }
    return t;
  };

  // PDF出力関数
  const exportToPDF = async (targetMonth?: string) => {
    try {
      const month = targetMonth ?? printMonth;
      const res = await apiFetch(`/api/pdf/health-records?month=${month}`);
      if (!res.ok) throw new Error('PDF生成に失敗しました');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `心臓リハビリ手帳_${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF出力エラー:', error);
      alert('PDF出力に失敗しました。');
    }
  };

  // ログアウト処理
  const handleLogout = async () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('justLoggedOut', '1');
        sessionStorage.removeItem('redirectedToLiff');
      }

      await apiFetch('/api/auth/logout', { method: 'POST' });

      clearSession();
      clearLineLogin();
      console.log('✅ ログイン情報をクリア');

      if (typeof window !== 'undefined' && window.liff) {
        try {
          if (
            window.liff.isLoggedIn &&
            typeof window.liff.isLoggedIn === 'function' &&
            window.liff.isLoggedIn()
          ) {
            window.liff.logout();
            console.log('✅ LINE ログアウト完了');
          }
        } catch (liffError) {
          console.log('⚠️ LINE ログアウトスキップ（LIFF 未初期化）:', liffError);
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
            console.log('🗑️ ローカルストレージをクリア:', key);
          }
        });

        localStorage.removeItem('loginRole');
        setShowSettingsMenu(false);
        window.location.replace('/');
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('justLoggedOut');
      }
      console.error('ログアウトエラー:', error);
      alert('ログアウトに失敗しました');
    }
  };

  // 設定メニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest('.relative')) {
        setShowSettingsMenu(false);
      }
    };

    if (showSettingsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettingsMenu]);

  return (
    <div className="flex justify-between items-start gap-1 pb-1">
      {/* 左側：ナビゲーションボタン（スクロール可能） */}
      <div className="flex gap-0.5 overflow-x-auto pb-1 flex-1">
        {loginRole === 'medical' ? (
          <div className="flex items-center px-2 py-1 text-xs font-semibold text-orange-700 whitespace-nowrap">
            医療従事者モード
          </div>
        ) : (
          <>
        <button 
          onClick={() => {
            setActiveButton('health-records');
            setTimeout(() => window.location.href = '/health-records', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'health-records' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(health_rocords).jpg" alt="健康記録" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">健康記録</span>
        </button>
        <button 
          onClick={() => {
            setActiveButton('calendar');
            setTimeout(() => window.location.href = '/calendar', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'calendar' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(calendar).jpg" alt="カレンダー" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">カレンダー</span>
        </button>
        <button 
          onClick={() => {
            setActiveButton('learn');
            setTimeout(() => window.location.href = '/learn', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'learn' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(learn).png" alt="学ぶ" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">学ぶ</span>
        </button>
        <button
          onClick={() => {
            setActiveButton('test');
            setTimeout(() => window.location.href = '/blood-data', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'test' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(test).jpg" alt="検査" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">検査</span>
        </button>
        <button 
          onClick={() => {
            setActiveButton('graph');
            setTimeout(() => window.location.href = '/graph', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'graph' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(graph).jpg" alt="グラフ" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">グラフ</span>
        </button>
        <button 
          onClick={() => {
            setActiveButton('family');
            setTimeout(() => window.location.href = '/family', 150);
          }}
          className={`flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'family' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(family).jpg" alt="家族" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">家族</span>
        </button>
          </>
        )}
      </div>
  
      {/* 右側：メニューボタン（固定） */}
      <div className="relative">
        <button 
          onClick={() => {
            setActiveButton('menu');
            setTimeout(() => setActiveButton(null), 300);
            console.log('メニューボタンがクリックされました');
            console.log('現在のshowSettingsMenu:', showSettingsMenu);
            setShowSettingsMenu(!showSettingsMenu);
          }}
          className={`relative flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[40px] md:min-w-[60px] ${activeButton === 'menu' ? 'click-animate' : ''}`}>
          <img src="/Navigationbar(menu).jpg" alt="メニュー" className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[10px] md:text-xs">メニュー</span>
          {loginRole !== 'medical' && unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold">
              {badgeLabel}
            </span>
          )}
        </button>
  
        {showSettingsMenu && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-1">
              {loginRole !== 'medical' && (
                <>
                  <button
                    onClick={() => {
                      setActiveButton('messages');
                      setTimeout(() => {
                        window.location.href = '/messages';
                        setShowSettingsMenu(false);
                      }, 150);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'messages' ? 'click-animate' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span>📩 メッセージ</span>
                      {unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[18px] text-center font-bold">
                          {badgeLabel}
                        </span>
                      )}
                    </div>
                  </button>
                  <hr className="my-1" />
                </>
              )}
              <button
                onClick={() => {
                  setActiveButton('profile');
                  setTimeout(() => {
                    window.location.href = '/profile';
                    setShowSettingsMenu(false);
                  }, 150);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'profile' ? 'click-animate' : ''}`}>
                👤 プロフィール
              </button>
              <hr className="my-1" />
              <button
                onClick={() => {
                  setActiveButton('terms');
                  setTimeout(() => {
                  window.location.href = '/terms';
                  setShowSettingsMenu(false);
                  }, 150);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'terms' ? 'click-animate' : ''}`}>
                📋 利用規約
              </button>
              <button 
                onClick={() => {
                  setActiveButton('privacy');
                  setTimeout(() => {
                    window.location.href = '/privacy';
                    setShowSettingsMenu(false);
                  }, 150);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'privacy' ? 'click-animate' : ''}`}>
                🔒 プライバシーポリシー
              </button>
              <button
                onClick={() => {
                  setActiveButton('contact');
                  setTimeout(() => {
                    window.location.href = '/contact';
                    setShowSettingsMenu(false);
                  }, 150);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'contact' ? 'click-animate' : ''}`}>
                ✉️ お問い合わせ
              </button>
              <div id="tour-health-pdf" className="relative">
                <button
                  onClick={() => {
                    setActiveButton('pdf');
                    setShowPdfOptions((prev) => !prev);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-all ${activeButton === 'pdf' ? 'click-animate' : ''}`}>
                  📄 PDF印刷
                </button>
                {showPdfOptions && (
                  <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[220px]">
                    <p className="text-xs text-gray-500 mb-2">診察時に医師へ渡すPDFを印刷できます</p>
                    <div className="flex items-center gap-2 mb-3">
                      <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">対象月：</label>
                      <input
                        type="month"
                        value={printMonth}
                        onChange={(e) => setPrintMonth(e.target.value)}
                        className="flex-1 px-2 py-1 border border-orange-300 rounded text-sm focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setShowPdfOptions(false);
                        setShowSettingsMenu(false);
                        setActiveButton(null);
                        exportToPDF(printMonth);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 active:scale-95 transition text-sm"
                    >
                      📄 診察持参PDFを印刷
                    </button>
                  </div>
                )}
              </div>
              <hr className="my-1" />
              <button
                onClick={() => {
                  setActiveButton('logout');
                  setTimeout(() => {
                    handleLogout();
                  }, 150);
                }}
                className={`w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-medium transition-all ${activeButton === 'logout' ? 'click-animate' : ''}`}>
                🚪 ログアウト
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}