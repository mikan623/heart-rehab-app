"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, isLineLoggedIn, setLineLogin, setLineLoggedInDB } from "@/lib/auth";
import { HealthRecordIcon, CalendarIcon, GraphIcon, FamilyIcon, TestIcon, SettingsIcon } from "@/components/NavIcons";

// 学ぶアイコン
const LearnIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 7V12C2 16.55 3.84 20.74 6.78 23.9C7.94 25.08 9.23 26.01 10.58 26.72C11.04 26.97 11.51 27.19 12 27.38C12.49 27.19 12.96 26.97 13.42 26.72C14.77 26.01 16.06 25.08 17.22 23.9C20.16 20.74 22 16.55 22 12V7L12 2M12 4.18L20 7.5V12C20 16.88 18.72 21.24 16.54 24.8C15.84 25.56 15.09 26.25 14.3 26.87C13.41 26.47 12.56 25.97 11.76 25.38C10.97 24.8 10.25 24.12 9.59 23.4C7.78 21.08 6.54 18.16 6.05 15H12V13H6.05V12C6.05 9.85 6.58 7.82 7.51 6.06C8.45 4.29 9.74 2.84 11.25 1.84V4.18H12Z" />
  </svg>
);
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// 健康記録の型定義
interface HealthRecord {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  weight: string;
  medicationTaken?: boolean;
  dailyLife?: string;
}

interface WeekData {
  labels: string[]; // 日付ラベル ('9/24', '9/25'...)
  bloodPressureSystolic: number[]; // 朝の血圧
  bloodPressureDiastolic: number[];
  bloodPressureNightSystolic: number[]; // 夜の血圧（あれば）
  bloodPressureNightDiastolic: number[];
  pulse: number[];
  weight: number[];
  dates: string[]; // 完全な日付 ('2025-09-24')
}

export default function GraphPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedRecords, setSavedRecords] = useState<{ [key: string]: { [key: string]: HealthRecord } }>({});
  const [user, setUser] = useState<any>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'bloodPressure' | 'pulse' | 'weight'>('bloodPressure');
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });
  const [weekOffset, setWeekOffset] = useState(0); // 0 = 現在週、-1 = 先週
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  // 7日間平均表示は不要になったため削除

  // ローカルタイムでYYYY-MM-DDを生成（UTCずれ防止）
  const formatDateLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // APIからのdate文字列をグラフ用キーに正規化
  const normalizeDateKey = (raw: string | undefined) => {
    if (!raw) return '';
    // ISO形式なら T で分割
    if (raw.includes('T')) return raw.split('T')[0];
    // スラッシュ区切りをハイフンに
    return raw.replace(/\//g, '-');
  };

  const localStorageKey = (baseKey: string, overrideUserId?: string) => {
    const resolvedUserId = overrideUserId || user?.userId;
    if (resolvedUserId) {
      return `${baseKey}_${resolvedUserId}`;
    }
    return `${baseKey}_local`;
  };

  const loadLocalRecords = (overrideUserId?: string) => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(localStorageKey('healthRecords', overrideUserId));
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  };

  const loadLocalProfileTargetWeight = (overrideUserId?: string): number | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(localStorageKey('profile', overrideUserId));
      if (!raw) return null;
      const p = JSON.parse(raw);
      const tw = p?.targetWeight;
      if (tw === null || tw === undefined || tw === '') return null;
      const n = typeof tw === 'number' ? tw : Number(tw);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  // 認証チェック
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const session = getSession();
    if (session) {
      setUser(session);
      setIsAuthenticated(true);
    } else if (isLineLoggedIn() && typeof window.liff !== 'undefined') {
      setIsAuthenticated(true);
    } else {
      router.push('/');
      return;
    }

    // LINE アプリのセーフエリア検出
    if (typeof window.liff !== 'undefined') {
      try {
        const inlineTop = window.liff.getInlineTopAreaHeight?.() || 0;
        const inlineBottom = window.liff.getInlineBottomAreaHeight?.() || 0;
        setLineSafeArea({ top: inlineTop, bottom: inlineBottom });
        setIsLineApp(true);
      } catch (error) {
        console.log('Not in LINE app');
      }
    }

    // ヘルスレコード取得
    const fetchRecords = async () => {
      try {
        const userId = session?.userId || localStorage.getItem('userId');
        if (!userId) return;

        const res = await fetch(`/api/health-records?userId=${userId}`);
        if (res.ok) {
          const data = await res.json();
          const records = Array.isArray(data.records) ? data.records : [];

          // 日付→時刻→記録 のマップに整形
          const grouped: { [date: string]: { [time: string]: HealthRecord } } = {};
          records.forEach((r: any) => {
            const date = normalizeDateKey(r.date);
            const time = r.time || '08:00';
            if (!grouped[date]) grouped[date] = {};
            grouped[date][time] = {
              bloodPressure: r.bloodPressure || { systolic: '', diastolic: '' },
              pulse: r.pulse?.toString?.() || '',
              weight: r.weight?.toString?.() || '',
              medicationTaken: r.medicationTaken ?? false,
              dailyLife: r.dailyLife || '',
            };
          });

          // ローカルストレージのバックアップもマージ
          const localSaved = loadLocalRecords(session?.userId);
          Object.entries(localSaved).forEach(([dateKey, times]: any) => {
            const normalizedDate = normalizeDateKey(dateKey);
            if (!normalizedDate) return;
            if (!grouped[normalizedDate]) grouped[normalizedDate] = {};
            Object.entries(times).forEach(([timeKey, entry]: any) => {
              grouped[normalizedDate][timeKey] = {
                bloodPressure: entry.bloodPressure || { systolic: '', diastolic: '' },
                pulse: entry.pulse?.toString?.() || '',
                weight: entry.weight?.toString?.() || '',
                medicationTaken: entry.medicationTaken ?? false,
                dailyLife: entry.dailyLife || '',
              };
            });
          });

          setSavedRecords(grouped);
        }

        // プロフィール（目標体重）を取得
        try {
          const profileRes = await fetch(`/api/profiles?userId=${encodeURIComponent(userId)}`);
          if (profileRes.ok) {
            const profileData = await profileRes.json();
            const twRaw = profileData?.profile?.targetWeight;
            const tw =
              twRaw === null || twRaw === undefined || twRaw === ''
                ? null
                : (typeof twRaw === 'number' ? twRaw : Number(twRaw));
            if (tw !== null && Number.isFinite(tw)) {
              setTargetWeight(tw);
            } else {
              // APIに無い場合はローカルストレージも見る
              setTargetWeight(loadLocalProfileTargetWeight(userId));
            }
          } else {
            setTargetWeight(loadLocalProfileTargetWeight(userId));
          }
        } catch {
          setTargetWeight(loadLocalProfileTargetWeight(userId));
        }
      } catch (error) {
        console.error('Failed to fetch records:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [router]);

  // 1週間分のデータを取得・集計
  useEffect(() => {
    if (Object.keys(savedRecords).length === 0) return;

    // 現在日時から週を計算
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); // 日曜から開始
    startDate.setHours(0, 0, 0, 0);

    const weekStart = new Date(startDate);
    const dates: string[] = [];
    const labels: string[] = [];

    const data: WeekData = {
      labels,
      bloodPressureSystolic: [],
      bloodPressureDiastolic: [],
      bloodPressureNightSystolic: [],
      bloodPressureNightDiastolic: [],
      pulse: [],
      weight: [],
      dates,
    };

    // 平均値計算（表示削除済みのため不要）

    // 7日間のデータを取得
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = formatDateLocal(date); // ローカル日付文字列
      const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;

      dates.push(dateStr);
      labels.push(displayDate);

      const dayRecords = savedRecords[dateStr];
      if (!dayRecords) {
        data.bloodPressureSystolic.push(0);
        data.bloodPressureDiastolic.push(0);
        data.bloodPressureNightSystolic.push(0);
        data.bloodPressureNightDiastolic.push(0);
        data.pulse.push(0);
        data.weight.push(0);
        continue;
      }

      // 朝のデータを取得（morning または 最初のエントリ）
      const morningRecord = dayRecords.morning || dayRecords['08:00'] || Object.values(dayRecords)[0];
      if (morningRecord?.bloodPressure) {
        const systolic = parseInt(morningRecord.bloodPressure.systolic) || 0;
        const diastolic = parseInt(morningRecord.bloodPressure.diastolic) || 0;
        data.bloodPressureSystolic.push(systolic);
        data.bloodPressureDiastolic.push(diastolic);
      } else {
        data.bloodPressureSystolic.push(0);
        data.bloodPressureDiastolic.push(0);
      }

      // 脈拍（最初のエントリから）
      if (morningRecord?.pulse) {
        const pulse = parseInt(morningRecord.pulse) || 0;
        data.pulse.push(pulse);
      } else {
        data.pulse.push(0);
      }

      // 体重（最初のエントリから）
      if (morningRecord?.weight) {
        const weight = parseFloat(morningRecord.weight) || 0;
        data.weight.push(weight);
      } else {
        data.weight.push(0);
      }
    }

    setWeekData(data);
  }, [savedRecords, weekOffset]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-orange-700">データを読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  // グラフデータの生成
  const chartData = weekData ? {
    labels: weekData.labels,
    datasets: activeMetric === 'bloodPressure' ? [
      {
        label: '血圧（朝）(mmHg)',
        data: weekData.bloodPressureSystolic,
        borderColor: 'rgb(236, 72, 153)', // ピンク
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: 'rgb(236, 72, 153)',
        borderWidth: 2,
      },
    ] : activeMetric === 'pulse' ? [
      {
        label: '脈拍 (回/分)',
        data: weekData.pulse,
        borderColor: 'rgb(59, 130, 246)', // 青
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
      },
    ] : [
      {
        label: '体重 (kg)',
        data: weekData.weight,
        borderColor: 'rgb(168, 85, 247)', // 紫
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        borderWidth: 2,
      },
      ...(targetWeight !== null
        ? [{
            label: '目標体重',
            data: weekData.labels.map(() => targetWeight),
            borderColor: 'rgba(99, 102, 241, 0.9)', // indigo
            backgroundColor: 'rgba(99, 102, 241, 0)',
            borderDash: [6, 6],
            tension: 0,
            pointRadius: 0,
            borderWidth: 2,
          }]
        : [])
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        // ユーザー要望：体重も含めて常に 0 始まり
        beginAtZero: true,
        ...(activeMetric === 'weight' && weekData
          ? (() => {
              const vals = weekData.weight.filter((v) => typeof v === 'number' && v > 0);
              const maxV = vals.length ? Math.max(...vals) : null;
              const t = targetWeight;
              const maxAll = [maxV, t].filter((x): x is number => typeof x === 'number');
              if (!maxAll.length) return { suggestedMin: 0 };
              const max = Math.ceil(Math.max(...maxAll) + 2);
              return { suggestedMin: 0, suggestedMax: max };
            })()
          : {}),
      },
    },
  };

  const weekStartDate = weekData?.dates[0];
  const weekEndDate = weekData?.dates[6];
  const weekLabel = weekStartDate && weekEndDate 
    ? `${weekStartDate.split('-')[1]}月${weekStartDate.split('-')[2]}日～${weekEndDate.split('-')[2]}日`
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-4 py-3">
        {/* タイトル */}
        <div className="max-w-6xl mx-auto mb-3">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">グラフ</h1>
        </div>

        {/* PC版ナビゲーション（右側）*/}
        <div className="hidden md:block">
          <div className="max-w-6xl mx-auto flex justify-end">
            <nav className="flex gap-2 pb-3 flex-wrap justify-end">
            <button 
              onClick={() => window.location.href = '/health-records'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <HealthRecordIcon className="w-5 h-5" />
              <span className="text-[10px]">健康記録</span>
            </button>
            <button 
              onClick={() => window.location.href = '/calendar'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-[10px]">カレンダー</span>
            </button>
            <button 
              onClick={() => window.location.href = '/learn'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <LearnIcon className="w-5 h-5" />
              <span className="text-[10px]">学ぶ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/blood-data'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <TestIcon className="w-5 h-5" />
              <span className="text-[10px]">検査</span>
            </button>
            <button 
              onClick={() => window.location.href = '/graph'}
              className="flex flex-col items-center gap-0.5 bg-orange-400 text-white border border-orange-400 py-1 px-2 rounded-lg font-medium text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <GraphIcon className="w-5 h-5" />
              <span className="text-[10px]">グラフ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/family'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <FamilyIcon className="w-5 h-5" />
              <span className="text-[10px]">家族</span>
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px]">メニュー</span>
            </button>
            </nav>
          </div>
        </div>

        {/* スマホ版ナビゲーション（MD未満） */}
        <nav className="md:hidden flex gap-1 pb-3 overflow-x-auto whitespace-nowrap">
          <button 
            onClick={() => window.location.href = '/health-records'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <HealthRecordIcon className="w-5 h-5" />
            <span className="text-[10px]">健康記録</span>
          </button>
          <button 
            onClick={() => window.location.href = '/calendar'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <CalendarIcon className="w-5 h-5" />
            <span className="text-[10px]">カレンダー</span>
          </button>
          <button 
            onClick={() => window.location.href = '/learn'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <LearnIcon className="w-5 h-5" />
            <span className="text-[10px]">学ぶ</span>
          </button>
          <button 
            onClick={() => window.location.href = '/blood-data'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <TestIcon className="w-5 h-5" />
            <span className="text-[10px]">検査</span>
          </button>
          <button 
            onClick={() => window.location.href = '/graph'}
            className="flex flex-col items-center gap-0.5 bg-orange-400 text-white border border-orange-400 py-1 px-2 rounded-lg font-medium text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <GraphIcon className="w-5 h-5" />
            <span className="text-[10px]">グラフ</span>
          </button>
          <button 
            onClick={() => window.location.href = '/family'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <FamilyIcon className="w-5 h-5" />
            <span className="text-[10px]">家族</span>
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px]">メニュー</span>
          </button>
        </nav>
      </header>

      {/* 指標タブ - 大きくした */}
      <div className="bg-white shadow-sm px-4 py-3">
        <div className="max-w-6xl mx-auto flex gap-3 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'bloodPressure', label: '血圧', icon: '🩸' },
            { key: 'pulse', label: '脈拍', icon: '💓' },
            { key: 'weight', label: '体重', icon: '⚖️' },
          ].map((metric) => (
            <button
              key={metric.key}
              onClick={() => setActiveMetric(metric.key as typeof activeMetric)}
              className={`px-6 py-3 rounded-full font-bold text-base whitespace-nowrap transition click-press flex-shrink-0 ${
                activeMetric === metric.key
                  ? 'bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg'
                  : 'bg-gray-300 text-gray-700'
              }`}
            >
              {metric.icon} {metric.label}
            </button>
          ))}
        </div>

        {/* 週選択 */}
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="px-4 py-2 bg-gray-600 text-white rounded font-semibold click-press"
          >
            ⬅ 先週
          </button>
          <div className="text-center text-base font-bold text-gray-800 flex-1">{weekLabel}</div>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold click-press"
          >
            ↻ 最新
          </button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto p-4 pb-28">
        {/* 上部表示 */}
        <div className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-lg p-4 mb-4 shadow-md border-2 border-orange-300">
          {activeMetric === 'bloodPressure' && (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-2">正常範囲：</p>
              <p className="text-lg font-bold text-red-600">120/80 mmHg</p>
            </>
          )}
          {activeMetric === 'pulse' && (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-2">正常範囲：</p>
              <p className="text-lg font-bold text-blue-600">60-100 回/分</p>
            </>
          )}
          {activeMetric === 'weight' && (
            <p className="text-lg font-bold text-purple-600">
              目標体重：{targetWeight !== null ? `${targetWeight} kg` : '未設定'}
            </p>
          )}
        </div>

        {/* グラフ */}
        {chartData && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-md">
            <div className="h-64">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* 健康記録一覧 */}
        <div className="bg-white rounded-lg p-4 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">記録一覧</h3>
          </div>

          {weekData?.dates.map((date, idx) => {
            const dayRecord = savedRecords[date];
            const displayDate = weekData.labels[idx];
            
            if (!dayRecord) return null;

            const record = Object.values(dayRecord)[0];
            if (!record) return null;

            return (
              <div key={date} className="border-t pt-3 pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800">{date}</p>
                    <p className="text-sm text-gray-600">朝</p>
                  </div>
                  {activeMetric === 'bloodPressure' && record.bloodPressure && (
                    <p className="text-xl font-bold text-pink-600">
                      {record.bloodPressure.systolic} / {record.bloodPressure.diastolic} mmHg
                    </p>
                  )}
                  {activeMetric === 'pulse' && (
                    <p className="text-xl font-bold text-blue-600">{record.pulse} 回/分</p>
                  )}
                  {activeMetric === 'weight' && (
                    <p className="text-xl font-bold text-purple-600">{record.weight} kg</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

