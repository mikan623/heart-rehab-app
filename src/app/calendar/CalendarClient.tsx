"use client";
import { useState, useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api";


// 健康記録の型定義
interface HealthRecord {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  exercise: { type: string; duration: string };
  weight: string;
  meal: {
    staple: string[];      // 配列に変更
    mainDish: string[];    // 配列に変更
    sideDish: string[];    // 配列に変更
    other: string;
  };
  dailyLife?: string;
  medicationTaken?: boolean;
}

type SavedRecords = Record<string, Record<string, HealthRecord>>;

type ApiHealthRecord = {
  date: string;
  time: string;
  bloodPressure: { systolic: number | string; diastolic: number | string };
  pulse?: number | null;
  weight?: number | null;
  exercise?: { type?: string; duration?: string } | null;
  meal?: { staple?: string[]; mainDish?: string[]; sideDish?: string[]; other?: string } | null;
  dailyLife?: string | null;
  medicationTaken?: boolean | null;
};

type HealthRecordsResponse = { records: ApiHealthRecord[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.error === 'string' ? value.error : undefined;

const getProfileHeight = (value: unknown): unknown =>
  isRecord(value) && isRecord(value.profile) ? value.profile.height : undefined;

const getApiRecords = (value: unknown): ApiHealthRecord[] =>
  isRecord(value) && Array.isArray(value.records) ? value.records : [];

type Props = {
  userId: string;
  initialSavedRecords: SavedRecords;
  initialHeightCm: number | null;
};

export default function CalendarPage({ userId, initialSavedRecords, initialHeightCm }: Props) {
  const [heightCm, setHeightCm] = useState<number | null>(initialHeightCm);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(''); // 選択された時間
  const [desktopDateTime, setDesktopDateTime] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  });
  const [healthRecord, setHealthRecord] = useState({
    bloodPressure: { systolic: '', diastolic: '' },
    pulse: '',
    exercise: { type: '', duration: '' },
    weight: '',  
    meal: {
      staple: [],        // 空配列に変更
      mainDish: [],      // 空配列に変更
      sideDish: [],      // 空配列に変更
      other: ''
    }
  });

  // 入力フィールドの再レンダリングを防ぐためのキー
  const [inputKey, setInputKey] = useState(0);
  
  // 時間を日本語表記に変換する関数
  const getTimeLabel = (time: string) => {
    if (time >= '06:00' && time < '12:00') return '朝';
    if (time >= '12:00' && time < '18:00') return '昼';
    return '夜';
  };

  // 詳細モーダル用の色設定関数
  const getTimeColorModal = (time: string) => {
    if (time >= '06:00' && time < '12:00') return 'bg-green-50 text-green-800';
    if (time >= '12:00' && time < '18:00') return 'bg-blue-50 text-blue-800';
    return 'bg-purple-50 text-purple-800';
  };

  // 配列の文字列変換ヘルパー関数
  const convertStringToArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value ? value.split(', ').filter(Boolean) : [];
    return [];
  };

  const formatMealText = (meal: HealthRecord['meal'] | null | undefined) => {
    if (!meal) return '';
    const staple = convertStringToArray(meal.staple).filter(Boolean).join('、');
    const mainDish = convertStringToArray(meal.mainDish).filter(Boolean).join('、');
    const sideDish = convertStringToArray(meal.sideDish).filter(Boolean).join('、');
    const other = typeof meal.other === 'string' ? meal.other.trim() : '';

    const parts: string[] = [];
    if (staple) parts.push(`主食: ${staple}`);
    if (mainDish) parts.push(`主菜: ${mainDish}`);
    if (sideDish) parts.push(`副菜: ${sideDish}`);
    if (other) parts.push(`その他: ${other}`);
    return parts.join(' / ');
  };

  // 食事選択のハンドラー関数
  const handleMealChange = (category: 'staple' | 'mainDish' | 'sideDish', item: string, checked: boolean, record: HealthRecord) => {
    const currentMeal: HealthRecord['meal'] = record.meal || { staple: [], mainDish: [], sideDish: [], other: '' };
    
    return {
      ...record,
      meal: {
        ...currentMeal,
        [category]: checked 
          ? [...(currentMeal[category] || []), item]
          : (currentMeal[category] || []).filter((i: string) => i !== item)
      }
    };
  };

  const blockInvalidKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };
  
  const nonNegative = (v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return '';
    return n < 0 ? '0' : String(n);
  };

  const formatDateTimeLocal = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  const applyDesktopDateTime = (value: string) => {
    if (!value) return;
    // datetime-local: YYYY-MM-DDTHH:mm
    const [datePart, timePart] = value.split('T');
    if (!datePart) return;
    const [yy, mo, dd] = datePart.split('-').map(Number);
    const [hh, mi] = (timePart || '00:00').split(':').map(Number);
    const newDate = new Date(yy, (mo || 1) - 1, dd || 1, hh || 0, mi || 0);
    if (Number.isNaN(newDate.getTime())) return;
    setCurrentMonth(newDate);
    setDesktopDateTime(value);
  };

  // localStorageキーをユーザーIDで個別化
  const getStorageKey = (baseKey: string) => {
    if (userId) {
      return `${baseKey}_${userId}`;
    }
    // ローカル開発時はユーザーIDなしでも動くようフォールバック
    return `${baseKey}_local`;
  };

  const loadLocalProfileHeightCm = (overrideUserId?: string): number | null => {
    if (typeof window === 'undefined') return null;
    try {
      const key = overrideUserId ? `profile_${overrideUserId}` : getStorageKey('profile');
      const raw = localStorage.getItem(key);
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

  const [editingRecord, setEditingRecord] = useState<{
    date: string;
    time: string;
    record: HealthRecord;
  } | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [recentStamp, setRecentStamp] = useState<{ date: string; time: string } | null>(null);

  // 記録データを保存する状態を追加
  const [savedRecords, setSavedRecords] = useState<SavedRecords>(initialSavedRecords);
  const [isLoading, setIsLoading] = useState(false);

  // 保存状態を管理
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // 詳細表示用の状態を追加
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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

  // 🆕 追加：LINEミニアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });


  // fetchHealthRecords関数を追加
  const fetchHealthRecords = async (userId: string) => {
    try {
      setIsLoading(true);
      console.log('Fetching health records...');
      
      // 相対パスでAPIを呼び出し
      const { ok, status, data } = await fetchJsonWithRetry(`/api/health-records?userId=${encodeURIComponent(userId)}`);
      console.log('Response status:', status);
      console.log('Response ok:', ok);
      
      if (ok) {
        console.log('Fetched data:', data);
        
        // データベースの形式をカレンダー表示用に変換
        const formattedRecords: SavedRecords = {};
        const records = getApiRecords(data);
        
        records.forEach((record: ApiHealthRecord) => {
          const dateKey = record.date.split('T')[0]; // YYYY-MM-DD形式
          const timeKey = record.time;
          
          if (!formattedRecords[dateKey]) {
            formattedRecords[dateKey] = {};
          }
          
          const systolic = record.bloodPressure?.systolic;
          const diastolic = record.bloodPressure?.diastolic;
          formattedRecords[dateKey][timeKey] = {
            bloodPressure: {
              systolic: systolic === null || systolic === undefined ? '' : String(systolic),
              diastolic: diastolic === null || diastolic === undefined ? '' : String(diastolic)
            },
            pulse: record.pulse === null || record.pulse === undefined ? '' : String(record.pulse),
            weight: record.weight === null || record.weight === undefined ? '' : String(record.weight),
            exercise: record.exercise || { type: '', duration: '' },
            meal: record.meal || { staple: [], mainDish: [], sideDish: [], other: '' },
            dailyLife: record.dailyLife || '',
            medicationTaken: record.medicationTaken || false
          };
        });
        
        console.log('Formatted records:', formattedRecords);
        setSavedRecords(formattedRecords);
      } else {
        console.error('Failed to fetch health records:', status, getErrorMessage(data));
      }
    } catch (error) {
      console.error('Error fetching health records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 直近の記録ハイライト（健康記録ページから遷移してきた場合など）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lastSavedRecord');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            isRecord(parsed) &&
            typeof parsed.date === 'string' &&
            typeof parsed.time === 'string' &&
            typeof parsed.savedAt === 'number'
          ) {
            const elapsed = Date.now() - parsed.savedAt;
            if (elapsed <= 5 * 60 * 1000) {
              setRecentStamp({ date: parsed.date, time: parsed.time });
            } else {
              setRecentStamp(null);
            }
          }
        }
      } catch (e) {
        console.log('⚠️ lastSavedRecord 読み込みエラー（無視）:', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // カレンダー生成
  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // 月の最初の日と最後の日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // カレンダーに表示する日付の配列
    const days = [];
    
    // 前月の日付を追加するための開始日
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // 42日分（6週間）の日付を生成
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      days.push({
        date: currentDate.getDate(),
        isCurrentMonth: currentDate.getMonth() === month,
        isSunday: currentDate.getDay() === 0,
        isSaturday: currentDate.getDay() === 6,
        fullDate: currentDate
      });
    }
    
    return days;
  };

  // 月移動
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  // 時間フォーマット
  const formatTime24h = (t: string) => {
    if (t === 'morning') return '08:00';
    if (t === 'afternoon') return '14:00';
    if (t === 'evening') return '20:00';
    return t;
  };

  // 朝・昼・夜のスロット判定
  const getTimeSlot = (time: string): 'morning' | 'noon' | 'night' => {
    const t = formatTime24h(time);
    if (t >= '04:00' && t < '12:00') return 'morning';
    if (t >= '12:00' && t < '18:00') return 'noon';
    return 'night';
  };

  // 編集開始
  const startEditing = (date: string, time: string, record: HealthRecord) => {
    setEditingRecord({ date, time, record: { ...record } });
    setEditFieldErrors({});
    setShowDetail(false); // 詳細モーダルを閉じる
  };

  // 編集キャンセル
  const cancelEditing = () => {
    setEditingRecord(null);
    setEditFieldErrors({});
  };

  const validateEditingRecord = (rec: HealthRecord) => {
    const errs: Record<string, string> = {};
    const add = (k: string, msg: string) => {
      if (!errs[k]) errs[k] = msg;
    };
    const sys = String(rec?.bloodPressure?.systolic ?? '').trim();
    const dia = String(rec?.bloodPressure?.diastolic ?? '').trim();
    const pulse = String(rec?.pulse ?? '').trim();
    const weight = String(rec?.weight ?? '').trim();
    const dur = String(rec?.exercise?.duration ?? '').trim();
    const mealOther = String(rec?.meal?.other ?? '').trim();
    const dailyLife = String(rec?.dailyLife ?? '').trim();

    if (!sys) add('bloodPressure.systolic', '収縮期血圧（上）は必須です');
    if (!dia) add('bloodPressure.diastolic', '拡張期血圧（下）は必須です');
    if (!pulse) add('pulse', '脈拍は必須です');

    const sysN = sys ? Number(sys) : NaN;
    const diaN = dia ? Number(dia) : NaN;
    const pulseN = pulse ? Number(pulse) : NaN;
    if (sys && (!Number.isFinite(sysN) || sysN <= 0 || sysN >= 300)) {
      add('bloodPressure.systolic', '収縮期血圧（上）は 1〜299 mmHg の範囲で入力してください');
    }
    if (dia && (!Number.isFinite(diaN) || diaN <= 0 || diaN >= 300)) {
      add('bloodPressure.diastolic', '拡張期血圧（下）は 1〜299 mmHg の範囲で入力してください');
    }
    if (pulse && (!Number.isFinite(pulseN) || pulseN <= 0 || pulseN >= 300)) {
      add('pulse', '脈拍は 1〜299 回/分 の範囲で入力してください');
    }

    if (weight) {
      const w = Number(weight);
      if (!Number.isFinite(w) || w <= 0 || w > 200) add('weight', '体重は 0より大きい〜200 kg の範囲で入力してください');
    }
    if (dur) {
      const d = Number(dur);
      if (!Number.isFinite(d) || d <= 0 || d > 1440) add('exercise.duration', '運動時間は 1〜1440 分の範囲で入力してください');
    }
    if (mealOther && mealOther.length > 200) add('meal.other', '食事内容（その他）は 200 文字以内で入力してください');
    if (dailyLife && dailyLife.length > 400) add('dailyLife', '自覚症状やその他は 400 文字以内で入力してください');
    return errs;
  };

  const clearEditFieldError = (key: string) => {
    setEditFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // 編集保存
  const saveEdit = async () => {
    if (!editingRecord) return;
    
    const errs = validateEditingRecord(editingRecord.record);
    if (Object.keys(errs).length > 0) {
      setEditFieldErrors(errs);
      alert('入力内容にエラーがあります。赤字の項目を確認してください。');
      return;
    }
    
    try {
      // 保存開始
      setSaveStatus('saving');
      
      const { date, time } = editingRecord;
      
      // ローカルステートを更新（UIの即座な反映のため）
      setSavedRecords(prev => {
        const newRecords = {
          ...prev,
          [date]: {
            ...prev[date],
            [time]: editingRecord.record
          }
        };
        return newRecords;
      });
      
      // 🆕 データベースにも保存
      // user stateはLIFF初期化後にセットされる。
      // ローカル環境ではLIFFがスキップされるためuserはnullのまま。
      // そのため、user stateがあればそれを使用し、なければデフォルトの'user-1'を使用する。
      const currentUserId = userId;
      
      console.log('💾 カレンダー: 編集した記録をデータベースに保存中...', { userId: currentUserId, date, time });
      
      // データベースに保存
      const response = await apiFetch('/api/health-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          healthRecord: {
            date: date,
            time: time,
            bloodPressure: editingRecord.record.bloodPressure,
            pulse: editingRecord.record.pulse,
            weight: editingRecord.record.weight,
            exercise: editingRecord.record.exercise,
            meal: {
              staple: convertStringToArray(editingRecord.record.meal?.staple).join(', '),
              mainDish: convertStringToArray(editingRecord.record.meal?.mainDish).join(', '),
              sideDish: convertStringToArray(editingRecord.record.meal?.sideDish).join(', '),
              other: editingRecord.record.meal?.other || ''
            },
            dailyLife: editingRecord.record.dailyLife || '',
            medicationTaken: editingRecord.record.medicationTaken || false
          }
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ カレンダー: データベース保存成功:', result);
        
        // データベースから最新のデータを再取得してUIを更新
        await fetchHealthRecords(currentUserId);
        alert('記録を更新しました！');
        
        // 保存完了状態に更新
        setSaveStatus('saved');
        
        // 3秒後にアイドル状態に戻す
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      } else {
        const errorData = await response.json();
        console.error('❌ カレンダー: データベース保存失敗:', errorData);
        const details =
          isRecord(errorData) && typeof errorData.details === 'string'
            ? errorData.details
            : isRecord(errorData) && typeof errorData.error === 'string'
            ? errorData.error
            : undefined;
        alert(`保存に失敗しました: ${details || '不明なエラー'}`);
        setSaveStatus('idle');
      }

      setEditingRecord(null);
      setEditFieldErrors({});
      
    } catch (error) {
      console.error('❌ カレンダー: 編集保存エラー:', error);
      alert('保存に失敗しました。');
      setSaveStatus('idle');
    }
  };

  // 記録削除（日付＋時間で1件削除）
  const deleteRecordByDateTime = async (date: string, time: string) => {
    const ok = window.confirm(`${date} ${formatTime24h(time)} の記録を削除しますか？`);
    if (!ok) return;
    
    try {
      const currentUserId = userId;
      
      // UIを即時反映
      setSavedRecords((prev) => {
        const day = { ...(prev[date] || {}) };
        delete day[time];
        const next = { ...prev };
        if (Object.keys(day).length === 0) {
          delete next[date];
        } else {
          next[date] = day;
        }
        return next;
      });

      // DBから削除
      const res = await fetch(
        `/api/health-records?userId=${encodeURIComponent(currentUserId)}&date=${encodeURIComponent(
          date
        )}&time=${encodeURIComponent(time)}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        await fetchHealthRecords(currentUserId);
        alert('記録を削除しました');
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '削除に失敗しました');
      }
      
      setEditingRecord(null);
      setShowDetail(false);
    } catch (e) {
      console.error('❌ カレンダー: 削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  const handleDateClick = (date: Date) => {
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dayRecords = savedRecords[dateKey];
    
    if (dayRecords) {
      setSelectedDate(dateKey);
      setShowDetail(true);
    } else {
      console.log('この日付には記録がありません:', dateKey);
    }
  };

  const stampStyles = `
  @keyframes stamp-pop {
    0% { transform: scale(0.3) rotate(-15deg); opacity: 0; }
    60% { transform: scale(1.1) rotate(3deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  .stamp-animate {
    animation: stamp-pop 0.35s ease-out;
    transform-origin: center;
  }
  @keyframes stamp-pop-big {
    0% { transform: scale(0.1) rotate(-20deg); opacity: 0; }
    60% { transform: scale(1.25) rotate(5deg); opacity: 1; }
    100% { transform: scale(1.05) rotate(0deg); opacity: 1; }
  }
  .stamp-animate-big {
    animation: stamp-pop-big 0.5s ease-out;
    transform-origin: center;
  }
  `;

  return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
        {/* LINEアプリ用スタイル & スタンプアニメーション */}
        {typeof window !== 'undefined' && (
          <style
            dangerouslySetInnerHTML={{
            __html: `
                ${isLineApp ? `
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
                ` : ''}
                ${stampStyles}
              `,
            }}
          />
        )}
        <PageHeader
          title="カレンダー"
          isLineApp={isLineApp}
          lineSafeAreaTop={isLineApp ? lineSafeArea.top : undefined}
        />

      {/* メインコンテンツ */}
      <main 
        className={`px-0 md:p-4 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '0px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '0px',
          paddingLeft: 0,
          paddingRight: 0,
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        <div className="bg-orange-50 rounded-none md:rounded-lg shadow-none md:shadow-sm px-0 py-4 md:p-6 mb-0 md:mb-4 w-full border-b-4 md:border-2 border-orange-300">
          {/* 月移動ボタン */}
          <div className="flex justify-between items-center mb-6 px-4 md:px-0">
            <button
              onClick={goToPreviousMonth}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-3 md:px-6 rounded-lg font-bold text-base md:text-lg hover:from-orange-600 hover:to-orange-700"
            >
              ←前月
            </button>
            <div className="flex-1 flex items-center">
              {/* 年月は中央寄せ */}
              <div className="flex-1 flex justify-center">
            <h2 className="text-xl md:text-4xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              📅 {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </h2>
              </div>
              {/* デスクトップ版：日時変更（右寄せ＝次月ボタン側に寄せる） */}
              <div className="hidden md:block ml-2 mr-10">
                <input
                  type="datetime-local"
                  value={(() => {
                    // currentMonthの日付に合わせて、入力値の日付部分だけ同期
                    try {
                      const v = desktopDateTime || formatDateTimeLocal(new Date());
                      const [_, t] = v.split('T');
                      const d = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(currentMonth.getDate()).padStart(2, '0')}`;
                      return `${d}T${t || '00:00'}`;
                    } catch {
                      return formatDateTimeLocal(new Date());
                    }
                  })()}
                  onChange={(e) => applyDesktopDateTime(e.target.value)}
                  className="w-[320px] px-6 py-3 text-xl font-bold border-2 border-gray-300 rounded-xl bg-white cursor-pointer"
                />
              </div>
            </div>
            <button
              onClick={goToNextMonth}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-3 md:px-6 rounded-lg font-bold text-base md:text-lg hover:from-orange-600 hover:to-orange-700"
            >
              次月→
            </button>
          </div>

          {/* カレンダー全体を外枠で囲む */}
          <div className="border-2 border-orange-400 rounded-none md:rounded-lg overflow-hidden bg-white w-full">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 bg-gradient-to-r from-orange-400 to-pink-400">
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">日</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">月</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">火</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">水</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">木</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4 border-r border-orange-300">金</div>
                <div className="text-center text-sm md:text-lg text-white font-bold py-3 md:py-4">土</div>
              </div>

            {/* 日付グリッド */}
            {/*カレンダー表示部分（既存のJSX内）*/}
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">データを読み込み中...</div>
              </div>
              ) : (
                <div className="grid grid-cols-7">
                  {generateCalendarDays(currentMonth).map((day, index) => {
                    const dateKey = `${day.fullDate.getFullYear()}-${String(day.fullDate.getMonth() + 1).padStart(2, '0')}-${String(day.fullDate.getDate()).padStart(2, '0')}`;
                    const dayRecords = savedRecords[dateKey];  

                    return (
                      <div
                        key={index}
                        className={`
                          h-24 md:h-32 flex flex-col items-start justify-start text-xs md:text-sm pt-2 px-2 md:px-3 overflow-hidden
                          ${index % 7 !== 6 ? 'border-r border-orange-300' : ''}
                          ${index < 35 ? 'border-b border-orange-300' : ''}
                          ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}
                          ${day.isSunday ? 'bg-red-50' : ''}
                          ${day.isSaturday ? 'bg-blue-50' : ''}
                          ${day.isCurrentMonth ? 'hover:bg-yellow-50' : 'hover:bg-gray-50'}
                          cursor-pointer transition
                        `}
                        onClick={() => handleDateClick(day.fullDate)}
                      >
                        {/* 日付 */}
                        <div className={`font-bold text-sm md:text-xl flex-shrink-0 mb-1 ${
                          day.isSunday ? 'text-red-600' : day.isSaturday ? 'text-blue-600' : 'text-gray-800'
                        }`}>
                          {day.date}
                        </div>
                        
                        {/* 記録スタンプ */}
                        <div className="flex-1 w-full overflow-y-auto">
                          {dayRecords && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(dayRecords)
                                .sort(([t1], [t2]) => formatTime24h(t1).localeCompare(formatTime24h(t2)))
                                .slice(0, 3)  // 1日最大3スタンプ（朝・昼・夜）
                                .map(([time, record]) => {
                                if (!record) return null;
                                
                                  const slot = getTimeSlot(time);
                                  let src = '';
                                  let alt = '';
                                  if (slot === 'morning') {
                                    src = '/Morning%20Stamp.png';
                                    alt = '朝の記録スタンプ';
                                  } else if (slot === 'noon') {
                                    src = '/Noon%20Stamp.png';
                                    alt = '昼の記録スタンプ';
                                  } else {
                                    src = '/Night%20Stamp.png';
                                    alt = '夜の記録スタンプ';
                                  }

                                  const isRecent =
                                    recentStamp &&
                                    recentStamp.date === dateKey &&
                                    recentStamp.time === time;
                                
                                return (
                                    <img
                                      key={time}
                                      src={src}
                                      alt={alt}
                                      className={`w-7 h-7 md:w-9 md:h-9 ${
                                        isRecent ? 'stamp-animate-big' : 'stamp-animate'
                                      }`}
                                    />
                                );
                              })}
                              {/* 3件以上ある場合は「+n個」とテキストで表示 */}
                              {dayRecords && Object.keys(dayRecords).length > 3 && (
                                <div className="text-[10px] md:text-xs text-gray-600 font-bold">
                                  +{Object.keys(dayRecords).length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>

          {/* 詳細モーダル */}
          {showDetail && selectedDate && (
            <div 
              className="fixed inset-0 flex items-center justify-center z-50"
              onClick={() => setShowDetail(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedDate}の記録
                  </h3>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4 overflow-y-auto flex-1">
                  {Object.entries(savedRecords[selectedDate])
                    .sort(([t1], [t2]) => formatTime24h(t1).localeCompare(formatTime24h(t2)))
                    .map(([time, record]) => {
                    if (!record) return null;
                    
                    return (
                      <div key={time} className={`p-3 rounded-lg ${getTimeColorModal(time)}`}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-lg">{formatTime24h(time)}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-white bg-opacity-50">
                              {getTimeLabel(time)}
                            </span>
                          </div>
                          {/* 編集ボタン */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(selectedDate, time, record)}
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 click-press"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteRecordByDateTime(selectedDate, time)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 click-press"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        
                        {/* 記録の詳細 */}
                        <div className="space-y-2 text-sm">
                          {(record.bloodPressure?.systolic || record.bloodPressure?.diastolic) && (
                            <p className="text-gray-700"><span className="font-semibold">血圧:</span> {record.bloodPressure?.systolic || ''}/{record.bloodPressure?.diastolic || ''}mmHg</p>
                          )}
                          {record.pulse && (
                            <p className="text-gray-700"><span className="font-semibold">脈拍:</span> {record.pulse}回/分</p>
                          )}
                          {record.weight && (
                            <>
                            <p className="text-gray-700"><span className="font-semibold">体重:</span> {record.weight}kg</p>
                              {(() => {
                                const wRaw = record.weight;
                                const w = wRaw === null || wRaw === undefined || wRaw === '' ? null : Number.parseFloat(String(wRaw));
                                const bmi = calcBmi(Number.isFinite(w) ? w : null, heightCm);
                                if (bmi === null) return null;
                                return (
                                  <p className="text-gray-700"><span className="font-semibold">BMI:</span> {bmi}</p>
                                );
                              })()}
                            </>
                          )}
                          {(record.exercise?.type || record.exercise?.duration) && (
                            <p className="text-gray-700"><span className="font-semibold">運動:</span> {record.exercise?.type || ''} {record.exercise?.duration || ''}分</p>
                          )}
                          
                          {(record.meal?.staple || record.meal?.mainDish || record.meal?.sideDish || record.meal?.other) && (
                            <div className="border-t pt-2 mt-2">
                              <p className="font-semibold text-gray-800 mb-2">食事内容：</p>
                              <div className="pl-2">
                                <div className="grid grid-cols-3 gap-1 text-gray-700 text-xs mb-1">
                                  {record.meal?.staple && <p>主食: {record.meal?.staple}</p>}
                                  {record.meal?.mainDish && <p>主菜: {record.meal?.mainDish}</p>}
                                  {record.meal?.sideDish && <p>副菜: {record.meal?.sideDish}</p>}
                                </div>
                                {record.meal?.other && <p className="text-gray-700 text-xs">その他: {record.meal?.other}</p>}
                              </div>
                            </div>
                          )}

                          {(record.medicationTaken || record.dailyLife) && (
                            <div className="border-t pt-2 mt-2">
                              {record.medicationTaken && (
                                <p className="text-gray-800 font-semibold"> 服薬確認：薬を飲みました</p>
                              )}
                              {record.dailyLife && (
                                <div className="mt-1">
                                  {(() => {
                                    const dailyLife = record.dailyLife || '';
                                    const symptomsMatch = dailyLife.match(/【症状】([^【]*)/);
                                    const memoMatch = dailyLife.match(/【メモ】(.*)/);
                                    const symptoms = symptomsMatch ? symptomsMatch[1].trim() : '';
                                    const memo = memoMatch ? memoMatch[1].trim() : '';
                                    
                                    return (
                                      <>
                                        {symptoms && (
                                          <div className="mb-2">
                                            <p className="font-semibold text-gray-800 mb-1">💭 自覚症状：</p>
                                            <p className="pl-2 text-gray-700">{symptoms}</p>
                                </div>
                              )}
                                        {memo && (
                                          <div>
                                            <p className="font-semibold text-gray-800 mb-1">📝 その他：</p>
                                            <p className="pl-2 text-gray-700">{memo}</p>
                            </div>
                          )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
              {/* 編集モーダル */}
              {editingRecord && (
                <div 
                  className="fixed inset-0 flex items-center justify-center z-50 p-4"
                  onClick={cancelEditing}
                >
                  <div 
                    className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* ヘッダー */}
                    <div className="sticky top-0 bg-gradient-to-r from-orange-400 to-pink-400 px-6 py-4 flex justify-between items-center">
                      <h3 className="text-2xl font-bold text-white">
                        ✏️ 記録を編集
                      </h3>
                      <button 
                        onClick={cancelEditing}
                        className="text-white hover:text-gray-100 text-3xl"
                      >
                        ×
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      {/* 日付・時間表示 */}
                      <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-300">
                        <p className="text-sm text-gray-600 mb-1">編集日時</p>
                        <p className="text-lg font-bold text-gray-800">
                          {editingRecord.date} {formatTime24h(editingRecord.time)}
                        </p>
                      </div>

                    {/* 血圧 */}
                    <div className="bg-orange-50 rounded-lg p-4 border-2 border-orange-300 overflow-hidden">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        🩸 血圧
                      </label>
                      <div className="flex gap-1 md:gap-2 items-center min-w-0">
                        <div className="flex-1 min-w-0">
                        <input
                          type="number"
                          value={editingRecord.record.bloodPressure?.systolic || ''}
                            onChange={(e) => {
                              clearEditFieldError('bloodPressure.systolic');
                              setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              bloodPressure: {
                                ...editingRecord.record.bloodPressure,
                                systolic: e.target.value
                              }
                            }
                              });
                            }}
                          placeholder="120"
                            className={`w-full min-w-0 px-2 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 rounded-lg focus:outline-none bg-white ${
                              editFieldErrors['bloodPressure.systolic']
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-orange-300 focus:border-orange-500'
                            }`}
                          />
                          {editFieldErrors['bloodPressure.systolic'] && (
                            <p className="mt-2 text-sm text-red-600">{editFieldErrors['bloodPressure.systolic']}</p>
                          )}
                        </div>
                        <span className="text-lg md:text-2xl font-bold flex-shrink-0">/</span>
                        <div className="flex-1 min-w-0">
                        <input
                          type="number"
                          value={editingRecord.record.bloodPressure?.diastolic || ''}
                            onChange={(e) => {
                              clearEditFieldError('bloodPressure.diastolic');
                              setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              bloodPressure: {
                                ...editingRecord.record.bloodPressure,
                                diastolic: e.target.value
                              }
                            }
                              });
                            }}
                          placeholder="80"
                            className={`w-full min-w-0 px-2 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 rounded-lg focus:outline-none bg-white ${
                              editFieldErrors['bloodPressure.diastolic']
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-orange-300 focus:border-orange-500'
                            }`}
                          />
                          {editFieldErrors['bloodPressure.diastolic'] && (
                            <p className="mt-2 text-sm text-red-600">{editFieldErrors['bloodPressure.diastolic']}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 脈拍 */}
                    <div className="bg-pink-50 rounded-lg p-4 border-2 border-pink-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        💓 脈拍
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                        <input
                          type="number"
                          value={editingRecord.record.pulse || ''}
                            onChange={(e) => {
                              clearEditFieldError('pulse');
                              setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              pulse: e.target.value
                            }
                              });
                            }}
                          placeholder="70"
                            className={`w-full px-3 py-2 md:px-4 md:py-3 text-base md:text-lg border-2 rounded-lg focus:outline-none bg-white ${
                              editFieldErrors['pulse'] ? 'border-red-400 focus:border-red-500' : 'border-pink-300 focus:border-pink-500'
                            }`}
                        />
                          {editFieldErrors['pulse'] && <p className="mt-2 text-sm text-red-600">{editFieldErrors['pulse']}</p>}
                        </div>
                        <span className="text-base md:text-lg font-semibold text-gray-700 whitespace-nowrap">回/分</span>
                      </div>
                    </div>

                    {/* 体重 */}
                    <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        ⚖️ 体重
                      </label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                        <input
                          type="number"
                          value={editingRecord.record.weight || ''}
                            onChange={(e) => {
                              clearEditFieldError('weight');
                              setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              weight: e.target.value
                            }
                              });
                            }}
                          placeholder="65.5"
                            className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none bg-white ${
                              editFieldErrors['weight']
                                ? 'border-red-400 focus:border-red-500'
                                : 'border-yellow-300 focus:border-yellow-500'
                            }`}
                        />
                          {editFieldErrors['weight'] && <p className="mt-2 text-sm text-red-600">{editFieldErrors['weight']}</p>}
                        </div>
                        <span className="text-lg font-semibold text-gray-700 min-w-fit">kg</span>
                      </div>
                    </div>

                    {/* 運動 */}
                    <div className="bg-green-50 rounded-lg p-4 border-2 border-green-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        🏃 運動
                      </label>
                      <div className="space-y-2">
                        <select
                          value={editingRecord.record.exercise?.type || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              exercise: {
                                ...editingRecord.record.exercise,
                                type: e.target.value
                              }
                            }
                          })}
                          className="w-full px-4 py-3 text-lg border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500 bg-white"
                        >
                          <option value="">選択してください</option>
                          <option value="歩行">歩行</option>
                          <option value="ランニング">ランニング</option>
                          <option value="自転車">自転車</option>
                          <option value="筋トレ">筋トレ</option>
                          <option value="その他">その他</option>
                        </select>
                        <div className="flex gap-2 items-center">
                          <div className="flex-1">
                          <input
                            type="number"
                            value={editingRecord.record.exercise?.duration || ''}
                              onChange={(e) => {
                                clearEditFieldError('exercise.duration');
                                setEditingRecord({
                              ...editingRecord,
                              record: {
                                ...editingRecord.record,
                                exercise: {
                                  ...editingRecord.record.exercise,
                                  duration: e.target.value
                                }
                              }
                                });
                              }}
                            placeholder="30"
                              className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none bg-white ${
                                editFieldErrors['exercise.duration']
                                  ? 'border-red-400 focus:border-red-500'
                                  : 'border-green-300 focus:border-green-500'
                              }`}
                          />
                            {editFieldErrors['exercise.duration'] && (
                              <p className="mt-2 text-sm text-red-600">{editFieldErrors['exercise.duration']}</p>
                            )}
                          </div>
                          <span className="text-lg font-semibold text-gray-700">分</span>
                        </div>
                      </div>
                    </div>
                    {/* 食事内容 */}
                    <div className="bg-red-50 rounded-lg p-4 border-2 border-red-300">
                      <label className="block text-xl font-bold text-gray-800 mb-4">
                        🍽️ 食事内容
                      </label>
                      <div className="space-y-4">
                        {/* 主食 */}
                        <div className="bg-white rounded p-3 border border-red-200">
                          <p className="text-lg font-semibold text-gray-700 mb-2">主食</p>
                          <div className="space-y-2">
                            {['ごはん', 'パン', 'めん', 'いも類'].map(item => (
                              <label key={item} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.staple).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('staple', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                />
                                <span className="text-lg text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 主菜 */}
                        <div className="bg-white rounded p-3 border border-red-200">
                          <p className="text-lg font-semibold text-gray-700 mb-2">主菜</p>
                          <div className="space-y-2">
                            {['魚', '肉', '卵'].map(item => (
                              <label key={item} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.mainDish).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('mainDish', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                />
                                <span className="text-lg text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 副菜 */}
                        <div className="bg-white rounded p-3 border border-red-200">
                          <p className="text-lg font-semibold text-gray-700 mb-2">副菜</p>
                          <div className="space-y-2">
                            {['野菜', '海藻', 'きのこ', '汁物', '漬物'].map(item => (
                              <label key={item} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.sideDish).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('sideDish', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="w-5 h-5 rounded border-gray-300 text-red-500 focus:ring-red-500"
                                />
                                <span className="text-lg text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* その他 */}
                        <div className="bg-white rounded p-3 border border-red-200">
                          <label className="block text-lg font-semibold text-gray-700 mb-2">その他</label>
                          <input
                            type="text"
                            value={editingRecord.record.meal?.other || ''}
                            onChange={(e) => {
                              clearEditFieldError('meal.other');
                              setEditingRecord({
                              ...editingRecord,
                              record: {
                                ...editingRecord.record,
                                meal: {
                                  ...editingRecord.record.meal,
                                  other: e.target.value
                                }
                              }
                              });
                            }}
                            placeholder="果物、乳製品など"
                            className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none bg-white ${
                              editFieldErrors['meal.other'] ? 'border-red-400 focus:border-red-500' : 'border-red-300 focus:border-red-500'
                            }`}
                          />
                          {editFieldErrors['meal.other'] && (
                            <p className="mt-2 text-sm text-red-600">{editFieldErrors['meal.other']}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 服薬確認 */}
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-300">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRecord.record.medicationTaken || false}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              medicationTaken: e.target.checked
                            }
                          })}
                          className="w-6 h-6 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <span className="text-xl font-bold text-gray-800">💊 今日、薬飲みました</span>
                      </label>
                    </div>
                    {/* 日常生活のこと */}
                    <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        📝 日常生活のこと
                      </label>
                      <textarea
                        value={editingRecord.record.dailyLife || ''}
                        onChange={(e) => {
                          clearEditFieldError('dailyLife');
                          setEditingRecord({
                          ...editingRecord,
                          record: {
                            ...editingRecord.record,
                            dailyLife: e.target.value
                          }
                          });
                        }}
                        placeholder="気分、体調の変化、気になったことなど自由にお書きください"
                        rows={4}
                        className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none bg-white ${
                          editFieldErrors['dailyLife']
                            ? 'border-red-400 focus:border-red-500'
                            : 'border-purple-300 focus:border-purple-500'
                        }`}
                      />
                      {editFieldErrors['dailyLife'] && (
                        <p className="mt-2 text-sm text-red-600">{editFieldErrors['dailyLife']}</p>
                      )}
                    </div>

                    {/* ボタン */}
                    <div className="flex gap-3 mt-6 pb-4">
                      <button
                        onClick={saveEdit}
                        disabled={saveStatus === 'saving'}
                        className={`flex-1 text-white py-4 px-4 rounded-lg font-bold text-xl transition-all ${
                          saveStatus === 'saved'
                            ? 'save-saved'
                            : saveStatus === 'saving'
                            ? 'save-saving'
                            : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600'
                        }`}
                      >
                        {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済' : '💾 保存'}
                      </button>
                      <button
                        onClick={() => deleteRecordByDateTime(editingRecord.date, editingRecord.time)}
                        disabled={saveStatus === 'saving'}
                        className="flex-1 bg-red-500 text-white py-4 px-4 rounded-lg hover:bg-red-600 font-bold text-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        🗑️ 削除
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 bg-gray-400 text-white py-4 px-4 rounded-lg hover:bg-gray-500 font-bold text-xl transition-all"
                      >
                        キャンセル
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              )}

        {/* 選択した日付の健康記録表示セクション */}
        <div className="bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 rounded-lg shadow-sm p-4 md:p-6 mb-4 border-2 border-orange-200">
          <h3 className="text-lg md:text-2xl font-bold text-gray-800 mb-4">
            📋 {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月{currentMonth.getDate()}日 の記録
          </h3>
          
          {(() => {
            const dateKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(currentMonth.getDate()).padStart(2, '0')}`;
            const dayRecords = savedRecords[dateKey] || {};
            const recordTimes = Object.keys(dayRecords).sort();
            
            if (recordTimes.length === 0) {
              return (
                <div className="text-center py-6 text-gray-500">
                  <p className="text-base md:text-lg">この日付には記録がありません</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4">
                {recordTimes.map((time) => {
                  const record = dayRecords[time];
                  const timeLabel = getTimeLabel(time);
                  
                  return (
                    <div key={time} className={`rounded-lg p-4 border-2 ${getTimeColorModal(time)}`}>
                      <h4 className="font-bold text-lg mb-3">
                        {timeLabel} {time}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <p><strong>血圧:</strong> {record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic} mmHg</p>
                        <p><strong>脈拍:</strong> {record.pulse || '-'} 回/分</p>
                        <p><strong>体重:</strong> {record.weight || '-'} kg</p>
                        {(() => {
                          const wRaw = record.weight;
                          const w = wRaw === null || wRaw === undefined || wRaw === '' ? null : Number.parseFloat(String(wRaw));
                          const bmi = calcBmi(Number.isFinite(w) ? w : null, heightCm);
                          if (bmi === null) return null;
                          return <p><strong>BMI:</strong> {bmi}</p>;
                        })()}
                        {record.exercise?.type && (
                          <p><strong>運動:</strong> {record.exercise.type} ({record.exercise.duration}分)</p>
                        )}
                        <p className="col-span-full">
                          <strong>食事:</strong> {formatMealText(record.meal) || '-'}
                        </p>
                        {record.dailyLife && (
                          <p className="col-span-full"><strong>症状など:</strong> {record.dailyLife}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* スマホ版フッター：日付選択フォーム */}
        <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t-2 border-orange-300 shadow-lg z-40">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">📅 日付を選択</span>
            </div>
            <div className="relative">
              <input
                type="date"
                value={
                  currentMonth && !isNaN(currentMonth.getTime())
                    ? currentMonth.toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]
                }
                onChange={(e) => {
                  // 値が空の場合（削除ボタン押下時）は何もしない
                  if (!e.target.value) {
                    console.log('削除ボタンが押されましたが、無視します');
                    return;
                  }
                  
                  // 日付文字列をパース（タイムゾーン対応）
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  const newDate = new Date(year, month - 1, day);
                  setCurrentMonth(newDate);
                }}
                className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold bg-white cursor-pointer"
                style={{
                  fontSize: '16px'
                }}
              />
            </div>
          </div>
        </div>

        {/* メインコンテンツの下部パディング（フッター対応） */}
        <div className="md:hidden h-20"></div>
      </main>
    </div>
  );
}
