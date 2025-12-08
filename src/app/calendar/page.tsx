"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { getSession, isLineLoggedIn } from "@/lib/auth";


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

// LIFFの型定義
declare global {
  interface Window {
    liff: any;
  }
}

export default function CalendarPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(''); // 選択された時間
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

  // 食事選択のハンドラー関数
  const handleMealChange = (category: 'staple' | 'mainDish' | 'sideDish', item: string, checked: boolean, record: any) => {
    const currentMeal = record.meal || { staple: [], mainDish: [], sideDish: [], other: '' };
    
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

  // localStorageキーをユーザーIDで個別化
  const getStorageKey = (baseKey: string) => {
    if (user?.userId) {
      return `${baseKey}_${user.userId}`;
    }
    // ローカル開発時はユーザーIDなしでも動くようフォールバック
    return `${baseKey}_local`;
  };

  const [editingRecord, setEditingRecord] = useState<{
    date: string;
    time: string;
    record: any;
  } | null>(null);
  const [recentStamp, setRecentStamp] = useState<{ date: string; time: string } | null>(null);

  // 記録データを保存する状態を追加
  const [savedRecords, setSavedRecords] = useState<{[key: string]: {[key: string]: any}}>({});
  const [isLoading, setIsLoading] = useState(true);

  // 詳細表示用の状態を追加
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // LIFF関連の状態を追加
  const [liff, setLiff] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLiffReady, setIsLiffReady] = useState(false);

  // 🆕 追加：LINEミニアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });

  // 認証チェック
  useEffect(() => {
    const session = getSession();
    
    // メールログインセッション優先
    if (session) {
      console.log('📧 メールログイン確認');
      setUser({
        userId: session.userId,
        displayName: session.userName
      });
      setIsAuthenticated(true);
      return;
    }

    // LINE ログイン判定（シンプル版 - 即座に判定）
    if (isLineLoggedIn()) {
      console.log('✅ LINE ログイン確認');
      setIsAuthenticated(true);
      return;
    }

    // ログインなし → ホームへ
    console.log('❌ ログインなし');
    router.push('/');
  }, [router]);

  // LIFF初期化とLINEアプリ検出
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

        if (typeof window !== 'undefined' && window.liff) {
          await window.liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' 
          });
          
          setLiff(window.liff);
          
          if (window.liff.isLoggedIn()) {
            const profile = await window.liff.getProfile();
            setUser(profile);
            console.log('LINEユーザー情報:', profile);

            // LINEアプリ内で実行されているかチェック
            if (window.liff.isInClient()) {
              console.log('LINEアプリ内で実行中');
              setIsLineApp(true);
              
              // LINEアプリ内の安全エリアを設定
              const handleResize = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                const statusBarHeight = window.screen.height - window.innerHeight > 100 ? 44 : 20;
                setLineSafeArea({
                  top: statusBarHeight,
                  bottom: 0
                });
                
                console.log('LINEアプリ検出:', {
                  isLineApp: true,
                  safeArea: { top: statusBarHeight, bottom: 0 },
                  windowHeight: window.innerHeight,
                  screenHeight: window.screen.height
                });
              };
              
              handleResize();
              window.addEventListener('resize', handleResize);
              window.addEventListener('orientationchange', () => {
                setTimeout(handleResize, 100);
              });
            } else {
              console.log('ブラウザで実行中');
              setIsLineApp(false);
            }
          } else {
            window.liff.login();
          }
        }
        setIsLiffReady(true);
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
        setIsLiffReady(true);
      }
    };
    
    initLiff();
  }, []);

  // fetchHealthRecords関数を追加
  const fetchHealthRecords = async (userId: string = 'user-1') => {
    try {
      setIsLoading(true);
      console.log('Fetching health records...');
      
      // 相対パスでAPIを呼び出し
      const response = await fetch(`/api/health-records?userId=${userId}`);
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched data:', data);
        
        // データベースの形式をカレンダー表示用に変換
        const formattedRecords: {[key: string]: {[key: string]: any}} = {};
        
        data.records.forEach((record: any) => {
          const dateKey = record.date.split('T')[0]; // YYYY-MM-DD形式
          const timeKey = record.time;
          
          if (!formattedRecords[dateKey]) {
            formattedRecords[dateKey] = {};
          }
          
          formattedRecords[dateKey][timeKey] = {
            bloodPressure: {
              systolic: record.bloodPressure.systolic,
              diastolic: record.bloodPressure.diastolic
            },
            pulse: record.pulse,
            weight: record.weight,
            exercise: record.exercise,
            meal: record.meal,
            dailyLife: record.dailyLife,
            medicationTaken: record.medicationTaken || false
          };
        });
        
        console.log('Formatted records:', formattedRecords);
        setSavedRecords(formattedRecords);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch health records:', response.status, errorText);
      }
    } catch (error) {
      console.error('Error fetching health records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // データベースから健康記録を取得
  useEffect(() => {
    const currentUserId = user?.userId || 'user-1';
    fetchHealthRecords(currentUserId);
    
    // 直近の記録（健康記録ページから遷移してきた場合など）をチェック
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lastSavedRecord');
        if (raw) {
          const parsed = JSON.parse(raw) as { date?: string; time?: string; savedAt?: number };
          if (parsed.date && parsed.time && parsed.savedAt) {
            const elapsed = Date.now() - parsed.savedAt;
            // 5分以内ならハイライト対象にする
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
  }, [user]);

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
  const startEditing = (date: string, time: string, record: any) => {
    setEditingRecord({ date, time, record: { ...record } });
    setShowDetail(false); // 詳細モーダルを閉じる
  };

  // 編集キャンセル
  const cancelEditing = () => {
    setEditingRecord(null);
  };

  // 編集保存
  const saveEdit = async () => {
    if (!editingRecord) return;
    
    try {
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
      const currentUserId = user?.userId || 'user-1';
      
      console.log('💾 カレンダー: 編集した記録をデータベースに保存中...', { userId: currentUserId, date, time });
      
      // データベースに保存
      const response = await fetch('/api/health-records', {
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
      } else {
        const errorData = await response.json();
        console.error('❌ カレンダー: データベース保存失敗:', errorData);
        alert(`保存に失敗しました: ${errorData.details || errorData.error}`);
      }

      setEditingRecord(null);
      
    } catch (error) {
      console.error('❌ カレンダー: 編集保存エラー:', error);
      alert('保存に失敗しました。');
    }
  };

  // 記録削除
  const deleteRecord = async (date: string, time: string) => {
    if (!confirm('この記録を削除しますか？')) {
      return;
    }
    
    try {
      const currentUserId = user?.userId || 'user-1';
      
      console.log('🗑️ カレンダー: 記録を削除中...', { userId: currentUserId, date, time });
      
      // データベースから削除
      const deleteUrl = `/api/health-records?userId=${currentUserId}&date=${date}&time=${time}`;
      console.log('🗑️ DELETE URL:', deleteUrl);
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE'
      });
      
      console.log('🗑️ DELETE Response status:', response.status);
      console.log('🗑️ DELETE Response ok:', response.ok);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ カレンダー: データベース削除成功:', result);
        
        // ローカルステートからも削除
        setSavedRecords(prev => {
          const newRecords = { ...prev };
          console.log('🗑️ Before delete - savedRecords:', newRecords);
          
          if (newRecords[date] && newRecords[date][time]) {
            delete newRecords[date][time];
            // その日の記録が空になった場合は日付キーも削除
            if (Object.keys(newRecords[date]).length === 0) {
              delete newRecords[date];
            }
          }
          
          console.log('🗑️ After delete - savedRecords:', newRecords);
          return newRecords;
        });
        
        // 詳細モーダルを閉じる
        setShowDetail(false);
        setSelectedDate('');
        setSelectedTime('');
        
        alert('記録を削除しました！');
      } else {
        const errorText = await response.text();
        console.error('❌ カレンダー: データベース削除失敗:', response.status, errorText);
        alert(`削除に失敗しました: ${response.status} ${errorText}`);
      }
      
    } catch (error) {
      console.error('❌ カレンダー: 削除エラー:', error);
      alert('削除に失敗しました。');
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

  return isAuthenticated ? (
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
        {/* ヘッダー */}
        <header 
          className={`sticky top-0 z-50 bg-white shadow-sm px-2 py-1 ${isLineApp ? 'line-app-header' : ''}`}
          style={{
            paddingTop: isLineApp ? `${lineSafeArea.top + 8}px` : '8px'
          }}
        >
        {/* デスクトップ版：横並び */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              カレンダー
            </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              カレンダー
            </h1>
          </div>
          
          {/* ナビゲーションボタン */}
          <div className="flex justify-center">
            <NavigationBar />
          </div>
        </div>
      </header>

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
            <h2 className="text-xl md:text-4xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              📅 {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </h2>
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
                              className="px-3 py-1 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => deleteRecord(selectedDate, time)}
                              className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600"
                            >
                              削除
                            </button>
                          </div>
                        </div>
                        
                        {/* 記録の詳細 */}
                        <div className="space-y-2 text-sm">
                          {((record as HealthRecord).bloodPressure?.systolic || (record as HealthRecord).bloodPressure?.diastolic) && (
                            <p className="text-gray-700"><span className="font-semibold">血圧:</span> {(record as HealthRecord).bloodPressure?.systolic || ''}/{(record as HealthRecord).bloodPressure?.diastolic || ''}mmHg</p>
                          )}
                          {(record as HealthRecord).pulse && (
                            <p className="text-gray-700"><span className="font-semibold">脈拍:</span> {(record as HealthRecord).pulse}回/分</p>
                          )}
                          {(record as HealthRecord).weight && (
                            <p className="text-gray-700"><span className="font-semibold">体重:</span> {(record as HealthRecord).weight}kg</p>
                          )}
                          {((record as HealthRecord).exercise?.type || (record as HealthRecord).exercise?.duration) && (
                            <p className="text-gray-700"><span className="font-semibold">運動:</span> {(record as HealthRecord).exercise?.type || ''} {(record as HealthRecord).exercise?.duration || ''}分</p>
                          )}
                          
                          {((record as HealthRecord).meal?.staple || (record as HealthRecord).meal?.mainDish || (record as HealthRecord).meal?.sideDish || (record as HealthRecord).meal?.other) && (
                            <div className="border-t pt-2 mt-2">
                              <p className="font-semibold text-gray-800 mb-2">食事内容：</p>
                              <div className="pl-2">
                                <div className="grid grid-cols-3 gap-1 text-gray-700 text-xs mb-1">
                                  {(record as HealthRecord).meal?.staple && <p>主食: {(record as HealthRecord).meal?.staple}</p>}
                                  {(record as HealthRecord).meal?.mainDish && <p>主菜: {(record as HealthRecord).meal?.mainDish}</p>}
                                  {(record as HealthRecord).meal?.sideDish && <p>副菜: {(record as HealthRecord).meal?.sideDish}</p>}
                                </div>
                                {(record as HealthRecord).meal?.other && <p className="text-gray-700 text-xs">その他: {(record as HealthRecord).meal?.other}</p>}
                              </div>
                            </div>
                          )}

                          {((record as HealthRecord).medicationTaken || (record as HealthRecord).dailyLife) && (
                            <div className="border-t pt-2 mt-2">
                              {(record as HealthRecord).medicationTaken && (
                                <p className="text-gray-800 font-semibold"> 服薬確認：薬を飲みました</p>
                              )}
                              {(record as HealthRecord).dailyLife && (
                                <div className="mt-1">
                                  <p className="font-semibold text-gray-800 mb-1">日常生活のこと：</p>
                                  <p className="pl-2 text-gray-700">{(record as HealthRecord).dailyLife}</p>
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
                        <input
                          type="number"
                          value={editingRecord.record.bloodPressure?.systolic || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              bloodPressure: {
                                ...editingRecord.record.bloodPressure,
                                systolic: e.target.value
                              }
                            }
                          })}
                          placeholder="120"
                          className="flex-1 min-w-0 px-2 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                        />
                        <span className="text-lg md:text-2xl font-bold flex-shrink-0">/</span>
                        <input
                          type="number"
                          value={editingRecord.record.bloodPressure?.diastolic || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              bloodPressure: {
                                ...editingRecord.record.bloodPressure,
                                diastolic: e.target.value
                              }
                            }
                          })}
                          placeholder="80"
                          className="flex-1 min-w-0 px-2 md:px-4 py-2 md:py-3 text-base md:text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>

                    {/* 脈拍 */}
                    <div className="bg-pink-50 rounded-lg p-4 border-2 border-pink-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        💓 脈拍
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={editingRecord.record.pulse || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              pulse: e.target.value
                            }
                          })}
                          placeholder="70"
                          className="flex-1 px-3 py-2 md:px-4 md:py-3 text-base md:text-lg border-2 border-pink-300 rounded-lg focus:outline-none focus:border-pink-500"
                        />
                        <span className="text-base md:text-lg font-semibold text-gray-700 whitespace-nowrap">回/分</span>
                      </div>
                    </div>

                    {/* 体重 */}
                    <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-300">
                      <label className="block text-xl font-bold text-gray-800 mb-3">
                        ⚖️ 体重
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={editingRecord.record.weight || ''}
                          onChange={(e) => setEditingRecord({
                            ...editingRecord,
                            record: {
                              ...editingRecord.record,
                              weight: e.target.value
                            }
                          })}
                          placeholder="65.5"
                          className="flex-1 px-4 py-3 text-lg border-2 border-yellow-300 rounded-lg focus:outline-none focus:border-yellow-500"
                        />
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
                          className="w-full px-4 py-3 text-lg border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500"
                        >
                          <option value="">選択してください</option>
                          <option value="歩行">歩行</option>
                          <option value="ランニング">ランニング</option>
                          <option value="自転車">自転車</option>
                          <option value="筋トレ">筋トレ</option>
                          <option value="その他">その他</option>
                        </select>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            value={editingRecord.record.exercise?.duration || ''}
                            onChange={(e) => setEditingRecord({
                              ...editingRecord,
                              record: {
                                ...editingRecord.record,
                                exercise: {
                                  ...editingRecord.record.exercise,
                                  duration: e.target.value
                                }
                              }
                            })}
                            placeholder="30"
                            className="flex-1 px-4 py-3 text-lg border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-500"
                          />
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
                            onChange={(e) => setEditingRecord({
                              ...editingRecord,
                              record: {
                                ...editingRecord.record,
                                meal: {
                                  ...editingRecord.record.meal,
                                  other: e.target.value
                                }
                              }
                            })}
                            placeholder="果物、乳製品など"
                            className="w-full px-4 py-3 text-lg border-2 border-red-300 rounded-lg focus:outline-none focus:border-red-500"
                          />
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
                        onChange={(e) => setEditingRecord({
                          ...editingRecord,
                          record: {
                            ...editingRecord.record,
                            dailyLife: e.target.value
                          }
                        })}
                        placeholder="気分、体調の変化、気になったことなど自由にお書きください"
                        rows={4}
                        className="w-full px-4 py-3 text-lg border-2 border-purple-300 rounded-lg focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* ボタン */}
                    <div className="flex gap-3 mt-6 pb-4">
                      <button
                        onClick={saveEdit}
                        className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white py-4 px-4 rounded-lg hover:from-orange-600 hover:to-pink-600 font-bold text-xl"
                      >
                        💾 保存
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 bg-gray-400 text-white py-4 px-4 rounded-lg hover:bg-gray-500 font-bold text-xl"
                      >
                        キャンセル
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
              )}
      </main>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
      <p className="text-gray-600">読み込み中...</p>
    </div>
  );
}