"use client";
import { useState, useEffect } from "react"; 
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getCurrentUserId, getSession, isLineLoggedIn, setLineLogin, setLineLoggedInDB } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { readJsonOrThrow } from "@/lib/readJson";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Liff, LiffProfile } from "@/types/liff";

// 健康記録の型定義
type EditSection =
  | 'bloodPressure'
  | 'pulse'
  | 'weight'
  | 'exercise'
  | 'meal'
  | 'medication'
  | 'dailyLife'
  | null;

interface HealthRecord {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  exercise: { type: string; duration: string };
  weight: string;
  meal: {
    staple: string[];
    mainDish: string[];
    sideDish: string[];
    other: string;
  };
  dailyLife: string;
  medicationTaken: boolean;
  medicationTimes: { morning: boolean; noon: boolean; night: boolean };
}

type SavedRecords = Record<string, Record<string, HealthRecord>>;

type FamilyMember = {
  lineUserId?: string;
  isRegistered?: boolean | string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((v) => typeof v === 'string');

const isSavedRecords = (value: unknown): value is SavedRecords =>
  isRecord(value);

const parseSavedRecords = (value: unknown): SavedRecords =>
  (isSavedRecords(value) ? value : {});

const parseFamilyMembers = (value: unknown): FamilyMember[] =>
  Array.isArray(value) ? value.filter((m): m is FamilyMember => isRecord(m)) : [];

type PrintBloodData = {
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
  cpxTests?: PrintCPXTest[];
};

type PrintCPXTest = {
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
};

// SSR から渡される初期データの型
type InitialProfile = {
  displayName?: string | null;
  age?: number | null;
  gender?: string | null;
  height?: number | null;
  targetWeight?: number | null;
  diseases?: string[];
  riskFactors?: string[];
  medications?: string | null;
  physicalFunction?: string | null;
  emergencyContact?: string | null;
} | null;

type InitialRecord = {
  id: string; date: string; time: string;
  bloodPressure: { systolic: number; diastolic: number };
  pulse: number | null; weight: number | null;
  exercise: unknown; dailyLife: string | null; medicationTaken: boolean | null;
};

type Props = {
  userId: string;
  displayName: string;
  initialProfile: InitialProfile;
  initialRecords: InitialRecord[];
  initialBloodData: PrintBloodData[];
};

// 食事ガイドデータ
const MEAL_GUIDE = [
  { name: 'ハンバーガー', calories: '303Kcal', carbs: '31.2g', protein: '15.7g', salt: '1.7g' },
  { name: 'フライドポテト', calories: '420Kcal', carbs: '49.4g', protein: '4.2g', salt: '0.4g' },
  { name: '鶏のから揚げ', calories: '425Kcal', carbs: '21.9g', protein: '20.1g', salt: '3.0g' },
  { name: '餃子（タレなし）', calories: '287Kcal', carbs: '23.8g', protein: '13.5g', salt: '2.8g' },
  { name: '醤油ラーメン', calories: '443Kcal', carbs: '73.6g', protein: '15.2g', salt: '6.0g' },
  { name: 'スパゲティ・ミートソース', calories: '597Kcal', carbs: '78.0g', protein: '18.3g', salt: '2.7g' },
  { name: '天ぷらそば', calories: '459Kcal', carbs: '67.8g', protein: '10.5g', salt: '4.9g' },
  { name: 'きつねうどん', calories: '413Kcal', carbs: '68.6g', protein: '9.2g', salt: '4.0g' },
  { name: 'カレーライス', calories: '761Kcal', carbs: '124.7g', protein: '16.8g', salt: '3.3g' },
  { name: '牛丼（並）', calories: '660Kcal', carbs: '90.0g', protein: '22.3g', salt: '2.0g' },
  { name: 'チャーハン', calories: '896Kcal', carbs: '116.2g', protein: '18.1g', salt: '5.5g' },
  { name: 'うな重', calories: '754Kcal', carbs: '106.3g', protein: '24.7g', salt: '3.6g' },
  { name: '握り寿司（醤油なし）', calories: '518Kcal', carbs: '80.6g', protein: '14.8g', salt: '2.6g' },
  { name: 'とんかつ定食', calories: '1244Kcal', carbs: '128.6g', protein: '48.2g', salt: '8.0g' },
  { name: '焼き魚定食', calories: '480Kcal', carbs: '76.2g', protein: '26.3g', salt: '5.1g' },
  { name: 'ハンバーガーセット', calories: '712Kcal', carbs: '56.2g', protein: '27.4g', salt: '8.5g' },
];

export default function Home({
  userId,
  displayName,
  initialProfile,
  initialRecords,
  initialBloodData,
}: Props) {
  const router = useRouter();
  
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDateTime, setSelectedDateTime] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [printCreatedDate, setPrintCreatedDate] = useState('');
  const [printTableRows, setPrintTableRows] = useState<React.ReactNode[]>([]);
  const [printBloodDataList, setPrintBloodDataList] = useState<PrintBloodData[]>(initialBloodData);
  const [printBloodDataStatus, setPrintBloodDataStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('loaded');
  const [printMonth, setPrintMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [printMonthAverages, setPrintMonthAverages] = useState<{
    systolic: number | null;
    diastolic: number | null;
    pulse: number | null;
    weight: number | null;
    exerciseDays: number;
    medicationDays: number;
    totalDays: number;
  }>({ systolic: null, diastolic: null, pulse: null, weight: null, exerciseDays: 0, medicationDays: 0, totalDays: 0 });
  const [printProfile, setPrintProfile] = useState<Record<string, unknown>>(
    initialProfile ? { ...initialProfile } : {}
  );
  const [savedRecords, setSavedRecords] = useState<{[key: string]: {[key: string]: HealthRecord}}>({});
  const [printDbRecords, setPrintDbRecords] = useState<InitialRecord[]>(initialRecords);
  const createEmptyHealthRecord = (): HealthRecord => ({
    bloodPressure: { systolic: '', diastolic: '' },
    pulse: '',
    exercise: { type: '', duration: '' },
    weight: '',  
    meal: { staple: [], mainDish: [], sideDish: [], other: '' },
    dailyLife: '',
    medicationTaken: false,
    medicationTimes: { morning: false, noon: false, night: false },
  });

  const [healthRecord, setHealthRecord] = useState<HealthRecord>(() => createEmptyHealthRecord());
  
  // 入力フィールドの再レンダリングを防ぐためのキー
  const [inputKey, setInputKey] = useState(0);
  
  // 保存状態を管理
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const labelForFieldErrorKey = (key: string) => {
    const map: Record<string, string> = {
      'bloodPressure.systolic': '血圧（上）',
      'bloodPressure.diastolic': '血圧（下）',
      pulse: '脈拍',
      weight: '体重',
      'exercise.duration': '運動時間',
      'meal.other': '食事内容（その他）',
      dailyLife: '自覚症状やその他',
      date: '日付',
      time: '時間',
    };
    return map[key] || key;
  };

  const openSectionForErrorKey = (key: string) => {
    if (key.startsWith('bloodPressure.')) return setActiveSection('bloodPressure');
    if (key === 'pulse') return setActiveSection('pulse');
    if (key === 'weight') return setActiveSection('weight');
    if (key.startsWith('exercise.')) return setActiveSection('exercise');
    if (key.startsWith('meal.')) return setActiveSection('meal');
    if (key.startsWith('dailyLife')) return setActiveSection('dailyLife');
  };
  
  // 認証はサーバー側（page.tsx）で完結 → クライアント側の認証チェック不要
  
  // PDFテーブル: DBから取得したデータ（printDbRecords）を printMonth でフィルタして集計
  useEffect(() => {
    setPrintCreatedDate(new Date().toLocaleString('ja-JP'));

    try {
      const rows: React.ReactNode[] = [];
      const sysArr: number[] = [];
      const diaArr: number[] = [];
      const pulseArr: number[] = [];
      const weightArr: number[] = [];
      let exerciseDays = 0;
      let medicationDays = 0;
      const dateSeen = new Set<string>();

      // date は "2026-04-18T00:00:00.000Z" または "2026-04-18" 形式で返ってくる
      const toDateStr = (d: string) => d.length > 10 ? d.slice(0, 10) : d;

      printDbRecords
        .filter((r) => toDateStr(r.date).startsWith(printMonth))
        .sort((a, b) => {
          const da = toDateStr(a.date);
          const db = toDateStr(b.date);
          return da !== db ? da.localeCompare(db) : a.time.localeCompare(b.time);
        })
        .forEach((record) => {
          const dateStr = toDateStr(record.date);
          const ex = (typeof record.exercise === 'object' && record.exercise !== null)
            ? record.exercise as { type?: string; duration?: string }
            : null;

          rows.push(
            <tr key={`${dateStr}-${record.time}`}>
              <td className="border border-gray-400 p-2 text-xs">{dateStr}</td>
              <td className="border border-gray-400 p-2 text-xs">{formatTime24h(record.time)}</td>
              <td className="border border-gray-400 p-2 text-xs">{record.bloodPressure.systolic}/{record.bloodPressure.diastolic}</td>
              <td className="border border-gray-400 p-2 text-xs">{record.pulse ?? ''}</td>
              <td className="border border-gray-400 p-2 text-xs">{record.weight ?? ''}</td>
              <td className="border border-gray-400 p-2 text-xs">{ex?.type || ''}{ex?.duration ? ` ${ex.duration}分` : ''}</td>
              <td className="border border-gray-400 p-2 text-xs">{record.medicationTaken ? '○' : '-'}</td>
              <td className="border border-gray-400 p-2 text-xs">{record.dailyLife || '-'}</td>
            </tr>
          );

          const sys = record.bloodPressure.systolic;
          const dia = record.bloodPressure.diastolic;
          const pls = record.pulse;
          const wgt = record.weight;
          if (sys > 0) sysArr.push(sys);
          if (dia > 0) diaArr.push(dia);
          if (pls != null && pls > 0) pulseArr.push(pls);
          if (wgt != null && wgt > 0) weightArr.push(wgt);
          if (!dateSeen.has(dateStr)) {
            dateSeen.add(dateStr);
            if (ex?.duration) exerciseDays++;
            if (record.medicationTaken) medicationDays++;
          }
        });

      setPrintTableRows(rows.length > 0 ? rows : [
        <tr key="empty"><td className="border border-gray-400 p-2 text-center text-sm text-gray-500" colSpan={8}>この月の記録はありません</td></tr>
      ]);

      const avg = (arr: number[]) =>
        arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : null;
      setPrintMonthAverages({
        systolic: avg(sysArr),
        diastolic: avg(diaArr),
        pulse: avg(pulseArr),
        weight: avg(weightArr),
        exerciseDays,
        medicationDays,
        totalDays: dateSeen.size,
      });
    } catch {
      setPrintTableRows([<tr key="error"><td className="border border-gray-400 p-2" colSpan={8}>データ取得エラー</td></tr>]);
    }
  }, [printMonth, printDbRecords]);

  // pendingPrint が true になったら、次の描画後に window.print() を呼ぶ
  const [pendingPrint, setPendingPrint] = useState(false);
  useEffect(() => {
    if (!pendingPrint) return;
    setPendingPrint(false);
    window.print();
  }, [pendingPrint]);

  // NavigationBar からの印刷トリガーを受け取る（毎回最新データを取得してから印刷）
  useEffect(() => {
    const handleTriggerPrint = async (e: Event) => {
      const month = (e as CustomEvent<{ month: string }>).detail?.month;
      if (month) setPrintMonth(month);

      // 最新データを並行取得
      try {
        const [recordsRes, profileRes, bloodRes] = await Promise.all([
          apiFetch('/api/health-records'),
          apiFetch('/api/profiles'),
          apiFetch('/api/blood-data'),
        ]);
        if (recordsRes.ok) {
          const data = await recordsRes.json();
          if (Array.isArray(data?.records)) setPrintDbRecords(data.records);
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          if (data?.profile && typeof data.profile === 'object')
            setPrintProfile(data.profile as Record<string, unknown>);
        }
        if (bloodRes.ok) {
          const data = await bloodRes.json();
          if (Array.isArray(data)) setPrintBloodDataList(data);
        }
      } catch (err) {
        console.error('PDF: データ取得エラー', err);
      }

      // 状態更新 → React 再描画 → 印刷の順序を保証
      setPendingPrint(true);
    };

    window.addEventListener('triggerPrint', handleTriggerPrint as EventListener);
    return () => window.removeEventListener('triggerPrint', handleTriggerPrint as EventListener);
  }, []);

  // PDF印刷用データはサーバー（page.tsx）から props で渡される → 初回取得の useEffect 不要

  // （HealthRecord の再定義は不要。上の型を使用）

  // 時間を日本語表記に変換する関数
  const getTimeLabel = (time: string) => {
    if (time >= '06:00' && time < '12:00') return '朝';
    if (time >= '12:00' && time < '18:00') return '昼';
    return '夜';
  };

  // 配列の文字列変換ヘルパー関数
  const convertStringToArray = (value: string | string[] | undefined): string[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value ? value.split(', ').filter(Boolean) : [];
    return [];
  };

  // 食事選択のハンドラー関数
  const handleMealChange = (category: 'staple' | 'mainDish' | 'sideDish', item: string, checked: boolean) => {
    setHealthRecord(prev => {
      const currentMeal = prev.meal || { staple: [], mainDish: [], sideDish: [], other: '' };
      
      return {
        ...prev,
        meal: {
          ...currentMeal,
          [category]: checked 
            ? [...(currentMeal[category] || []), item]
            : (currentMeal[category] || []).filter(i => i !== item)
        }
      };
    });
  };

  // 時間帯に応じた色を設定する関数
  const getTimeColor = (time: string) => {
    if (time >= '06:00' && time < '12:00') return 'bg-green-100 text-green-800';
    if (time >= '12:00' && time < '18:00') return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
  };

  // 詳細モーダル用の色設定関数
  const getTimeColorModal = (time: string) => {
    if (time >= '06:00' && time < '12:00') return 'bg-green-50 text-green-800';
    if (time >= '12:00' && time < '18:00') return 'bg-blue-50 text-blue-800';
    return 'bg-purple-50 text-purple-800';
  };

  const blockInvalidKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  const blockInvalidKeysInt = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['-', '+', 'e', 'E', '.', ',', '。', '．'].includes(e.key)) e.preventDefault();
  };

  const toHalfWidthNumberLike = (s: string) =>
    s
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[，,]/g, '.')
      .replace(/[。．]/g, '.');

  const sanitizeInt = (raw: string, opts: { maxDigits?: number; max?: number } = {}) => {
    const { maxDigits = 3, max } = opts;
    const digits = toHalfWidthNumberLike(raw)
      .replace(/\D/g, '')
      .replace(/^0+(?=\d)/, '') // 先頭0整理（"0"は残す）
      .slice(0, maxDigits);
    // 「0だけ」は入力させない
    if (digits === '0') return '';
    // 最大値を超えたらクランプ
    if (max !== undefined && digits !== '' && Number(digits) > max) return String(max);
    return digits;
  };

  const sanitizeDecimal = (
    raw: string,
    opts: { maxDecimals?: number; maxIntDigits?: number; max?: number } = {}
  ) => {
    const { maxDecimals = 2, maxIntDigits = 3, max } = opts;
    const v0 = toHalfWidthNumberLike(raw);
    const cleaned = v0.replace(/[^0-9.]/g, '');
    const [intPartRaw, decPartRaw = ''] = cleaned.split('.');
    const intPart = intPartRaw
      .replace(/^0+(?=\d)/, '') // 先頭0整理（"0"は残す）
      .slice(0, maxIntDigits);
    const decPart = decPartRaw.slice(0, maxDecimals);
    const hasDot = cleaned.includes('.');
    let result: string;
    // 小数だけ入力されるケース: ".5" -> "0.5"
    if (hasDot) {
      if (decPart.length) result = `${intPart || '0'}.${decPart}`;
      else result = `${intPart || '0'}.`; // 末尾が "." の場合は保持（入力途中を許可）
    } else if ((intPart || '') === '0' && maxDecimals > 0) {
      result = '0.'; // 「0だけ」は小数入力へ誘導
    } else {
      result = intPart;
    }
    // 最大値を超えたらクランプ（末尾"."中の入力途中はスキップ）
    if (max !== undefined && result !== '' && !result.endsWith('.') && Number(result) > max) {
      return String(max);
    }
    return result;
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const hasAnyErrorForSection = (section: EditSection) => {
    if (!section) return false;
    const keys = Object.keys(fieldErrors);
    if (section === 'bloodPressure') return keys.some((k) => k.startsWith('bloodPressure.'));
    if (section === 'pulse') return keys.includes('pulse');
    if (section === 'weight') return keys.includes('weight');
    if (section === 'exercise') return keys.some((k) => k.startsWith('exercise.'));
    if (section === 'meal') return keys.some((k) => k.startsWith('meal.'));
    if (section === 'medication') return keys.some((k) => k.startsWith('medication'));
    if (section === 'dailyLife') return keys.some((k) => k.startsWith('dailyLife'));
    return false;
  };

  // トップの各カード直下に出す「赤い注意書き（エラー時のみ）」用
  const getSectionErrorMessages = (section: EditSection): string[] => {
    if (!section) return [];
    const msgs: string[] = [];
    const push = (key: string) => {
      const m = fieldErrors[key];
      if (m) msgs.push(m);
    };
    if (section === 'bloodPressure') {
      push('bloodPressure.systolic');
      push('bloodPressure.diastolic');
      return msgs;
    }
    if (section === 'pulse') {
      push('pulse');
      return msgs;
    }
    if (section === 'weight') {
      push('weight');
      return msgs;
    }
    if (section === 'exercise') {
      push('exercise.duration');
      // 将来の拡張に備えて exercise. で始まるキーも拾う
      Object.keys(fieldErrors)
        .filter((k) => k.startsWith('exercise.') && k !== 'exercise.duration')
        .forEach((k) => {
          const m = fieldErrors[k];
          if (m) msgs.push(m);
        });
      return msgs;
    }
    if (section === 'meal') {
      Object.keys(fieldErrors)
        .filter((k) => k.startsWith('meal.'))
        .forEach((k) => {
          const m = fieldErrors[k];
          if (m) msgs.push(m);
        });
      return msgs;
    }
    if (section === 'dailyLife') {
      push('dailyLife');
      return msgs;
    }
    return msgs;
  };

  const validateAll = () => {
    const errs: Record<string, string> = {};
    const add = (k: string, msg: string) => {
      if (!errs[k]) errs[k] = msg;
    };

    const sys = healthRecord?.bloodPressure?.systolic?.trim?.() ?? '';
    const dia = healthRecord?.bloodPressure?.diastolic?.trim?.() ?? '';
    const pulse = healthRecord.pulse?.trim?.() ?? '';
    const weight = healthRecord.weight?.trim?.() ?? '';
    const dur = healthRecord.exercise?.duration?.trim?.() ?? '';
    const mealOther = String(healthRecord.meal?.other ?? '');
    const dailyLife = String(healthRecord.dailyLife ?? '');

    if (!sys) add('bloodPressure.systolic', '収縮期血圧（上）は必須です');
    if (!dia) add('bloodPressure.diastolic', '拡張期血圧（下）は必須です');
    if (!pulse) add('pulse', '脈拍は必須です');

    const sysN = sys ? Number(sys) : NaN;
    const diaN = dia ? Number(dia) : NaN;
    const pulseN = pulse ? Number(pulse) : NaN;

    if (sys && (!Number.isFinite(sysN) || sysN < 50 || sysN > 250)) {
      add('bloodPressure.systolic', '収縮期血圧（上）は 50〜250 mmHg の範囲で入力してください');
    }
    if (dia && (!Number.isFinite(diaN) || diaN < 20 || diaN > 200)) {
      add('bloodPressure.diastolic', '拡張期血圧（下）は 20〜200 mmHg の範囲で入力してください');
    }
    if (pulse && (!Number.isFinite(pulseN) || pulseN < 20 || pulseN > 200)) {
      add('pulse', '脈拍は 20〜200 回/分 の範囲で入力してください');
    }

    if (weight) {
      const w = Number(weight);
      if (!Number.isFinite(w) || w <= 0 || w > 200) add('weight', '体重は 0より大きい〜200 kg の範囲で入力してください');
    }

    if (dur) {
      const d = Number(dur);
      if (!Number.isFinite(d) || d <= 0 || d > 1440) add('exercise.duration', '運動時間は 1〜1440 分の範囲で入力してください');
    }

    // 文字数制限
    if (mealOther && mealOther.length > 200) add('meal.other', '食事内容（その他）は 200 文字以内で入力してください');
    if (dailyLife && dailyLife.length > 400) add('dailyLife', '自覚症状やその他は 400 文字以内で入力してください');

    return errs;
  };
  
  const nonNegative = (v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return '';
    return n < 0 ? '0' : String(n);
  };

  // （AIアドバイス機能は廃止）

  // localStorageキーをユーザーIDで個別化
  const getStorageKey = (baseKey: string) => {
    if (user?.userId) {
      return `${baseKey}_${user.userId}`;
    }
    // ローカル開発時はユーザーIDなしでも動くようフォールバック
    return `${baseKey}_local`;
  };

  // 心臓ちゃんの表情を決定する関数
  const getHeartEmotion = (record: HealthRecord) => {
    let score = 0;
    
    // 血圧の評価（正常範囲: 収縮期<140, 拡張期<90）
    if (record.bloodPressure?.systolic && record.bloodPressure?.diastolic) {
      const systolic = parseInt(record.bloodPressure.systolic);
      const diastolic = parseInt(record.bloodPressure.diastolic);
      
      if (systolic < 120 && diastolic < 80) {
        score += 2; // 理想的な血圧
      } else if (systolic < 140 && diastolic < 90) {
        score += 1; // 正常な血圧
      } else {
        score -= 1; // 高血圧
      }
    }
    
    // 脈拍の評価（正常範囲: 60-100回/分）
    if (record.pulse) {
      const pulse = parseInt(record.pulse);
      if (pulse >= 60 && pulse <= 100) {
        score += 1; // 正常な脈拍
      } else {
        score -= 1; // 異常な脈拍
      }
    }
    
    // 運動の評価
    if (record.exercise?.type && record.exercise?.duration) {
      const duration = parseInt(record.exercise.duration);
      if (duration >= 30) {
        score += 1; // 十分な運動
      }
    }
    
    // 食事の評価
    if (record.meal?.staple && record.meal?.mainDish && record.meal?.sideDish) {
      score += 1; // バランスの取れた食事
    }
    
    // スコアに基づいて表情を決定
    if (score >= 3) {
      return 'happy'; // 笑顔
    } else if (score <= 0) {
      return 'sad'; // 悲しい
    } else {
      return 'normal'; // 普通
    }
  };

  // 心臓ちゃんの画像パスを取得
  const getHeartImage = (emotion: string) => {
    // 全ページで heart.png に統一
    return '/heart.png';
  };

  // 詳細表示用の状態を追加
  const [showHeartRehabInfo, setShowHeartRehabInfo] = useState(false);

  // 各項目編集用モーダルの状態
  const [activeSection, setActiveSection] = useState<EditSection>(null);
  const [showMealGuide, setShowMealGuide] = useState(false);

  // LIFF関連の状態を追加
  const [liff, setLiff] = useState<Liff | null>(null);
  // user はサーバーから渡された userId/displayName で初期化
  const [user, setUser] = useState<LiffProfile | null>(
    userId ? { userId, displayName, pictureUrl: '', statusMessage: '' } : null
  );
  const [isLiffReady, setIsLiffReady] = useState(false);
  // 心臓ちゃんの表情状態を追加
  const [heartEmotion, setHeartEmotion] = useState('normal');

  // 🆕 追加：LINEアプリ内判定用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });

  // 現在時刻を自動セット
  useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setSelectedDateTime(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${hours}:${minutes}`);
  }, []);

  // 最新の記録を取得して心臓ちゃんの表情を決定
  useEffect(() => {
    const savedData = localStorage.getItem(getStorageKey('healthRecords'));
    if (savedData) {
      const records = JSON.parse(savedData);
      const today = new Date();
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const todayRecords = records[todayKey];
      if (todayRecords) {
        // 最新の記録を取得
        const sortedTimes = Object.keys(todayRecords).sort((a, b) => 
          formatTime24h(b).localeCompare(formatTime24h(a))
        );
        
        if (sortedTimes.length > 0) {
          const latestRecord = todayRecords[sortedTimes[0]];
          const emotion = getHeartEmotion(latestRecord);
          setHeartEmotion(emotion);
        }
      }
    }
  }, [savedRecords]); // savedRecordsが更新されたら再評価

  // 設定メニューの状態を追加
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // 時間選択オプション
  const timeOptions = [
    { value: '06:00', label: '06:00' },
    { value: '07:00', label: '07:00' },
    { value: '08:00', label: '08:00' },
    { value: '09:00', label: '09:00' },
    { value: '10:00', label: '10:00' },
    { value: '11:00', label: '11:00' },
    { value: '12:00', label: '12:00' },
    { value: '13:00', label: '13:00' },
    { value: '14:00', label: '14:00' },
    { value: '15:00', label: '15:00' },
    { value: '16:00', label: '16:00' },
    { value: '17:00', label: '17:00' },
    { value: '18:00', label: '18:00' },
    { value: '19:00', label: '19:00' },
    { value: '20:00', label: '20:00' },
    { value: '21:00', label: '21:00' },
    { value: '22:00', label: '22:00' },
    { value: '23:00', label: '23:00' },
    { value: '24:00', label: '24:00' },
  ];

  // LIFF初期化
  useEffect(() => {
    const initLiff = async () => {
      try {
        // メールログインセッションがある場合はLIFF初期化をスキップ
        const session = getSession();
        if (session) {
          console.log('📧 メールログイン検出: LIFF初期化をスキップ');
          setIsLiffReady(true);
          return;
        }

        // ローカル環境の場合はLIFF機能をスキップ
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('ローカル環境: LIFF機能をスキップ');
          setIsLiffReady(true);
          return;
        }

        // LIFFが利用可能かチェック
        if (typeof window !== 'undefined' && window.liff) {
          const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
          if (!liffId) {
            console.warn('LIFF ID missing; skipping init');
            setIsLiffReady(true);
            return;
          }
          // LIFF初期化
          await window.liff.init({ 
            liffId
          });
          
          setLiff(window.liff);
          setIsLiffReady(true);

          // ログイン状態をチェック
          if (window.liff.isLoggedIn()) {
            // ユーザー情報を取得
            const profile = await window.liff.getProfile();
            setUser(profile);
            console.log('LINEユーザー情報:', profile);
            
            // 🆕 LINE ログイン状態をメモリに保存
            setLineLogin(profile.userId, profile.displayName);
            console.log('✅ LINE ログイン状態をメモリに保存');
            
            // Supabase に保存（背景で実行、エラー無視）
            setLineLoggedInDB(profile.userId, true, profile.userId)
              .then(() => console.log('✅ LINE ログイン状態を Supabase に保存'))
              .catch((error) => console.error('⚠️ Supabase 保存失敗（無視）:', error));

            // LINEアプリ内で実行されているかチェック
            if (window.liff.isInClient()) {
              console.log('LINEアプリ内で実行中');
              setIsLineApp(true); // 🆕 追加
              
              // LINEアプリ内の安全エリアを設定
              const handleResize = () => {
                // ビューポート高さの設定（iOS Safari対応）
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                // LINEのUI高さを考慮した安全エリア設定
                const statusBarHeight = window.screen.height - window.innerHeight > 100 ? 44 : 20;
                setLineSafeArea({
                  top: statusBarHeight,
                  bottom: 0
                });
                
                // 🆕 デバッグ用ログ
                console.log('LINEアプリ検出:', {
                  isLineApp: true,
                  safeArea: { top: statusBarHeight, bottom: 0 },
                  windowHeight: window.innerHeight,
                  screenHeight: window.screen.height
                });
              };
              
              // 初回実行
              handleResize();
              
              // リサイズイベントリスナーを追加
              window.addEventListener('resize', handleResize);
              
              // クリーンアップ用のイベントリスナー保存
              window.addEventListener('orientationchange', () => {
                setTimeout(handleResize, 100);
              });
 
            } else {
              console.log('ブラウザで実行中');
              setIsLineApp(false); // 🆕 追加
            }
          } else {
            // ログインしていない場合はログイン画面を表示
            window.liff.login();
          }
        }
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
      }
    };
    initLiff();
  }, []);

  // データ読み込み
  useEffect(() => {
    // まずローカルキーで試す
    const savedData = localStorage.getItem('healthRecords_local');
    if (savedData) {
      setSavedRecords(JSON.parse(savedData));
    }
    
    // 入力中のデータも復元
    const savedInputData = localStorage.getItem('healthRecordInput');
    if (savedInputData) {
      setHealthRecord(JSON.parse(savedInputData));
    }
  }, []);

  // メニュー外クリックで閉じる
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

  // LINE通知機能
  const sendToLine = async (message: string) => {
    if (liff && liff.isLoggedIn()) {
      try {
        await liff.shareTargetPicker([
          {
            type: 'text',
            text: message
          }
        ]);
      } catch (error) {
        console.error('LINE送信エラー:', error);
      }
    }
  };

  // LINE Messaging API関連の状態と機能
  const [lineConnected, setLineConnected] = useState(false);
  
  // LINE Messaging APIで家族にメッセージを送信
  const sendLineMessageToFamily = async (memberId: string, message: string) => {
    try {
      const response = await apiFetch('/api/line/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineUserId: memberId,
          message: message,
        }),
      });

      if (response.ok) {
        console.log('LINEメッセージ送信成功');
        return true;
      }
    } catch (error) {
      console.error('LINEメッセージ送信エラー:', error);
    }
    return false;
  };

  // 健康記録を家族全員に自動送信
  const shareHealthRecordToAllFamily = async (healthRecord: HealthRecord) => {
    // 家族メンバー情報を取得
    const raw = JSON.parse(localStorage.getItem('familyMembers') || '[]');
    const familyMembers = parseFamilyMembers(raw);
    
    const message = `💖 心臓ちゃんからの健康報告 💖\n\n` +
      `日時: ${new Date().toLocaleDateString('ja-JP')}\n` +
      `血圧: ${healthRecord.bloodPressure?.systolic || ''}/${healthRecord.bloodPressure?.diastolic || ''}mmHg\n` +
      `脈拍: ${healthRecord.pulse || ''}回/分\n` +
      `体重: ${healthRecord.weight || ''}kg\n` +
      `運動: ${healthRecord.exercise?.type || ''} ${healthRecord.exercise?.duration || ''}分\n` +
      `食事: 主食${healthRecord.meal?.staple || ''} 主菜${healthRecord.meal?.mainDish || ''} 副菜${healthRecord.meal?.sideDish || ''}\n` +
      `\n心臓ちゃんからのメッセージ: 今日もお疲れ様でした！💪`;

    // 登録済みの家族メンバーに送信
    const registeredMembers = familyMembers.filter(
      (member) => Boolean(member.lineUserId) && (member.isRegistered === true || member.isRegistered === 'true')
    );

    for (const member of registeredMembers) {
      await sendLineMessageToFamily(member.lineUserId!, message);
    }
  };

  // 異常値検出時の緊急通知
  const sendEmergencyNotification = async (healthRecord: HealthRecord) => {
    const isAbnormal = 
      parseInt(healthRecord.bloodPressure?.systolic) > 180 ||
      parseInt(healthRecord.bloodPressure?.diastolic) > 110 ||
      parseInt(healthRecord.pulse) > 120 ||
      parseInt(healthRecord.pulse) < 50;

    if (isAbnormal) {
      const emergencyMessage = `🚨 緊急通知 🚨\n\n` +
        `異常な値が検出されました！\n` +
        `血圧: ${healthRecord.bloodPressure?.systolic || ''}/${healthRecord.bloodPressure?.diastolic || ''}mmHg\n` +
        `脈拍: ${healthRecord.pulse || ''}回/分\n` +
        `\n早急に医師に相談することをお勧めします。\n` +
        `心臓ちゃんより💖`;

      // 家族メンバー情報を取得
      const raw = JSON.parse(localStorage.getItem('familyMembers') || '[]');
      const familyMembers = parseFamilyMembers(raw);
      
      const registeredMembers = familyMembers.filter(
        (member) => Boolean(member.lineUserId) && (member.isRegistered === true || member.isRegistered === 'true')
      );

      for (const member of registeredMembers) {
        await sendLineMessageToFamily(member.lineUserId!, emergencyMessage);
      }
    }
  };

  //localStorage保存処理
  const handleSaveHealthRecord = async () => {
    try {
      // 保存開始
      setSaveStatus('saving');
      setFormError(null);
      
      // バリデーション（複数項目をまとめて赤枠表示）
      const errs = validateAll();
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setFormError('入力内容にエラーがあります。赤枠の項目を修正してください。');
        setSaveStatus('idle');
        // 最初のエラー項目を開く
        const keys = Object.keys(errs);
        const first = keys[0] || '';
        if (first.startsWith('bloodPressure.')) setActiveSection('bloodPressure');
        else if (first === 'pulse') setActiveSection('pulse');
        else if (first === 'weight') setActiveSection('weight');
        else if (first.startsWith('exercise.')) setActiveSection('exercise');
        return;
      } else {
        setFieldErrors({});
      }

      // 日時から日付と時間を分離
      const dateTime = new Date(selectedDateTime);
      const dateKey = `${dateTime.getFullYear()}-${String(dateTime.getMonth() + 1).padStart(2, '0')}-${String(dateTime.getDate()).padStart(2, '0')}`;
      const timeKey = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

      // データベースに保存
      const response = await apiFetch('/api/health-records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.userId || 'user-1', // LINE ユーザーID から取得
          healthRecord: {
            date: dateKey,
            time: timeKey,
            bloodPressure: healthRecord.bloodPressure,
            pulse: healthRecord.pulse,
            weight: healthRecord.weight,
            exercise: healthRecord.exercise,
            meal: {
              staple: convertStringToArray(healthRecord.meal?.staple).join(', '),
              mainDish: convertStringToArray(healthRecord.meal?.mainDish).join(', '),
              sideDish: convertStringToArray(healthRecord.meal?.sideDish).join(', '),
              other: healthRecord.meal?.other || ''
            },
            dailyLife: healthRecord.dailyLife,
            medicationTaken: healthRecord.medicationTaken || false
          }
        }),
      });

      if (response.ok) {
        const result = await readJsonOrThrow(response);
        alert(`${timeKey}の健康記録を保存しました！`);
        
        // 保存完了状態に更新
        setSaveStatus('saved');
        
        // 3秒後にアイドル状態に戻す
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
        
        // カレンダーページ用に直近の記録情報を保存（スタンプ演出用）
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              'lastSavedRecord',
              JSON.stringify({
                date: dateKey,
                time: timeKey,
                savedAt: Date.now(),
              })
            );
          } catch (e) {
            console.log('⚠️ lastSavedRecord 保存エラー（無視）:', e);
          }
        }
        
        // ✨ Messaging API チャネル用 LIFF で Bot にメッセージを送信（自動送信）
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const messagingLiffId = process.env.NEXT_PUBLIC_LIFF_ID_MESSAGING;
            
            if (messagingLiffId) {
              console.log('📱 Messaging API LIFF で Bot にメッセージを送信中...');
              
              // Messaging API 用 LIFF を動的に初期化
              if (window.liff) {
                window.liff.init({ liffId: messagingLiffId })
                  .then(() => {
                    console.log('✅ Messaging API LIFF 初期化成功');
                    
                    if (window.liff?.isLoggedIn?.()) {
                      window.liff.sendMessages([
                        {
                          type: 'text',
                          text: '健康記録'
                        }
                      ])
                      .then(() => {
                        console.log('✅ Bot に健康記録メッセージ送信成功');
                      })
                      .catch((error: unknown) => {
                        const message = error instanceof Error ? error.message : String(error);
                        console.log('⚠️ メッセージ送信失敗（無視）:', message);
                      });
                    }
                  })
                  .catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : String(error);
                    console.log('⚠️ Messaging API LIFF 初期化失敗（無視）:', message);
                  });
              }
            } else {
              console.log('⚠️ NEXT_PUBLIC_LIFF_ID_MESSAGING が設定されていません');
            }
          }, 500);
        }
        
        // フォームをリセット
        setHealthRecord(createEmptyHealthRecord());
      } else if (response.status === 503) {
        // ⚠️ データベースが利用不可の場合、ローカルストレージに保存
        console.log('⚠️ Database unavailable (503), saving to localStorage');
        const saved = JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}');
        if (!saved[dateKey]) {
          saved[dateKey] = {};
        }
        saved[dateKey][timeKey] = {
          bloodPressure: healthRecord.bloodPressure,
          pulse: healthRecord.pulse,
          weight: healthRecord.weight,
          exercise: healthRecord.exercise,
          meal: {
            staple: convertStringToArray(healthRecord.meal?.staple).join(', '),
            mainDish: convertStringToArray(healthRecord.meal?.mainDish).join(', '),
            sideDish: convertStringToArray(healthRecord.meal?.sideDish).join(', '),
            other: healthRecord.meal?.other || ''
          },
          dailyLife: healthRecord.dailyLife
        };
        localStorage.setItem(getStorageKey('healthRecords'), JSON.stringify(saved));
        alert(`${timeKey}の健康記録をローカルストレージに保存しました！`);
        
        // カレンダーページ用に直近の記録情報を保存（スタンプ演出用）
        try {
          localStorage.setItem(
            'lastSavedRecord',
            JSON.stringify({
              date: dateKey,
              time: timeKey,
              savedAt: Date.now(),
            })
          );
        } catch (e) {
          console.log('⚠️ lastSavedRecord 保存エラー（無視）:', e);
        }
        
        // フォームをリセット
        setHealthRecord(createEmptyHealthRecord());
      } else {
        const error = await readJsonOrThrow(response).catch(() => ({}));
        const fieldErrors =
          isRecord(error) && isStringRecord(error.fieldErrors) ? error.fieldErrors : undefined;
        if (response.status === 400 && fieldErrors) {
          const fe = fieldErrors;
          setFieldErrors(fe);
          setFormError('入力内容にエラーがあります。赤枠の項目を修正してください。');
          const keys = Object.keys(fe);
          const first = keys[0] || '';
          if (first.startsWith('bloodPressure.')) setActiveSection('bloodPressure');
          else if (first === 'pulse') setActiveSection('pulse');
          else if (first === 'weight') setActiveSection('weight');
          else if (first.startsWith('exercise.')) setActiveSection('exercise');
        } else {
          const errorMessage = isRecord(error) && typeof error.error === 'string' ? error.error : undefined;
          alert(`保存に失敗しました: ${errorMessage || '不明なエラー'}`);
        }
        setSaveStatus('idle');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('保存中にエラーが発生しました');
      setSaveStatus('idle');
    }
  };

  // 医療機関用データエクスポート
  const exportHealthData = () => {
    const saved = JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}');
    const profile = JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}');
    
    // 患者情報を含む完全なデータ
    const exportData = {
      patientInfo: {
        name: profile.displayName || '未設定',
        age: profile.age || '未設定',
        gender: profile.gender || '未設定',
        targetWeight: profile.targetWeight || '未設定',
        diseases: profile.diseases || [],
        riskFactors: profile.riskFactors || [],
        medications: profile.medications || '',
        physicalFunction: profile.physicalFunction || ''
      },
      healthRecords: saved,
      exportDate: new Date().toISOString(),
      version: '1.1'
    };

    // JSONファイルとしてダウンロード
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `心臓リハビリ記録_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    alert('医療機関用データをエクスポートしました。\nこのファイルを医療機関に共有してください。');
  };

  // CSV形式でもエクスポート
  const exportCSV = () => {
    const saved = parseSavedRecords(JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}'));
    
    let csv = '日付,時間,収縮期血圧,拡張期血圧,脈拍,体重,運動種目,運動時間,主食,主菜,副菜,その他,服薬確認,日常生活\n';
    
    Object.entries(saved).forEach(([date, times]) => {
      Object.entries(times).forEach(([time, record]) => {
        if (!record) return;
        
        const row = [
          date,
          time,
          record.bloodPressure?.systolic || '',
          record.bloodPressure?.diastolic || '',
          record.pulse || '',
          record.weight || '',
          record.exercise?.type || '',
          record.exercise?.duration || '',
          record.meal?.staple || '',
          record.meal?.mainDish || '',
          record.meal?.sideDish || '',
          record.meal?.other || '',
          record.medicationTaken ? '○' : '',
          record.dailyLife || ''
        ];
        
        csv += row.map(field => `"${field}"`).join(',') + '\n';
      });
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `心臓リハビリ記録_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  //PDF出力内の時間を24時間表記に統一
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

  // LINEアプリ用の追加スタイル
  const lineAppStyles = `
  .line-app-container {
    /* LINEのナビゲーションバーを避ける */
    height: calc(100vh - 60px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .line-app-container input,
  .line-app-container select,
  .line-app-container textarea {
    /* iOS LINEアプリでの入力フィールド最適化 */
    font-size: 16px !important;
    transform: translateZ(0);
  }

  /* number inputのみスピナーを表示 */
  .line-app-container input[type="number"] {
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
  }

  /* 他のinputはappearanceをリセット（checkboxは除外） */
  .line-app-container input:not([type="number"]):not([type="checkbox"]),
  .line-app-container select,
  .line-app-container textarea {
    -webkit-appearance: none;
  }

  /* チェックボックスは表示を維持 */
  .line-app-container input[type="checkbox"] {
    -webkit-appearance: checkbox;
    appearance: checkbox;
  }

  .line-app-container button {
    /* タッチしやすいボタンサイズ */
    min-height: 44px;
    padding: 12px 16px;
  }

  /* LINEアプリ内でのスクロール最適化 */
  .line-app-container * {
    -webkit-overflow-scrolling: touch;
  }
  `;

  // 食事内容が「何か1つでも」入力されているか（配列チェック or その他テキスト）
  const hasMealInput = (() => {
    const meal = healthRecord.meal;
    const hasArray = (v: unknown) => Array.isArray(v) && v.filter(Boolean).length > 0;
    const other =
      typeof meal?.other === 'string' ? meal.other.trim().length > 0 : Boolean(meal?.other);
    return hasArray(meal?.staple) || hasArray(meal?.mainDish) || hasArray(meal?.sideDish) || other;
  })();

  // 認証はサーバー側で完結済み → 常に表示
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* LINEアプリ用スタイル追加 */}
      {typeof window !== 'undefined' && isLineApp && (
        <style dangerouslySetInnerHTML={{ __html: lineAppStyles }} />
      )}
      <PageHeader
        title="心臓リハビリ手帳"
        icon={
          <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
            <img
              src={getHeartImage(heartEmotion)}
              alt="心臓ちゃん"
              className="w-full h-full object-contain heartbeat-float"
            />
          </div>
        }
        onTitleClick={() => setShowHeartRehabInfo(true)}
        isLineApp={isLineApp}
        lineSafeAreaTop={isLineApp ? lineSafeArea.top : undefined}
        userLabel={user?.displayName ? `${user.displayName}さん` : undefined}
      />

      {/* メインコンテンツ */}
      <main 
        className={`px-0 md:p-3 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '0px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '0px',
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        {/* 健康記録（横幅full） */}
        <section className="bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 rounded-none md:rounded-lg shadow-none md:shadow-sm p-4 md:p-3 mb-1 md:mb-2 w-full">
          {/* ウェルカムメッセージ */}
          <div className="bg-gradient-to-r from-orange-400 to-pink-400 rounded-xl px-4 py-3 mb-4">
            <p className="text-white font-bold text-base">今日も健康記録を入力しましょう！</p>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">⚠️</span>
              <p className="text-base font-semibold text-red-700">{formError}</p>
            </div>
          )}
          {/* エラー列挙（上部まとめ表示）は廃止し、各入力欄の直下に表示する */}
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-2 pb-4 md:pb-2 border-b md:border-b-0 border-gray-200">
            <h2 className="text-2xl md:text-4xl font-bold md:font-bold text-gray-800">
              健康記録
            </h2>
            
            {/* 日付と時間を統合 */}
            <div id="tour-health-date" className="w-full md:w-auto hidden md:block">
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-3">
                記録日時 <span className="text-xs md:text-sm text-gray-500">（現在の日時が自動入力されています）</span>
              </label>
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(e) => setSelectedDateTime(e.target.value)}
                className={`w-full px-2 md:px-4 py-4 md:py-3 text-lg md:text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold ${
                  isLineApp ? 'line-input' : ''
                }`}
                style={{
                  fontSize: 'clamp(16px, 2vw, 18px)',
                  minHeight: 'auto',
                  ...(isLineApp ? { fontSize: '16px' } : {})
                }}
              />
            </div>
          </div>

          {/* 入力フォーム - アイコンボタングリッド */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {/* 血圧 */}
            <div id="tour-health-bp">
              <button
                type="button"
                onClick={() => setActiveSection('bloodPressure')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('bloodPressure') ? 'border-red-400 ring-2 ring-red-100' : 'border-orange-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-4xl">🩸</div>
                <span className="text-lg font-bold text-gray-800">血圧</span>
                <span className="text-sm font-semibold text-gray-500">
                  {healthRecord.bloodPressure?.systolic || healthRecord.bloodPressure?.diastolic
                    ? `${healthRecord.bloodPressure?.systolic || '-'}/${healthRecord.bloodPressure?.diastolic || '-'}`
                    : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('bloodPressure').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('bloodPressure').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 脈拍 */}
            <div id="tour-health-pulse">
              <button
                type="button"
                onClick={() => setActiveSection('pulse')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('pulse') ? 'border-red-400 ring-2 ring-red-100' : 'border-pink-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-4xl">💓</div>
                <span className="text-lg font-bold text-gray-800">脈拍</span>
                <span className="text-sm font-semibold text-gray-500">
                  {healthRecord.pulse ? `${healthRecord.pulse}回/分` : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('pulse').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('pulse').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 体重 */}
            <div id="tour-health-weight">
              <button
                type="button"
                onClick={() => setActiveSection('weight')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('weight') ? 'border-red-400 ring-2 ring-red-100' : 'border-yellow-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center text-4xl">⚖️</div>
                <span className="text-lg font-bold text-gray-800">体重</span>
                <span className="text-sm font-semibold text-gray-500">
                  {healthRecord.weight ? `${healthRecord.weight}kg` : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('weight').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('weight').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 運動内容 */}
            <div id="tour-health-exercise">
              <button
                type="button"
                onClick={() => setActiveSection('exercise')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('exercise') ? 'border-red-400 ring-2 ring-red-100' : 'border-green-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-4xl">🚴</div>
                <span className="text-lg font-bold text-gray-800">運動</span>
                <span className="text-sm font-semibold text-gray-500">
                  {healthRecord.exercise?.type || healthRecord.exercise?.duration
                    ? `${healthRecord.exercise?.type || ''}${healthRecord.exercise?.duration ? ` ${healthRecord.exercise.duration}分` : ''}`
                    : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('exercise').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('exercise').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 食事内容 */}
            <div id="tour-health-meal">
              <button
                type="button"
                onClick={() => setActiveSection('meal')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('meal') ? 'border-red-400 ring-2 ring-red-100' : 'border-red-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-4xl">🍽️</div>
                <span className="text-lg font-bold text-gray-800">食事</span>
                <span className="text-sm font-semibold text-gray-500">{hasMealInput ? '入力済み' : '未入力'}</span>
              </button>
              {getSectionErrorMessages('meal').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('meal').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 服薬確認 */}
            <div id="tour-health-medication">
              <button
                type="button"
                onClick={() => setActiveSection('medication')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-2 shadow-md hover:shadow-lg active:scale-95 transition flex flex-col items-center justify-center gap-2 ${
                  hasAnyErrorForSection('medication') ? 'border-red-400 ring-2 ring-red-100' : 'border-blue-300'
                }`}
              >
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-4xl">💊</div>
                <span className="text-lg font-bold text-gray-800">服薬</span>
                <span className="text-sm font-semibold text-gray-500">
                  {healthRecord.medicationTaken ? '飲みました' : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('medication').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('medication').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* 自覚症状やその他 */}
            <div className="col-span-3">
              <button
                type="button"
                onClick={() => setActiveSection('dailyLife')}
                className={`w-full bg-white border-4 rounded-2xl py-5 px-5 shadow-md hover:shadow-lg active:scale-95 transition flex items-center justify-between gap-3 ${
                  hasAnyErrorForSection('dailyLife') ? 'border-red-400 ring-2 ring-red-100' : 'border-purple-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-3xl flex-shrink-0">💭</div>
                  <span className="text-lg font-bold text-gray-800">自覚症状やその他</span>
                </div>
                <span className="text-sm font-semibold text-gray-500 flex-shrink-0">
                  {healthRecord.dailyLife ? '入力済み' : '未入力'}
                </span>
              </button>
              {getSectionErrorMessages('dailyLife').length > 0 && (
                <div className="mt-1 space-y-1">
                  {getSectionErrorMessages('dailyLife').map((m, i) => (
                    <p key={i} className="flex items-center gap-1.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                      <span className="flex-shrink-0">⚠️</span>{m}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 各セクションの編集モーダル */}
          {activeSection === 'bloodPressure' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl border-2 border-orange-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🩸 血圧
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  収縮期（上）
                </label>
                <input
                  type="number"
                  min={50}
                  max={250}
                  inputMode="numeric"
                  onKeyDown={blockInvalidKeysInt}
                  value={healthRecord?.bloodPressure?.systolic || ''}
                  onChange={(e) => {
                    setFormError(null);
                    const value = sanitizeInt(e.target.value, { maxDigits: 3, max: 250 });
                    clearFieldError('bloodPressure.systolic');
                      setHealthRecord({
                        ...healthRecord,
                      bloodPressure: { ...healthRecord?.bloodPressure, systolic: value },
                      });
                  }}
                  placeholder="50〜250"
                  className={`w-full px-4 py-3 text-xl border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                    fieldErrors['bloodPressure.systolic'] ? 'border-red-400 focus:border-red-500' : 'border-orange-300 focus:border-orange-500'
                  }`}
                      style={{ WebkitAppearance: 'textfield' }}
                />
                {fieldErrors['bloodPressure.systolic'] ? (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">{fieldErrors['bloodPressure.systolic']}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">50〜250 mmHg（整数）</p>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  拡張期（下）
                </label>
                <input
                  type="number"
                  min={20}
                  max={200}
                  inputMode="numeric"
                  onKeyDown={blockInvalidKeysInt}
                  value={healthRecord?.bloodPressure?.diastolic || ''}
                  onChange={(e) => {
                    setFormError(null);
                    const value = sanitizeInt(e.target.value, { maxDigits: 3, max: 200 });
                    clearFieldError('bloodPressure.diastolic');
                      setHealthRecord({
                        ...healthRecord,
                      bloodPressure: { ...healthRecord?.bloodPressure, diastolic: value },
                      });
                  }}
                  placeholder="20〜200"
                  className={`w-full px-4 py-3 text-xl border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                    fieldErrors['bloodPressure.diastolic'] ? 'border-red-400 focus:border-red-500' : 'border-orange-300 focus:border-orange-500'
                  }`}
                      style={{ WebkitAppearance: 'textfield' }}
                />
                {fieldErrors['bloodPressure.diastolic'] ? (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">{fieldErrors['bloodPressure.diastolic']}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">20〜200 mmHg（整数）</p>
                )}
              </div>
            </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-orange-500 text-white font-bold hover:bg-orange-600"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'pulse' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl border-2 border-pink-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💓 脈拍
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">脈拍数</label>
            <div className="flex items-end gap-4">
              <div className="flex-1">
              <input
                type="number"
                  min={20}
                  max={200}
                inputMode="numeric"
                  onKeyDown={blockInvalidKeysInt}
                value={healthRecord?.pulse || ''}
                onChange={(e) => {
                    setFormError(null);
                    const value = sanitizeInt(e.target.value, { maxDigits: 3, max: 200 });
                    clearFieldError('pulse');
                    setHealthRecord({ ...healthRecord, pulse: value });
                }}
                  placeholder="20〜200"
                  className={`w-full px-4 py-3 text-xl border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                    fieldErrors['pulse']
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-pink-300 focus:border-pink-500'
                  }`}
                  style={{ WebkitAppearance: 'textfield' }}
              />
                {fieldErrors['pulse'] ? (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">{fieldErrors['pulse']}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">20〜200 回/分（整数）</p>
                )}
              </div>
              <span className="text-xl text-gray-600 font-semibold whitespace-nowrap">回/分</span>
            </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-pink-500 text-white font-bold hover:bg-pink-600"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'weight' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl border-2 border-yellow-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    ⚖️ 体重
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
            <label className="block text-lg font-semibold text-gray-700 mb-3">
              体重
            </label>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  onKeyDown={blockInvalidKeys}
                  value={healthRecord?.weight || ''}
                  onChange={(e) => {
                    setFormError(null);
                    const value = sanitizeDecimal(e.target.value, { maxIntDigits: 3, maxDecimals: 2, max: 200 });
                    clearFieldError('weight');
                    setHealthRecord({ ...healthRecord, weight: value });
                  }}
                  onBlur={() => {
                    const v = String(healthRecord?.weight ?? '').trim();
                    if (!v) return;
                    // 0のみ（0 / 0. / 0.0...）は確定させない
                    if (v === '0.' || v === '0' || /^0\.0*$/.test(v) || v === '.') {
                      setFieldErrors((prev) => ({
                        ...prev,
                        weight: '体重は 0より大きい〜200 kg の範囲で入力してください',
                      }));
                      setHealthRecord({ ...healthRecord, weight: '' });
                    }
                  }}
                  placeholder="0.1〜200"
                  className={`w-full px-4 py-3 text-xl border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                    fieldErrors['weight'] ? 'border-red-400 focus:border-red-500' : 'border-yellow-300 focus:border-yellow-500'
                  }`}
                      style={{ WebkitAppearance: 'textfield' }}
                />
                {fieldErrors['weight'] ? (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">{fieldErrors['weight']}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">0より大きい〜200 kg（小数OK・最大2桁）</p>
                )}
              </div>
              <span className="text-xl text-gray-600 font-semibold">kg</span>
            </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-yellow-400 text-white font-bold hover:bg-yellow-500"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'exercise' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl border-2 border-green-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 mb-0 flex items-center gap-2">
                    🚴 運動内容
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
            <div className="space-y-4">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  運動の種類
                </label>
                <select
                  value={healthRecord?.exercise?.type || ''}
                      onChange={(e) =>
                        setHealthRecord({
                    ...healthRecord,
                    exercise: {
                      ...healthRecord?.exercise,
                      type: e.target.value
                    }
                        })
                      }
                  className="w-full px-4 py-3 text-lg border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500"
                >
                  <option value="">選択してください</option>
                  <option value="歩行">歩行</option>
                  <option value="ランニング">ランニング</option>
                  <option value="自転車">自転車</option>
                  <option value="筋トレ">筋トレ</option>
                  <option value="その他">その他</option>
                </select>
              </div>
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  運動時間
                </label>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      inputMode="numeric"
                      onKeyDown={blockInvalidKeysInt}
                      value={healthRecord?.exercise?.duration || ''}
                      onChange={(e) => {
                        setFormError(null);
                        const value = sanitizeInt(e.target.value, { maxDigits: 4, max: 1440 });
                        clearFieldError('exercise.duration');
                          setHealthRecord({
                            ...healthRecord,
                          exercise: { ...healthRecord?.exercise, duration: value },
                          });
                      }}
                      placeholder="1〜1440"
                      className={`w-full px-4 py-3 text-xl border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                        fieldErrors['exercise.duration']
                          ? 'border-red-400 focus:border-red-500'
                          : 'border-green-300 focus:border-green-500'
                      }`}
                          style={{ WebkitAppearance: 'textfield' }}
                    />
                    {fieldErrors['exercise.duration'] ? (
                      <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <span className="flex-shrink-0">⚠️</span>
                        <p className="text-sm font-semibold text-red-700">{fieldErrors['exercise.duration']}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-500">1〜1440 分（整数）</p>
                    )}
                  </div>
                  <span className="text-xl text-gray-600 font-semibold">分</span>
                </div>
              </div>
            </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-green-500 text-white font-bold hover:bg-green-600"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'meal' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-4xl border-2 border-red-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    🍽️ 食事内容
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                {/* 主食・主菜・副菜をスマホでも横並びにする */}
                <div className="grid grid-cols-3 gap-4 md:gap-6 mb-6">
              {/* 主食 */}
              <div>
                    <label className="block text-xl md:text-2xl font-semibold text-gray-700 mb-2 md:mb-4">
                      主食
                    </label>
                <div className="space-y-1 md:space-y-4">
                      {['ごはん', 'パン', 'めん', 'いも類'].map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 md:space-x-4 cursor-pointer"
                        >
                      <input
                        type="checkbox"
                            checked={convertStringToArray(healthRecord?.meal?.staple).includes(
                              item
                            )}
                        onChange={(e) => handleMealChange('staple', item, e.target.checked)}
                        className="w-4 h-4 md:w-7 md:h-7 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xl md:text-xl text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 主菜 */}
              <div>
                    <label className="block text-xl md:text-2xl font-semibold text-gray-700 mb-2 md:mb-4">
                      主菜
                    </label>
                <div className="space-y-1 md:space-y-4">
                      {['魚', '肉', '卵'].map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 md:space-x-4 cursor-pointer"
                        >
                      <input
                        type="checkbox"
                            checked={convertStringToArray(healthRecord?.meal?.mainDish).includes(
                              item
                            )}
                        onChange={(e) => handleMealChange('mainDish', item, e.target.checked)}
                        className="w-4 h-4 md:w-7 md:h-7 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xl md:text-xl text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 副菜 */}
              <div>
                    <label className="block text-xl md:text-2xl font-semibold text-gray-700 mb-2 md:mb-4">
                      副菜
                    </label>
                <div className="space-y-1 md:space-y-4">
                      {['野菜', '海藻', 'きのこ', '汁物', '漬物'].map((item) => (
                        <label
                          key={item}
                          className="flex items-center space-x-2 md:space-x-4 cursor-pointer"
                        >
                      <input
                        type="checkbox"
                            checked={convertStringToArray(healthRecord?.meal?.sideDish).includes(
                              item
                            )}
                        onChange={(e) => handleMealChange('sideDish', item, e.target.checked)}
                        className="w-4 h-4 md:w-7 md:h-7 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-xl md:text-xl text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* その他 */}
            <div>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="block text-lg font-semibold text-gray-700">
                      その他
                    </label>
                    <button
                      onClick={() => setShowMealGuide(true)}
                      className="inline-flex items-center justify-center w-6 h-6 bg-blue-500 text-white rounded-full font-bold text-sm hover:bg-blue-600 cursor-help click-press"
                      title="食事の栄養情報例を見る"
                    >
                      ?
                    </button>
                  </div>
              <input
                type="text"
                value={healthRecord?.meal?.other || ''}
                maxLength={200}
                onChange={(e) => {
                  setFormError(null);
                  const next = String(e.target.value || '').slice(0, 200);
                  if (next.length >= 0) {
                    clearFieldError('meal.other');
                  }
                  setHealthRecord({
                  ...healthRecord,
                  meal: {
                    ...healthRecord.meal,
                      other: next,
                    },
                  });
                }}
                placeholder="果物、乳製品など"
                className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none placeholder:text-gray-400 ${
                  fieldErrors['meal.other'] ? 'border-red-400 focus:border-red-500' : 'border-red-300 focus:border-red-500'
                }`}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                {fieldErrors['meal.other'] ? (
                  <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <span className="flex-shrink-0">⚠️</span>
                    <p className="text-sm font-semibold text-red-700">{fieldErrors['meal.other']}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">最大 200 文字</p>
                )}
                <p className="text-xs text-gray-500">
                  {String(healthRecord?.meal?.other || '').length}/200
                </p>
            </div>
          </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-red-400 text-white font-bold hover:bg-red-500"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'medication' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-2xl border-2 border-blue-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💊 服薬確認
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <div className="mb-3 text-lg font-semibold text-gray-700">飲みました</div>
                <div className="flex items-center justify-between gap-3">
                  {([
                    { key: 'morning', label: '朝' },
                    { key: 'noon', label: '昼' },
                    { key: 'night', label: '夜' },
                  ] satisfies Array<{ key: keyof HealthRecord['medicationTimes']; label: string }>).map((t) => {
                    const checked = healthRecord.medicationTimes?.[t.key] || false;
                    return (
                      <label
                        key={t.key}
                        className="flex-1 flex items-center justify-center gap-3 cursor-pointer p-4 border-2 border-blue-300 rounded-xl hover:bg-blue-50"
                      >
              <input
                type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextTimes = {
                              ...healthRecord.medicationTimes,
                              [t.key]: e.target.checked,
                            };
                            const anyTaken = !!(nextTimes.morning || nextTimes.noon || nextTimes.night);
                            setHealthRecord({
                              ...healthRecord,
                              medicationTimes: nextTimes,
                              medicationTaken: anyTaken,
                            });
                          }}
                className="w-6 h-6 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
                        <span className="text-xl text-gray-700 font-bold">{t.label}</span>
            </label>
                    );
                  })}
          </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-blue-500 text-white font-bold hover:bg-blue-600"
                  >
                    閉じる
                  </button>
          </div>
              </div>
            </div>
          )}

          {activeSection === 'dailyLife' && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
              onClick={() => setActiveSection(null)}
            >
              <div
                className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-3xl border-2 border-purple-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    💭 自覚症状やその他
                  </h3>
                  <button
                    onClick={() => setActiveSection(null)}
                    className="text-2xl text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 自覚症状チェックボックス */}
                <div className="mb-6">
            <label className="block text-lg font-semibold text-gray-700 mb-3">
                    自覚症状をチェック
            </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['浮腫', '動悸', '息切れ'].map((symptom) => {
                      // 【症状】セクションから症状を抽出
                      const symptomsMatch = (healthRecord?.dailyLife || '').match(/【症状】([^【]*)/);
                      const symptomsStr = symptomsMatch ? symptomsMatch[1].trim() : '';
                      const isChecked = symptomsStr.includes(symptom);
                      
                      return (
                        <label key={symptom} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setFormError(null);
                              clearFieldError('dailyLife');
                              const current = healthRecord?.dailyLife || '';
                              
                              // 【症状】と【メモ】を分離
                              const symptomsMatch = current.match(/【症状】([^【]*)/);
                              const memoMatch = current.match(/【メモ】(.*)/);
                              
                              let symptomsStr = symptomsMatch ? symptomsMatch[1].trim() : '';
                              const memoStr = memoMatch ? memoMatch[1].trim() : '';
                              
                              // 症状を追加・削除
                              if (e.target.checked) {
                                if (!symptomsStr.includes(symptom)) {
                                  symptomsStr = symptomsStr ? `${symptomsStr}、${symptom}` : symptom;
                                }
                              } else {
                                symptomsStr = symptomsStr.replace(`、${symptom}`, '').replace(symptom, '').replace(/^、/, '');
                              }
                              
                              // 【症状】【メモ】形式で再構成
                              let updated = `【症状】${symptomsStr}`;
                              if (memoStr) {
                                updated += ` 【メモ】${memoStr}`;
                              }
                              
                              // 【症状】が空の場合は【メモ】だけ
                              if (!symptomsStr && memoStr) {
                                updated = `【メモ】${memoStr}`;
                              }
                              const trimmed = updated.trim();
                              if (trimmed.length > 400) {
                                setFieldErrors((prev) => ({
                                  ...prev,
                                  dailyLife: '自覚症状やその他は 400 文字以内で入力してください',
                                }));
                                return;
                              }
                              setHealthRecord({ ...healthRecord, dailyLife: trimmed });
                            }}
                            className="w-5 h-5 text-purple-500 rounded focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-lg font-medium text-gray-700">{symptom}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 自由記載 */}
                <div>
                  <label className="block text-lg font-semibold text-gray-700 mb-3">
                    その他の気になったことや体調の変化
                  </label>
                  <textarea
                    value={(() => {
                      // 【メモ】セクションのみを抽出して表示
                      const memoMatch = (healthRecord?.dailyLife || '').match(/【メモ】(.*)/);
                      return memoMatch ? memoMatch[1].trim() : '';
                    })()}
                    onChange={(e) => {
                      setFormError(null);
                      clearFieldError('dailyLife');
                      const current = healthRecord?.dailyLife || '';
                      
                      // 【症状】セクションを保持
                      const symptomsMatch = current.match(/【症状】([^【]*)/);
                      const symptomsStr = symptomsMatch ? symptomsMatch[1].trim() : '';
                      
                      // 新しいテキストを【メモ】として追加
                      const memoInput = String(e.target.value || '');
                      let updated = '';
                      if (symptomsStr) {
                        updated = `【症状】${symptomsStr}`;
                        if (memoInput.trim()) {
                          // 400文字制限に収まるようにメモ部分をトリム
                          const prefix = `${updated} 【メモ】`;
                          const remain = Math.max(0, 400 - prefix.length);
                          const clipped = memoInput.slice(0, remain);
                          updated = `${updated} 【メモ】${clipped}`;
                        }
                      } else {
                        if (memoInput.trim()) {
                          const prefix = `【メモ】`;
                          const remain = Math.max(0, 400 - prefix.length);
                          const clipped = memoInput.slice(0, remain);
                          updated = `【メモ】${clipped}`;
                        }
                      }
                      const trimmed = updated.trim();
                      if (trimmed.length > 400) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          dailyLife: '自覚症状やその他は 400 文字以内で入力してください',
                        }));
                        return;
                      }
                      setHealthRecord({ ...healthRecord, dailyLife: trimmed });
                    }}
              placeholder="400 文字以内で入力してください"
              rows={6}
              className={`w-full px-4 py-3 text-lg border-2 rounded-lg focus:outline-none resize-none ${
                fieldErrors['dailyLife'] ? 'border-red-400 focus:border-red-500' : 'border-purple-300 focus:border-purple-500'
              }`}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              {fieldErrors['dailyLife'] ? (
                <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <p className="text-sm font-semibold text-red-700">{fieldErrors['dailyLife']}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">最大 400 文字</p>
              )}
              <p className="text-xs text-gray-500">
                {String(healthRecord?.dailyLife || '').length}/400
              </p>
            </div>
          </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setActiveSection(null)}
                    className="px-6 py-2 rounded-lg bg-purple-500 text-white font-bold hover:bg-purple-600"
                  >
                    閉じる
                  </button>
                </div>
              </div>
            </div>
          )}
            
            {/* ボタンテキストを生成する関数 */}
            {(() => {
              const getButtonText = () => {
                if (!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse) {
                  return '健康記録を入力してください';
                }
                
                if (selectedDateTime) {
                  const dateTime = new Date(selectedDateTime);
                  const timeKey = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;
                  return `${timeKey}の健康記録を保存`;
                }
                
                return '健康記録を保存';
              };
              
              return null; // JSX内で関数を定義するため
            })()}
              
            {/* 保存ボタン */}
          <div id="tour-health-save" className="mt-8 mb-6 flex justify-center">
            <button 
              onClick={handleSaveHealthRecord}
              disabled={!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse || saveStatus === 'saving'}
              className={`w-full md:w-2/3 text-white py-4 px-8 rounded-2xl font-bold text-2xl transition-all ${
                (!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : saveStatus === 'saved'
                  ? 'save-saved'
                  : saveStatus === 'saving'
                  ? 'save-saving'
                  : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 shadow-lg'
              }`}
            >
              {(() => {
                if (saveStatus === 'saving') {
                  return '保存中...';
                }
                
                if (saveStatus === 'saved') {
                  return '保存済';
                }
                
                  if (!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse) {
                    return '健康記録を入力してください';
                  }
                  
                  if (selectedDateTime) {
                    const dateTime = new Date(selectedDateTime);
                    const timeKey = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;
                    return `${timeKey}の健康記録を保存`;
                  }
                  
                  return '健康記録を保存';
              })()}
            </button>
          </div>

        </section>

      </main>

      {/* スマホ版フッター：日時変更フォーム */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t-2 border-orange-300 shadow-lg z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700">📅 記録日時を変更</span>
          </div>
          <div className="relative">
            <input
              type="datetime-local"
              value={selectedDateTime}
              onChange={(e) => setSelectedDateTime(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold appearance-none bg-white cursor-pointer"
              style={{
                fontSize: '16px',
                paddingRight: '45px'
              }}
            />
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl pointer-events-none text-gray-600">
              📅
            </span>
          </div>
        </div>
      </div>

      {/* メインコンテンツの下部パディング（フッター対応） */}
      <div className="md:hidden h-28"></div>

      {/* 心臓リハビリ説明モーダル */}
      {showHeartRehabInfo && (
        <div 
          className="fixed inset-0 flex items-start justify-center z-50 bg-transparent pt-4 md:pt-0 md:items-center overflow-y-auto"
          onClick={() => setShowHeartRehabInfo(false)}
        >
          <div 
            className="bg-white rounded-lg p-3 md:p-4 max-w-sm md:max-w-lg w-full mx-2 md:mx-4 shadow-2xl mb-4 md:mb-0 max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-4rem)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg md:text-xl font-bold text-orange-800 flex items-center gap-2">
                💖 心臓リハビリとは
              </h2>
              <button
                onClick={() => setShowHeartRehabInfo(false)}
                className="text-gray-500 hover:text-gray-700 text-4xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2 md:space-y-3 text-gray-700">
              <div className="bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 p-2 md:p-3 rounded-lg">
                <h3 className="text-base font-semibold text-orange-800 mb-1">
                  🏥 心臓リハビリテーションとは
                </h3>
                <p className="text-xs md:text-sm leading-relaxed">
                  心臓病の患者さんが安全で効果的な運動療法、教育、心理的サポートを通じて、身体的・心理的・社会的な機能を改善し、生活の質を向上させることを目的とした包括的なプログラムです。
                </p>
              </div>

              <div className="bg-blue-50 p-2 md:p-3 rounded-lg">
                <h3 className="text-sm md:text-base font-semibold text-blue-800 mb-1">
                  🎯 主な目的
                </h3>
                <ul className="text-xs md:text-sm leading-relaxed">
                  <li>• 心臓機能の改善と維持</li>
                  <li>• 再発予防と合併症の減少</li>
                  <li>• 運動耐容能の向上</li>
                  <li>• 不安やうつ症状の軽減</li>
                  <li>• 社会復帰と生活の質の向上</li>
                </ul>
              </div>

              <div className="bg-green-50 p-2 md:p-3 rounded-lg">
                <h3 className="text-sm md:text-base font-semibold text-green-800 mb-1">
                  🏃‍♂️ 運動療法の種類
                </h3>
                <ul className="text-xs md:text-sm leading-relaxed">
                  <li>• 有酸素運動（ウォーキング、自転車、水泳など）</li>
                  <li>• 筋力トレーニング</li>
                  <li>• ストレッチング</li>
                  <li>• バランス運動</li>
                </ul>
              </div>

              <div className="bg-purple-50 p-2 md:p-3 rounded-lg">
                <h3 className="text-sm md:text-base font-semibold text-purple-800 mb-1">
                  📊 記録の重要性
                </h3>
                <p className="text-xs md:text-sm leading-relaxed">
                  血圧、脈拍、体重などの健康データを継続的に記録することで、体調の変化を把握し、医師との相談材料として活用できます。
                </p>
              </div>

              <div className="bg-yellow-50 p-2 md:p-3 rounded-lg">
                <h3 className="text-sm md:text-base font-semibold text-yellow-800 mb-1">
                  💡 このアプリの活用方法
                </h3>
                <ul className="text-xs md:text-sm leading-relaxed">
                  <li>• 毎日の健康データを記録</li>
                  <li>• グラフで推移を確認</li>
                  <li>• 家族と情報を共有</li>
                  <li>• 同じ経験を持つ仲間と交流</li>
                </ul>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs md:text-sm leading-relaxed">
                  💖 心臓ちゃんと一緒に、健康的な生活を送りましょう！
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF印刷用サマリーセクション（print-onlyで表示） */}
      <style>{`
        @media print {
          main,
          header,
          footer,
          nav,
          [class*="sticky"],
          [class*="fixed"] {
            display: none !important;
          }
          .print-summary {
            display: block !important;
            page-break-after: always;
          }
          body {
            background: white;
          }
        }
      `}</style>
      
      <div className="print-summary hidden print:block bg-white p-8">
        {/* タイトル */}
        <h1 className="text-2xl font-bold text-center mb-2">心臓リハビリ手帳</h1>
        <p className="text-center text-gray-600 mb-1">健康記録サマリー（{printMonth.replace('-', '年')}月）</p>
        <p className="text-center text-sm text-gray-500 mb-4">作成日: {printCreatedDate}</p>

        {/* 月次サマリー */}
        <h2 className="text-xl font-bold text-red-600 mb-3">【{printMonth.replace('-', '年')}月　月次まとめ】</h2>
        <div className="border-2 border-red-400 rounded p-4 mb-8 bg-red-50">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">平均血圧</p>
              <p className="text-xl font-bold text-red-700">
                {printMonthAverages.systolic ?? '-'}/{printMonthAverages.diastolic ?? '-'}
              </p>
              <p className="text-xs text-gray-500">mmHg</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">平均脈拍</p>
              <p className="text-xl font-bold text-pink-700">
                {printMonthAverages.pulse ?? '-'}
              </p>
              <p className="text-xs text-gray-500">回/分</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">平均体重</p>
              <p className="text-xl font-bold text-yellow-700">
                {printMonthAverages.weight ?? '-'}
              </p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">運動した日</p>
              <p className="text-xl font-bold text-green-700">{printMonthAverages.exerciseDays}</p>
              <p className="text-xs text-gray-500">日 / {printMonthAverages.totalDays}日</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">服薬した日</p>
              <p className="text-xl font-bold text-blue-700">{printMonthAverages.medicationDays}</p>
              <p className="text-xs text-gray-500">日 / {printMonthAverages.totalDays}日</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-gray-600 mb-1">記録日数</p>
              <p className="text-xl font-bold text-gray-700">{printMonthAverages.totalDays}</p>
              <p className="text-xs text-gray-500">日</p>
            </div>
          </div>
        </div>

        {(() => {
          const p = printProfile;

          const diseases = Array.isArray(p.diseases) ? p.diseases : [];
          const riskFactors = Array.isArray(p.riskFactors) ? p.riskFactors : [];

          const str = (v: unknown, fallback = '未設定') =>
            v != null && v !== '' ? String(v) : fallback;

          return (
            <>
              {/* 基本情報（画像の項目） */}
              <h2 className="text-xl font-bold text-red-600 mb-4">【基本情報】</h2>
              <div className="grid grid-cols-2 gap-4 mb-8 border border-gray-400 p-4">
                <div>
                  <p className="font-semibold">お名前: {str(p.displayName)}</p>
                </div>
                <div>
                  <p className="font-semibold">年齢: {str(p.age)}歳</p>
                </div>
                <div>
                  <p className="font-semibold">性別: {str(p.gender)}</p>
                </div>
                <div>
                  <p className="font-semibold">身長: {str(p.height)}cm</p>
                </div>
                <div>
                  <p className="font-semibold">目標体重: {str(p.targetWeight)}kg</p>
                </div>
                <div>
                  <p className="font-semibold">メール: {str(p.email)}</p>
                </div>
              </div>

              {/* 医療情報（画像の項目） */}
              <h2 className="text-xl font-bold text-red-600 mb-4">【医療情報】</h2>
              <div className="border border-gray-400 p-4 mb-8">
                <div className="mb-4">
                  <p className="font-semibold mb-2">基礎疾患:</p>
                  <p className="ml-4">{diseases.length > 0 ? diseases.map(String).join('、') : '未設定'}</p>
                </div>
                <div className="mb-4">
                  <p className="font-semibold mb-2">他の動脈硬化危険因子:</p>
                  <p className="ml-4">{riskFactors.length > 0 ? riskFactors.map(String).join('、') : '未設定'}</p>
                </div>
                <div className="mb-4">
                  <p className="font-semibold mb-2">服薬情報:</p>
                  <p className="ml-4">{str(p.medications)}</p>
                </div>
                <div>
                  <p className="font-semibold mb-2">身体機能・制限事項:</p>
                  <p className="ml-4">{str(p.physicalFunction)}</p>
                </div>
              </div>

              {/* 緊急連絡先（画像の項目） */}
              <h2 className="text-xl font-bold text-red-600 mb-4">【緊急連絡先】</h2>
              <div className="border border-gray-400 p-4 mb-8">
                <p className="font-semibold">{str(p.emergencyContact)}</p>
              </div>
            </>
          );
        })()}

        {/* 血液検査データ / 運動負荷試験（CPX）データ（PDFに掲載） */}
        {(() => {
          const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v));
          const hasAnyBloodValue = (b: PrintBloodData) =>
            b.hbA1c != null ||
            b.randomBloodSugar != null ||
            b.totalCholesterol != null ||
            b.triglycerides != null ||
            b.hdlCholesterol != null ||
            b.ldlCholesterol != null ||
            b.bun != null ||
            b.creatinine != null ||
            b.uricAcid != null ||
            b.hemoglobin != null ||
            b.bnp != null;

          const bloodOnly = printBloodDataList.filter(hasAnyBloodValue);
          const cpxFlat = printBloodDataList.flatMap((b) =>
            (b.cpxTests || []).map((c) => ({ c, parentDate: b.testDate }))
          );

          return (
            <>
              <h2 className="text-xl font-bold text-red-600 mb-4">【血液検査データ】</h2>
              {printBloodDataStatus === 'loading' && (
                <div className="border border-gray-400 p-4 mb-8 text-sm">読み込み中...</div>
              )}
              {printBloodDataStatus !== 'loading' && bloodOnly.length === 0 && (
                <div className="border border-gray-400 p-4 mb-8 text-sm">未登録</div>
              )}
              {printBloodDataStatus !== 'loading' &&
                bloodOnly.length > 0 &&
                bloodOnly.map((b) => (
                  <div key={b.id} className="border border-gray-400 p-4 mb-4 text-sm">
                    <p className="font-semibold mb-2">検査日: {b.testDate}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <p>HbA1c: {fmt(b.hbA1c)}%</p>
                      <p>随時血糖: {fmt(b.randomBloodSugar)} mg/dL</p>
                      <p>総コレステロール: {fmt(b.totalCholesterol)} mg/dL</p>
                      <p>中性脂肪: {fmt(b.triglycerides)} mg/dL</p>
                      <p>HDL: {fmt(b.hdlCholesterol)} mg/dL</p>
                      <p>LDL: {fmt(b.ldlCholesterol)} mg/dL</p>
                      <p>BUN: {fmt(b.bun)} mg/dL</p>
                      <p>Cr: {fmt(b.creatinine)} mg/dL</p>
                      <p>尿酸: {fmt(b.uricAcid)} mg/dL</p>
                      <p>Hb: {fmt(b.hemoglobin)}</p>
                      <p>BNP: {fmt(b.bnp)} pg/mL</p>
                    </div>
                  </div>
                ))}

              <h2 className="text-xl font-bold text-red-600 mb-4">【運動負荷試験（CPX）データ】</h2>
              {printBloodDataStatus === 'loading' && (
                <div className="border border-gray-400 p-4 mb-8 text-sm">読み込み中...</div>
              )}
              {printBloodDataStatus !== 'loading' && cpxFlat.length === 0 && (
                <div className="border border-gray-400 p-4 mb-8 text-sm">未登録</div>
              )}
              {printBloodDataStatus !== 'loading' &&
                cpxFlat.length > 0 &&
                cpxFlat.map(({ c, parentDate }) => (
                  <div key={c.id} className="border border-gray-400 p-4 mb-4 text-sm">
                    <p className="font-semibold mb-2">
                      検査日: {c.testDate || parentDate} / CPX #{fmt(c.cpxRound)}
                    </p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <p>負荷: {fmt(c.loadWeight)} W</p>
                      <p>VO2: {fmt(c.vo2)}</p>
                      <p>Mets: {fmt(c.mets)}</p>
                      <p>心拍: {fmt(c.heartRate)} bpm</p>
                      <p>収縮期血圧: {fmt(c.systolicBloodPressure)} mmHg</p>
                      <p>最大負荷: {fmt(c.maxLoad)}</p>
                      <p>AT1分前: {fmt(c.atOneMinBefore)}</p>
                      <p>AT中: {fmt(c.atDuring)}</p>
                    </div>
                    {c.findings && (
                      <p className="mt-2 text-xs">
                        <span className="font-semibold">所見:</span> {c.findings}
                      </p>
                    )}
                  </div>
                ))}
            </>
          );
        })()}

        {/* 健康記録テーブル */}
        <h2 className="text-xl font-bold text-red-600 mb-4">【日別記録】</h2>
        <table className="w-full border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-400 p-2">日付</th>
              <th className="border border-gray-400 p-2">時間</th>
              <th className="border border-gray-400 p-2">血圧(上/下)</th>
              <th className="border border-gray-400 p-2">脈拍</th>
              <th className="border border-gray-400 p-2">体重</th>
              <th className="border border-gray-400 p-2">運動</th>
              <th className="border border-gray-400 p-2">服薬</th>
              <th className="border border-gray-400 p-2">自覚症状</th>
            </tr>
          </thead>
          <tbody>
            {printTableRows}
          </tbody>
        </table>
      </div>

      {/* 食事ガイドモーダル */}
      {showMealGuide && (
        <div
          className="fixed inset-0 bg-transparent z-50 flex items-center justify-center p-4"
          onClick={() => setShowMealGuide(false)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="sticky top-0 bg-white border-b-2 border-orange-300 p-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-orange-800">🍽️ 外食の栄養情報</h2>
              <button
                onClick={() => setShowMealGuide(false)}
                className="text-3xl text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-4 md:p-6">
              <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-3 mb-6">
                <p className="text-sm font-semibold text-orange-800 mb-2">外食の特徴をつかもう！</p>
                <ul className="text-sm text-orange-900 space-y-1">
                  <li>• 主食（ごはんや麺など）が多い</li>
                  <li>• 肉や魚、あぶらの使用が多く、野菜類が少ない</li>
                  <li>• 味付けが濃く、塩分や砂糖が多い</li>
                  <li>• 一般的にエネルギーが高い</li>
                </ul>
              </div>

              {/* グリッドで食事例を表示 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MEAL_GUIDE.map((meal, idx) => (
                  <div key={idx} className="border-2 border-gray-300 rounded-lg p-4">
                    <h3 className="font-bold text-lg text-gray-800 mb-2">{meal.name}</h3>
                    <div className="space-y-1 text-sm">
                      <p className="text-orange-600 font-semibold">1食分 : <span className="text-lg">{meal.calories}</span></p>
                      <p className="text-gray-700">炭水化物 : {meal.carbs}</p>
                      <p className="text-gray-700">タンパク質 : {meal.protein}</p>
                      <p className="text-gray-700">塩分 : {meal.salt}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-3 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <p className="text-xs text-blue-800">
                  ※ここに示すものは、あくまでも目安です。味付けや材料によって異なります。目安として参考下さい。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
