"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { getSession, isLineLoggedIn, setLineLogin, setLineLoggedInDB } from "@/lib/auth";
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
  const [activeMetric, setActiveMetric] = useState<'bloodPressure' | 'pulse' | 'weight'>('bloodPressure');
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });
  const [weekOffset, setWeekOffset] = useState(0); // 0 = 現在週、-1 = 先週
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [averages, setAverages] = useState<{ systolic: number; diastolic: number; pulse: number; weight: number } | null>(null);

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
          setSavedRecords(data.records || {});
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

    let totalSystolic = 0, totalDiastolic = 0, totalPulse = 0, totalWeight = 0, count = 0;

    // 7日間のデータを取得
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
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
        totalSystolic += systolic;
        totalDiastolic += diastolic;
        count++;
      } else {
        data.bloodPressureSystolic.push(0);
        data.bloodPressureDiastolic.push(0);
      }

      // 脈拍（最初のエントリから）
      if (morningRecord?.pulse) {
        const pulse = parseInt(morningRecord.pulse) || 0;
        data.pulse.push(pulse);
        totalPulse += pulse;
      } else {
        data.pulse.push(0);
      }

      // 体重（最初のエントリから）
      if (morningRecord?.weight) {
        const weight = parseFloat(morningRecord.weight) || 0;
        data.weight.push(weight);
        totalWeight += weight;
      } else {
        data.weight.push(0);
      }
    }

    setWeekData(data);

    // 7日間平均値を計算
    if (count > 0) {
      setAverages({
        systolic: Math.round(totalSystolic / count),
        diastolic: Math.round(totalDiastolic / count),
        pulse: Math.round(totalPulse / 7),
        weight: Math.round((totalWeight / 7) * 10) / 10,
      });
    }
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
        beginAtZero: true,
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
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-orange-800">グラフ</h1>
          <NavigationBar />
        </div>

        {/* 指標タブ - 大きくした */}
        <div className="flex gap-3 mb-4 overflow-x-auto pb-2">
          {[
            { key: 'bloodPressure', label: '血圧', icon: '🩸' },
            { key: 'pulse', label: '脈拍', icon: '💓' },
            { key: 'weight', label: '体重', icon: '⚖️' },
          ].map((metric) => (
            <button
              key={metric.key}
              onClick={() => setActiveMetric(metric.key as typeof activeMetric)}
              className={`px-6 py-3 rounded-full font-bold text-base whitespace-nowrap transition click-press ${
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
        <div className="flex items-center justify-between gap-2">
          <button className="px-4 py-2 bg-gray-600 text-white rounded font-semibold click-press">⬅ 先月</button>
          <div className="text-center text-base font-bold text-gray-800 flex-1">{weekLabel}</div>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-full font-semibold click-press">↻ 最新</button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        {/* 正常範囲表示 */}
        <div className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-lg p-4 mb-4 shadow-md border-2 border-orange-300">
          <p className="text-sm font-semibold text-gray-700 mb-2">正常範囲：</p>
          {activeMetric === 'bloodPressure' && (
            <p className="text-lg font-bold text-red-600">120/80 mmHg</p>
          )}
          {activeMetric === 'pulse' && (
            <p className="text-lg font-bold text-blue-600">60-100 回/分</p>
          )}
          {activeMetric === 'weight' && (
            <p className="text-lg font-bold text-purple-600">目標体重との比較</p>
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

        {/* 7日間平均値 */}
        {averages && (
          <div className="bg-white rounded-lg p-4 mb-4 shadow-md">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-semibold">7日間平均</p>
              {activeMetric === 'bloodPressure' && (
                <p className="text-3xl font-bold text-pink-600">
                  {averages.systolic} / {averages.diastolic}
                </p>
              )}
              {activeMetric === 'pulse' && (
                <p className="text-3xl font-bold text-blue-600">{averages.pulse}</p>
              )}
              {activeMetric === 'weight' && (
                <p className="text-3xl font-bold text-purple-600">{averages.weight}</p>
              )}
            </div>
          </div>
        )}

        {/* 健康記録一覧 */}
        <div className="bg-white rounded-lg p-4 shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">記録一覧</h3>
            <button className="text-blue-500 font-bold">➕ 追加</button>
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

