"use client";
import { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
      console.log('💾 PDF出力開始');
  
      // 印刷用のHTMLを作成
      const printContent = document.createElement('div');
      printContent.style.width = '794px'; // A4幅
      printContent.style.padding = '20px';
      printContent.style.fontFamily = 'Arial, sans-serif';
      printContent.style.fontSize = '12px';
      printContent.style.lineHeight = '1.4';
      
      // 🆕 データベースから健康記録を取得
      let saved: SavedRecords = {};
      let profile: ProfilePrintable = {};
      let liffDisplayName = '';
      let bloodDataList: BloodDataItem[] = [];
      
      try {
        // ユーザーIDを取得（メール/セッションログイン → LIFF → デフォルト の優先順）
        let userId = 'user-1'; // デフォルト
  
        if (typeof window !== 'undefined') {
          const storedId = localStorage.getItem('userId');
          const storedName = localStorage.getItem('userName') || '';
          if (storedId) {
            userId = storedId;
            liffDisplayName = storedName;
            console.log('✅ NavigationBar: localStorage の userId を使用:', userId);
          } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // 本番環境のみ LIFF からuserId取得
          try {
              if (window.liff && window.liff.isLoggedIn && window.liff.isLoggedIn()) {
              const liffProfile = await window.liff.getProfile();
              userId = liffProfile.userId;
              liffDisplayName = liffProfile.displayName;
              console.log('✅ LIFFユーザーIDを取得:', userId);
            }
          } catch (error) {
            console.log('⚠️ LIFFユーザーID取得エラー、デフォルトを使用:', error);
            userId = 'user-1';
          }
        } else {
          console.log('🏠 ローカル環境: デフォルトユーザーIDを使用');
          }
        }
  
        console.log('💾 NavigationBar: データベースからデータ取得を試行中', { userId });
        
        // 🆕 データベースから健康記録を取得（エラーハンドリング強化）
        try {
          const healthResponse = await apiFetch(`/api/health-records?userId=${userId}`);
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('✅ 健康記録をデータベースから取得');
            
            // データベースの形式をPDF用に変換
            const records = isRecord(healthData) && Array.isArray(healthData.records) ? healthData.records : [];
            records.forEach((record: HealthRecordApi) => {
              const dateKey = record.date.split('T')[0];
              const timeKey = record.time;
              
              if (!saved[dateKey]) {
                saved[dateKey] = {};
              }
              
              saved[dateKey][timeKey] = {
                bloodPressure: {
                  systolic: record.bloodPressure.systolic.toString(),
                  diastolic: record.bloodPressure.diastolic.toString()
                },
                pulse: record.pulse?.toString() || '',
                weight: record.weight?.toString() || '',
                exercise: record.exercise || { type: '', duration: '' },
                meal: record.meal || {
                  staple: '',
                  mainDish: '',
                  sideDish: '',
                  other: ''
                },
                dailyLife: record.dailyLife || ''
              };
            });
          } else {
            console.log('❌ 健康記録取得失敗（ステータス:', healthResponse.status, '）、localStorageを使用');
            saved = parseSavedRecords(JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}'));
          }
        } catch (healthError) {
          console.log('❌ 健康記録取得エラー:', healthError, '、localStorageを使用');
          saved = parseSavedRecords(JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}'));
        }
        
        // 🆕 データベースからプロフィールを取得（エラーハンドリング強化）
        try {
          const profileResponse = await apiFetch(`/api/profiles?userId=${userId}`);
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            const profileValue = isRecord(profileData) ? profileData.profile : undefined;
            if (profileValue && isProfilePrintable(profileValue)) {
              console.log('✅ プロフィールをデータベースから取得');
              profile = {
                displayName: liffDisplayName || profileValue.displayName,
                age: profileValue.age,
                gender: profileValue.gender,
                targetWeight: profileValue.targetWeight,
                diseases: profileValue.diseases,
                medications: profileValue.medications,
                physicalFunction: profileValue.physicalFunction,
                emergencyContact: profileValue.emergencyContact
              };
            } else {
              console.log('❌ プロフィールなし、localStorageを使用');
              profile = parseProfile(JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}'));
              if (liffDisplayName && !profile.displayName) {
                profile.displayName = liffDisplayName; // ✅ LINE名をセット
              }
            }
          } else {
            console.log('❌ プロフィール取得失敗（ステータス:', profileResponse.status, '）、localStorageを使用');
            profile = parseProfile(JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}'));
            if (liffDisplayName && !profile.displayName) {
              profile.displayName = liffDisplayName; // ✅ LINE名をセット
            }
          }
        } catch (profileError) {
          console.log('❌ プロフィール取得エラー:', profileError, '、localStorageを使用');
          profile = parseProfile(JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}'));
          if (liffDisplayName && !profile.displayName) {
            profile.displayName = liffDisplayName; // ✅ LINE名をセット
          }
        }

        // 🆕 血液検査/CPX を取得（エラーハンドリング強化）
        try {
          const bloodRes = await apiFetch(`/api/blood-data?userId=${encodeURIComponent(userId)}`);
          if (bloodRes.ok) {
            const data = await bloodRes.json();
            bloodDataList = parseBloodDataList(data);
            console.log('✅ 血液検査/CPX をデータベースから取得:', bloodDataList.length);
          } else {
            console.log('❌ 血液検査/CPX 取得失敗（ステータス:', bloodRes.status, '）');
            bloodDataList = [];
          }
        } catch (bloodError) {
          console.log('❌ 血液検査/CPX 取得エラー:', bloodError);
          bloodDataList = [];
        }
      } catch (error) {
        console.error('データベースからの取得エラー、localStorageを使用:', error);
        saved = parseSavedRecords(JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}'));
        profile = parseProfile(JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}'));
        bloodDataList = [];
      }

      const hasValue = (v: unknown) => !(v === null || v === undefined || v === '');
      const fmt = (v: unknown) => (hasValue(v) ? String(v) : '');
      const hasAnyBloodValue = (b: BloodDataItem) =>
        b?.hbA1c != null ||
        b?.randomBloodSugar != null ||
        b?.totalCholesterol != null ||
        b?.triglycerides != null ||
        b?.hdlCholesterol != null ||
        b?.ldlCholesterol != null ||
        b?.bun != null ||
        b?.creatinine != null ||
        b?.uricAcid != null ||
        b?.hemoglobin != null ||
        b?.bnp != null;

      const bloodOnly = (bloodDataList || []).filter(hasAnyBloodValue);
      const cpxFlat = (bloodDataList || []).flatMap((b: BloodDataItem) =>
        (b?.cpxTests || []).map((c: CpxTestItem) => ({ c, parentDate: b.testDate }))
      );

      const buildFieldGrid = (pairs: Array<{ label: string; value: unknown; suffix?: string }>) => {
        const items = pairs
          .filter((p) => hasValue(p.value) && String(p.value).trim() !== '')
          .map((p) => `<div>${p.label}: ${fmt(p.value)}${p.suffix ?? ''}</div>`)
          .join('');
        return items
          ? `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 11px;">${items}</div>`
          : `<div style="font-size: 11px;">（記載なし）</div>`;
      };

      const bloodHtml =
        bloodOnly.length === 0
          ? `<div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 16px;">未登録</div>`
          : bloodOnly
              .map(
                (b: BloodDataItem) => `
                  <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 12px;">
                    <div style="font-weight: bold; margin-bottom: 6px;">検査日: ${fmt(b.testDate)}</div>
                    ${buildFieldGrid([
                      { label: 'HbA1c', value: b.hbA1c, suffix: '%' },
                      { label: '随時血糖', value: b.randomBloodSugar, suffix: ' mg/dL' },
                      { label: '総コレステロール', value: b.totalCholesterol, suffix: ' mg/dL' },
                      { label: '中性脂肪', value: b.triglycerides, suffix: ' mg/dL' },
                      { label: 'HDL', value: b.hdlCholesterol, suffix: ' mg/dL' },
                      { label: 'LDL', value: b.ldlCholesterol, suffix: ' mg/dL' },
                      { label: 'BUN', value: b.bun, suffix: ' mg/dL' },
                      { label: 'Cr', value: b.creatinine, suffix: ' mg/dL' },
                      { label: '尿酸', value: b.uricAcid, suffix: ' mg/dL' },
                      { label: 'Hb', value: b.hemoglobin },
                      { label: 'BNP', value: b.bnp, suffix: ' pg/mL' },
                    ])}
                  </div>
                `
              )
              .join('');

      const cpxHtml =
        cpxFlat.length === 0
          ? `<div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 16px;">未登録</div>`
          : cpxFlat
              .map(
                ({ c, parentDate }: { c: CpxTestItem; parentDate?: BloodDataItem['testDate'] }) => `
                  <div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 12px;">
                    <div style="font-weight: bold; margin-bottom: 6px;">
                      検査日: ${fmt(c?.testDate || parentDate)} / CPX #${fmt(c?.cpxRound)}
                    </div>
                    ${buildFieldGrid([
                      { label: '負荷', value: c?.loadWeight, suffix: ' W' },
                      { label: 'VO2', value: c?.vo2 },
                      { label: 'Mets', value: c?.mets },
                      { label: '心拍', value: c?.heartRate, suffix: ' bpm' },
                      { label: '収縮期血圧', value: c?.systolicBloodPressure, suffix: ' mmHg' },
                      { label: '最大負荷', value: c?.maxLoad },
                      { label: 'AT1分前', value: c?.atOneMinBefore },
                      { label: 'AT中', value: c?.atDuring },
                    ])}
                    ${hasValue(c?.findings) && String(c.findings).trim() !== '' ? `<div style="margin-top: 6px; font-size: 11px;"><strong>所見:</strong> ${c.findings}</div>` : ''}
                  </div>
                `
              )
              .join('');
    
      // ヘッダー情報
      printContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #c2410c; font-size: 24px; margin: 0;">心臓リハビリ手帳</h1>
          <p style="margin: 5px 0; color: #666;">健康記録サマリー</p>
          <p style="margin: 0; color: #666;">作成日: ${new Date().toLocaleString('ja-JP')}</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 10px 0;">患者情報</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>お名前:</strong> ${profile.displayName || '未設定'}</div>
            <div><strong>年齢:</strong> ${profile.age || '未設定'}歳</div>
            <div><strong>性別:</strong> ${profile.gender || '未設定'}</div>
            <div><strong>目標体重:</strong> ${profile.targetWeight || '未設定'}kg</div>
          </div>
          ${profile.diseases?.length > 0 ? `<div><strong>基礎疾患:</strong> ${profile.diseases.join('、')}</div>` : ''}
          ${profile.medications ? `<div><strong>服用薬:</strong> ${profile.medications}</div>` : ''}
          ${profile.physicalFunction ? `<div><strong>身体機能・制限事項:</strong> ${profile.physicalFunction}</div>` : ''}
          ${profile.emergencyContact ? `<div><strong>緊急連絡先:</strong> ${profile.emergencyContact}</div>` : ''}
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 10px 0;">血液検査データ</h2>
          ${bloodHtml}
        </div>

        <div style="margin-bottom: 20px;">
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 10px 0;">運動負荷試験（CPX）データ</h2>
          ${cpxHtml}
        </div>
        
        <div>
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 15px 0;">健康記録</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">日付</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">時間</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">血圧</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">脈拍</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">体重</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">運動</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">食事</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">服薬確認</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">日常生活</th>
              </tr>
            </thead>
            <tbody id="records-table">
            </tbody>
          </table>
        </div>
      `;
      
      // 記録データを追加
      const tbody = printContent.querySelector('#records-table');
      const sortedDates = Object.keys(saved).sort().filter(date =>
        !targetMonth || date.startsWith(targetMonth)
      );
      
      sortedDates.forEach(date => {
        const dayRecords = saved[date];
        const sortedTimes = Object.keys(dayRecords)
        .sort((a, b) => formatTime24h(a).localeCompare(formatTime24h(b)));
        
        sortedTimes.forEach(time => {
          const record = dayRecords[time];
          if (!record) return;
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px;">${date}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${formatTime24h(time)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.bloodPressure?.systolic || ''}/${record.bloodPressure?.diastolic || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.pulse || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.weight || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.exercise?.type || ''} ${record.exercise?.duration || ''}分</td>
            <td style="border: 1px solid #ddd; padding: 8px;">主食:${record.meal?.staple || ''} 主菜:${record.meal?.mainDish || ''} 副菜:${record.meal?.sideDish || ''} 他:${record.meal?.other || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.medicationTaken ? '✅ 薬飲みました' : '-'}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.dailyLife || '-'}</td>
          `;
          tbody?.appendChild(row);
        });
      });
      
      // 一時的にDOMに追加
      document.body.appendChild(printContent);
      
      // HTMLをCanvasに変換
      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      // PDFを作成
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4幅
      const pageHeight = 295; // A4高さ
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // PDFをダウンロード
      pdf.save(`心臓リハビリ手帳_${new Date().toISOString().slice(0,10)}.pdf`);
      
      // 一時要素を削除
      document.body.removeChild(printContent);

      console.log('✅ NavigationBar: PDF出力完了'); // 🆕 ログ追加
      
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
              <div className="relative">
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