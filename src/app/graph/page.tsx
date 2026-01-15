"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession, isLineLoggedIn, getCurrentUserId, setLineLogin, setLineLoggedInDB } from "@/lib/auth";
import NavigationBar from "@/components/NavigationBar";
import { readJsonOrThrow } from "@/lib/readJson";

// （デスクトップナビは NavigationBar に統一）
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
  labels: string[]; // X軸ラベル ('12/20 09:00', '12/20 10:00'...)
  bloodPressureSystolic: Array<number | null>;
  bloodPressureDiastolic: Array<number | null>;
  bloodPressureNightSystolic: Array<number | null>;
  bloodPressureNightDiastolic: Array<number | null>;
  pulse: Array<number | null>;
  weight: Array<number | null>;
  bmi: Array<number | null>;
  points: Array<{ date: string; timeKey: string; displayTime: string; slot: TimeSlot }>;
  weekStart: string; // 'YYYY-MM-DD'
  weekEnd: string;   // 'YYYY-MM-DD'
}

type TimeSlot = 'morning' | 'noon' | 'night';

export default function GraphPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedRecords, setSavedRecords] = useState<{ [key: string]: { [key: string]: HealthRecord } }>({});
  const [user, setUser] = useState<any>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<'bloodPressure' | 'pulse' | 'weight' | 'bmi'>('bloodPressure');
  const [activeSlot, setActiveSlot] = useState<'all' | TimeSlot>('all');
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

  const parseYmd = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map((v) => Number(v));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  // APIからのdate文字列をグラフ用キーに正規化
  const normalizeDateKey = (raw: string | undefined) => {
    if (!raw) return '';
    // ISO形式なら T で分割
    if (raw.includes('T')) return raw.split('T')[0];
    // スラッシュ区切りをハイフンに
    return raw.replace(/\//g, '-');
  };

  // 正常範囲の薄塗り（血圧・脈拍）
  const normalRangePlugin = {
    id: 'normalRange',
    beforeDraw: (chart: any) => {
      if (!chart?.scales?.y || !chart?.chartArea) return;
      if (activeMetric !== 'bloodPressure' && activeMetric !== 'pulse') return;

      const yScale = chart.scales.y;
      const { left, right, top, bottom } = chart.chartArea;
      const ctx = chart.ctx;

      // 体重は対象外（要望が来たら追加）
      const ranges =
        activeMetric === 'bloodPressure'
          ? [{ min: 70, max: 140, color: 'rgba(239, 68, 68, 0.10)' }] // 70〜140 を薄赤
          : [{ min: 60, max: 100, color: 'rgba(59, 130, 246, 0.10)' }]; // 60〜100 を薄青

      ctx.save();
      for (const r of ranges) {
        const yTop = yScale.getPixelForValue(r.max);
        const yBottom = yScale.getPixelForValue(r.min);
        const yy = Math.min(yTop, yBottom);
        const hh = Math.abs(yBottom - yTop);
        ctx.fillStyle = r.color;
        ctx.fillRect(left, yy, right - left, hh);
      }
      ctx.restore();
    },
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

  const loadLocalProfileHeightCm = (overrideUserId?: string): number | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(localStorageKey('profile', overrideUserId));
      if (!raw) return null;
      const p = JSON.parse(raw);
      const h = p?.height;
      if (h === null || h === undefined || h === '') return null;
      const n = typeof h === 'number' ? h : Number(h);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  };

  const calcBmi = (weightKg: number | null, heightCmValue: number | null): number | null => {
    if (!weightKg || !heightCmValue) return null;
    const hm = heightCmValue / 100;
    if (!Number.isFinite(hm) || hm <= 0) return null;
    const bmi = weightKg / (hm * hm);
    return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
  };

  const slotOfTime = (timeKey: string): TimeSlot => {
    // timeKey 例: "08:00", "18:30", "morning" など
    let hh = 8;
    if (timeKey === 'morning') hh = 8;
    else if (timeKey === 'afternoon') hh = 13;
    else if (timeKey === 'evening' || timeKey === 'night') hh = 20;
    else {
      const m = timeKey.match(/^(\d{1,2})/);
      if (m) {
        hh = Number(m[1]);
      }
    }
    if (hh >= 4 && hh < 12) return 'morning';
    if (hh >= 12 && hh < 18) return 'noon';
    return 'night';
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
        const userId = getCurrentUserId();
        if (!userId) return;

        const res = await fetch(`/api/health-records?userId=${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data = await readJsonOrThrow(res);
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
          const localSaved = loadLocalRecords(userId);
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
            const profileData = await readJsonOrThrow(profileRes);
            const twRaw = profileData?.profile?.targetWeight;
            const hRaw = profileData?.profile?.height;
            const h =
              hRaw === null || hRaw === undefined || hRaw === ''
                ? null
                : (typeof hRaw === 'number' ? hRaw : Number(hRaw));
            setHeightCm(h !== null && Number.isFinite(h) && h > 0 ? h : loadLocalProfileHeightCm(userId));
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
            setHeightCm(loadLocalProfileHeightCm(userId));
          }
        } catch {
          setTargetWeight(loadLocalProfileTargetWeight(userId));
          setHeightCm(loadLocalProfileHeightCm(userId));
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
    // 現在日時から週を計算
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); // 日曜から開始
    startDate.setHours(0, 0, 0, 0);

    const weekStart = new Date(startDate);
    const labels: string[] = [];
    const points: Array<{ date: string; timeKey: string; displayTime: string; slot: TimeSlot }> = [];

    const data: WeekData = {
      labels,
      bloodPressureSystolic: [],
      bloodPressureDiastolic: [],
      bloodPressureNightSystolic: [],
      bloodPressureNightDiastolic: [],
      pulse: [],
      weight: [],
      bmi: [],
      points,
      weekStart: formatDateLocal(weekStart),
      weekEnd: formatDateLocal(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)),
    };

    // 週内の全記録（同日複数回も含む）を時刻順で点にする
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = formatDateLocal(date); // ローカル日付文字列
      const displayDate = `${date.getMonth() + 1}/${date.getDate()}`;

      const dayRecords = savedRecords[dateStr];
      if (!dayRecords) continue;

      const timeKeys = Object.keys(dayRecords)
        .filter((k) => !!(dayRecords as any)[k])
        .sort((a, b) => String(a).localeCompare(String(b)));

      for (const timeKey of timeKeys) {
        const record: any = (dayRecords as any)[timeKey];
        if (!record) continue;

        const displayTime = timeKey === 'morning' ? '08:00' : timeKey;
        const slot = slotOfTime(displayTime);
        labels.push(`${displayDate} ${displayTime}`);
        points.push({ date: dateStr, timeKey, displayTime, slot });

        const sys = record?.bloodPressure?.systolic ? parseInt(record.bloodPressure.systolic) : null;
        const dia = record?.bloodPressure?.diastolic ? parseInt(record.bloodPressure.diastolic) : null;
        data.bloodPressureSystolic.push(Number.isFinite(sys) ? sys : null);
        data.bloodPressureDiastolic.push(Number.isFinite(dia) ? dia : null);

        const pRaw = record?.pulse;
        const p = pRaw === null || pRaw === undefined || pRaw === '' ? null : Number.parseInt(String(pRaw), 10);
        data.pulse.push(p !== null && Number.isFinite(p) && p >= 0 && p <= 300 ? p : null);

        const wRaw = record?.weight;
        const w = wRaw === null || wRaw === undefined || wRaw === '' ? null : Number.parseFloat(String(wRaw));
        // 体重は現実的な範囲のみ採用（異常値は軸が壊れるので無視）
        data.weight.push(w !== null && Number.isFinite(w) && w >= 0 && w <= 300 ? w : null);

        // BMI（身長cmがある場合のみ）
        const safeW = w !== null && Number.isFinite(w) && w >= 0 && w <= 300 ? w : null;
        data.bmi.push(calcBmi(safeW, heightCm));

        // 夜データは現状未実装のため null で埋める（将来拡張用）
        data.bloodPressureNightSystolic.push(null);
        data.bloodPressureNightDiastolic.push(null);
      }
    }

    setWeekData(data);
  }, [savedRecords, weekOffset, heightCm]);

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
  const hasPoints = !!weekData && (weekData.labels?.length ?? 0) > 0;

  const emptyWeekLabels = (() => {
    if (!weekData?.weekStart) return [];
    const start = parseYmd(weekData.weekStart);
    if (!start) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
  })();

  const slotColors: Record<TimeSlot, string> = {
    morning: '#22c55e', // green（朝）
    noon: '#3b82f6',    // blue（昼）
    night: '#a855f7',   // purple（夜）
  };
  const colorForSlotArray = weekData?.points.map((p) => slotColors[p.slot]) || [];
  const filterBySlot = (arr: Array<number | null>) =>
    weekData
      ? arr.map((v, idx) => (activeSlot === 'all' || weekData.points[idx].slot === activeSlot ? v : null))
      : arr;

  const lineChartData = hasPoints && weekData ? {
    labels: weekData.labels,
    datasets: activeMetric === 'bloodPressure'
      ? [
          {
            label: '収縮期 (mmHg)',
            data: filterBySlot(weekData.bloodPressureSystolic),
            borderColor: 'rgb(239, 68, 68)', // red
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: colorForSlotArray,
            pointBorderColor: colorForSlotArray,
            borderWidth: 2,
            spanGaps: true,
          },
          {
            label: '拡張期 (mmHg)',
            data: filterBySlot(weekData.bloodPressureDiastolic),
            borderColor: 'rgb(236, 72, 153)', // pink
            backgroundColor: 'rgba(236, 72, 153, 0.08)',
            tension: 0.25,
            pointRadius: 4,
            pointBackgroundColor: colorForSlotArray,
            pointBorderColor: colorForSlotArray,
            borderWidth: 2,
            spanGaps: true,
          },
        ]
      : activeMetric === 'pulse'
      ? [
          {
            label: '脈拍 (回/分)',
            data: filterBySlot(weekData.pulse),
            borderColor: 'rgb(59, 130, 246)', // 青
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: colorForSlotArray,
            pointBorderColor: colorForSlotArray,
            borderWidth: 2,
            spanGaps: true,
          },
        ]
      : activeMetric === 'bmi'
      ? [
          {
            label: 'BMI',
            data: filterBySlot(weekData.bmi),
            borderColor: 'rgb(20, 184, 166)', // teal
            backgroundColor: 'rgba(20, 184, 166, 0.10)',
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: colorForSlotArray,
            pointBorderColor: colorForSlotArray,
        borderWidth: 2,
            spanGaps: true,
          },
        ]
      : [
          {
            label: '体重 (kg)',
            data: filterBySlot(weekData.weight),
            borderColor: 'rgb(168, 85, 247)', // 紫
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: colorForSlotArray,
            pointBorderColor: colorForSlotArray,
        borderWidth: 2,
            spanGaps: true,
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

  const emptyLineData = !hasPoints && weekData ? {
    labels: emptyWeekLabels,
    datasets:
      activeMetric === 'bloodPressure'
        ? [
            {
              label: '収縮期 (mmHg)',
              data: emptyWeekLabels.map(() => 0),
              borderColor: 'rgb(239, 68, 68)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              tension: 0.25,
              pointRadius: 4,
              pointBackgroundColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
            },
            {
              label: '拡張期 (mmHg)',
              data: emptyWeekLabels.map(() => 0),
              borderColor: 'rgb(236, 72, 153)',
              backgroundColor: 'rgba(236, 72, 153, 0.08)',
              tension: 0.25,
              pointRadius: 4,
              pointBackgroundColor: 'rgb(236, 72, 153)',
        borderWidth: 2,
            },
          ]
        : activeMetric === 'pulse'
        ? [
            {
              label: '脈拍 (回/分)',
              data: emptyWeekLabels.map(() => 0),
              borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
            },
          ]
        : activeMetric === 'bmi'
        ? [
            {
              label: 'BMI',
              data: emptyWeekLabels.map(() => 0),
              borderColor: 'rgb(20, 184, 166)',
              backgroundColor: 'rgba(20, 184, 166, 0.10)',
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: 'rgb(20, 184, 166)',
        borderWidth: 2,
            },
          ]
        : [
            {
              label: '体重 (kg)',
              data: emptyWeekLabels.map(() => 0),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
              tension: 0.3,
              pointRadius: 5,
              pointBackgroundColor: 'rgb(168, 85, 247)',
        borderWidth: 2,
            },
            ...(targetWeight !== null
              ? [
                  {
        label: '目標体重',
                    data: emptyWeekLabels.map(() => targetWeight),
                    borderColor: 'rgba(99, 102, 241, 0.9)',
                    backgroundColor: 'rgba(99, 102, 241, 0)',
                    borderDash: [6, 6],
                    tension: 0,
        pointRadius: 0,
        borderWidth: 2,
                  },
                ]
              : []),
          ],
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (items: any[]) => {
            if (!items?.length) return '';
            return items[0].label || '';
          },
          label: (ctx: any) => {
            if (!weekData) return '';
            const idx = ctx.dataIndex;
            if (activeMetric === 'bloodPressure') {
              // 棒グラフなので dataset ごとに表示
              const v = ctx?.parsed?.y;
              const name = ctx?.dataset?.label || '血圧';
              return `${name}: ${Number.isFinite(v) ? v : '-'} mmHg`;
            }
            if (activeMetric === 'pulse') {
              const p = weekData.pulse[idx];
              return `脈拍: ${p ?? '-'} 回/分`;
            }
            if (activeMetric === 'bmi') {
              const b = weekData.bmi[idx];
              return `BMI: ${b ?? '-'} `;
            }
            const w = weekData.weight[idx];
            return `体重: ${w ?? '-'} kg`;
          },
        },
      },
    },
    scales: {
      y: {
        // ユーザー要望：体重も含めて常に 0 始まり
        beginAtZero: true,
        ...(activeMetric === 'bloodPressure'
          ? {
              min: 0,
              max: 200,
              ticks: { stepSize: 20 },
            }
          : {}),
        ...(activeMetric === 'pulse'
          ? {
              min: 0,
              max: 150,
              ticks: { stepSize: 10 },
            }
          : {}),
        ...(activeMetric === 'weight'
          ? {
              min: 0,
              max: 150,
              ticks: { stepSize: 10 },
            }
          : {}),
        ...(activeMetric === 'bmi'
          ? {
              min: 0,
              max: 50,
              ticks: { stepSize: 5 },
            }
          : {}),
      },
      x: {
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
      },
    },
  };

  const weekStartDate = weekData?.weekStart;
  const weekEndDate = weekData?.weekEnd;
  const weekLabel = weekStartDate && weekEndDate 
    ? `${weekStartDate.split('-')[1]}月${weekStartDate.split('-')[2]}日～${weekEndDate.split('-')[2]}日`
    : '';

  const latestBmi = (() => {
    if (!weekData?.bmi?.length) return null;
    // 表示中の時間帯フィルタに合わせて、直近のBMIを拾う
    for (let i = weekData.bmi.length - 1; i >= 0; i--) {
      if (activeSlot !== 'all' && weekData.points?.[i]?.slot !== activeSlot) continue;
      const v = weekData.bmi[i];
      if (v !== null && v !== undefined && Number.isFinite(v)) return v;
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1">
        {/* PC版：横並び（タイトル左・ナビ右） */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold text-orange-800">
              グラフ
          </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び（画像仕様） */}
        <div className="md:hidden">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">グラフ</h1>
          </div>
          <div className="flex justify-center">
            <NavigationBar />
          </div>
        </div>

        {/* スマホ版ナビは PageHeader 風に統一したため削除 */}
      </header>

      {/* 指標タブ - 大きくした */}
      <div className="bg-white shadow-sm px-4 py-3">
        <div className="max-w-6xl mx-auto grid grid-cols-4 gap-2 mb-4 md:flex md:gap-3 md:overflow-x-auto md:pb-2">
          {[
            { key: 'bloodPressure', label: '血圧', icon: '🩸' },
            { key: 'pulse', label: '脈拍', icon: '💓' },
            { key: 'weight', label: '体重', icon: '⚖️' },
            { key: 'bmi', label: 'BMI', icon: '📏' },
          ].map((metric) => (
            <button
              key={metric.key}
              onClick={() => setActiveMetric(metric.key as typeof activeMetric)}
              className={`w-full md:w-auto px-3 md:px-6 py-3 rounded-full font-bold text-sm md:text-base whitespace-nowrap transition click-press ${
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
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="px-4 py-2 bg-gray-600 text-white rounded font-semibold click-press"
            >
              ⬅ 先週
            </button>

            {/* デスクトップは中央に週ラベル */}
            <div className="hidden md:block text-center text-base font-bold text-gray-800 flex-1">{weekLabel}</div>

            <div className="flex items-center gap-2">
              {weekOffset < 0 && (
                <button
                  onClick={() => setWeekOffset((prev) => Math.min(prev + 1, 0))}
                  className="px-4 py-2 bg-gray-600 text-white rounded font-semibold click-press"
                >
                  次週 ➡
                </button>
              )}
              <button
                onClick={() => setWeekOffset(0)}
                className="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold click-press"
              >
                ↻ 最新
              </button>
              </div>
            </div>

          {/* スマホはボタンの下に週ラベル */}
          <div className="md:hidden mt-2 text-center text-lg font-bold text-gray-800">
            {weekLabel}
              </div>
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
          {activeMetric === 'bmi' && (
            <div className="text-lg font-bold text-teal-600">
              <p>BMI：{latestBmi ?? '-'}</p>
              <p className="text-sm font-semibold text-gray-600 mt-1">
                身長：{heightCm ? `${heightCm} cm` : '未設定'}
              </p>
            </div>
          )}
        </div>

        {/* グラフ */}
        {(lineChartData || emptyLineData) && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-md">
            <div className="h-64">
              <Line
                key={`chart-${activeMetric}`}
                data={(lineChartData || emptyLineData) as any}
                options={chartOptions as any}
                plugins={[normalRangePlugin as any]}
                />
              </div>
            </div>
        )}

        {/* すべて・朝・昼・夜（グラフと記録一覧の間） */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-4 mb-4 shadow-sm"
          style={{ marginLeft: '0.5cm', marginRight: '0.5cm' }}
        >
          <div className="text-lg md:text-xl font-extrabold text-gray-800 mb-3">表示</div>
          <div className="grid grid-cols-4 gap-2 md:flex md:flex-nowrap md:gap-3 md:overflow-x-auto md:whitespace-nowrap">
            {[
              { key: 'all', label: 'すべて', cls: 'bg-gray-700 border-gray-700 text-white hover:bg-gray-800' },
              { key: 'morning', label: '朝', cls: 'bg-green-500 border-green-500 text-white hover:bg-green-600' },
              { key: 'noon', label: '昼', cls: 'bg-blue-500 border-blue-500 text-white hover:bg-blue-600' },
              { key: 'night', label: '夜', cls: 'bg-purple-500 border-purple-500 text-white hover:bg-purple-600' },
            ].map((s) => (
                <button
                key={s.key}
                onClick={() => setActiveSlot(s.key as any)}
                className={`w-full px-2 md:px-5 py-2 rounded-full text-sm md:text-lg font-extrabold border transition ${
                  activeSlot === s.key ? s.cls : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.label}
                </button>
            ))}
            </div>
          </div>
          
        {/* 健康記録一覧 */}
        <div className="bg-white rounded-lg p-4 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">記録一覧</h3>
                    </div>

          {(() => {
            const points = (weekData?.points ?? []).filter((p) => activeSlot === 'all' || p.slot === activeSlot);
            if (points.length === 0) {
              return <p className="text-sm text-gray-500">該当する記録がありません。</p>;
            }
            return points.map((p, idx) => {
            const dayRecord = savedRecords[p.date];
            
            if (!dayRecord) return null;

            const record = (dayRecord as any)[p.timeKey] || Object.values(dayRecord)[0];
            if (!record) return null;

            const slotLabel = p.slot === 'morning' ? '朝' : p.slot === 'noon' ? '昼' : '夜';
            const slotBadgeClass =
              p.slot === 'morning'
                ? 'bg-green-100 text-green-800 border-green-200'
                : p.slot === 'noon'
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-purple-100 text-purple-800 border-purple-200';

            return (
              <div key={`${p.date}_${p.timeKey}_${idx}`} className="border-t pt-3 pb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-800">{p.date}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${slotBadgeClass}`}>
                        {slotLabel}
                      </span>
                      <p className="text-sm text-gray-600">{p.displayTime}</p>
                  </div>
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
                  {activeMetric === 'bmi' && (
                    <p className="text-xl font-bold text-teal-600">
                      BMI: {calcBmi(
                        record?.weight === null || record?.weight === undefined || record?.weight === ''
                          ? null
                          : Number.parseFloat(String(record.weight)),
                        heightCm
                      ) ?? '-'}
                    </p>
                  )}
              </div>
            </div>
            );
          });
          })()}
              </div>
      </main>
    </div>
  );
}

