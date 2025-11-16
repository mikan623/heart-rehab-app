"use client";
import { useState, useEffect } from "react";
import NavigationBar from "@/components/NavigationBar";

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
}

// LIFFの型定義
declare global {
  interface Window {
    liff: any;
  }
}

export default function CalendarPage() {
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

  // LIFF初期化とLINEアプリ検出
  useEffect(() => {
    const initLiff = async () => {
      try {
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
            dailyLife: record.dailyLife
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

  // 時間色分け
  const getTimeColor = (time: string) => {
    if (time >= '06:00' && time < '12:00') return 'bg-green-100 text-green-800';
    if (time >= '12:00' && time < '18:00') return 'bg-blue-100 text-blue-800';
    return 'bg-purple-100 text-purple-800';
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
            dailyLife: editingRecord.record.dailyLife || ''
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

  return (
      <div className="min-h-screen bg-orange-50">
        {/* LINEアプリ用スタイル */}
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
            <h1 className="text-xl font-bold text-orange-800">
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
        className={`p-4 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '16px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '16px',
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          {/* 月移動ボタン */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={goToPreviousMonth}
              className="bg-white border border-orange-300 text-orange-700 py-2 px-4 rounded-lg font-medium hover:bg-orange-50"
            >
              ← 前月
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
            </h2>
            <button
              onClick={goToNextMonth}
              className="bg-white border border-orange-300 text-orange-700 py-2 px-4 rounded-lg font-medium hover:bg-orange-50"
            >
              次月 →
            </button>
          </div>

          {/* カレンダー全体を外枠で囲む */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7">
                <div className="text-center text-xs text-red-500 font-medium py-1 border-r border-gray-300 border-b border-gray-300">日</div>
                <div className="text-center text-xs text-gray-700 font-medium py-1 border-r border-gray-300 border-b border-gray-300">月</div>
                <div className="text-center text-xs text-gray-700 font-medium py-1 border-r border-gray-300 border-b border-gray-300">火</div>
                <div className="text-center text-xs text-gray-700 font-medium py-1 border-r border-gray-300 border-b border-gray-300">水</div>
                <div className="text-center text-xs text-gray-700 font-medium py-1 border-r border-gray-300 border-b border-gray-300">木</div>
                <div className="text-center text-xs text-gray-700 font-medium py-1 border-r border-gray-300 border-b border-gray-300">金</div>
                <div className="text-center text-xs text-blue-500 font-medium py-1 border-b border-gray-300">土</div>
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
                          h-20 md:h-24 flex flex-col items-start justify-start text-xs md:text-sm pt-1 px-0.5 md:px-1 overflow-hidden
                          ${index % 7 !== 6 ? 'border-r border-gray-300' : ''}
                          ${index < 35 ? 'border-b border-gray-300' : ''}
                          ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                          ${day.isSunday ? 'text-red-500' : ''}
                          ${day.isSaturday ? 'text-blue-500' : ''}
                          hover:bg-gray-100 cursor-pointer
                        `}
                        onClick={() => handleDateClick(day.fullDate)}
                      >
                        {/* 日付 */}
                        <div className="font-medium text-xs md:text-sm flex-shrink-0 mb-0.5">{day.date}</div>
                        
                        {/* 記録一覧 */}
                        <div className="flex-1 w-full overflow-y-auto">
                          {dayRecords && (
                            <div className="space-y-0.5">
                              {Object.entries(dayRecords)
                                .sort(([t1], [t2]) => formatTime24h(t1).localeCompare(formatTime24h(t2)))
                                .slice(0, 3)  // 🆕 スマホでは最大3件まで表示
                                .map(([time, record]) => {
                                if (!record) return null;
                                
                                // 時間表記を統一（morning/afternoon/evening を時間に変換）
                                const getDisplayTime = (time: string) => {
                                  if (time === 'morning') return '08:00';
                                  if (time === 'afternoon') return '14:00';
                                  if (time === 'evening') return '20:00';
                                  return time; // 既に時間形式の場合はそのまま
                                };
                                
                                const displayTime = getDisplayTime(time);
                                
                                return (
                                  <div key={time} className={`text-xs md:text-sm ${getTimeColor(displayTime)} px-1 py-0.5 rounded truncate`}>
                                    {/* スマホでは簡略化、PCでは詳細表示 */}
                                    <div className="block md:hidden truncate">
                                      {(record as HealthRecord).bloodPressure?.systolic || ''}/{(record as HealthRecord).bloodPressure?.diastolic || ''}
                                    </div>
                                    <div className="hidden md:block text-xs truncate">
                                      {displayTime}: {(record as HealthRecord).bloodPressure?.systolic || ''}/{(record as HealthRecord).bloodPressure?.diastolic || ''} {(record as HealthRecord).pulse || ''}回 {(record as HealthRecord).weight || ''}kg
                                    </div>
                                  </div>
                                );
                              })}
                              {/* 🆕 3件以上ある場合は「+n件」と表示 */}
                              {dayRecords && Object.keys(dayRecords).length > 3 && (
                                <div className="text-xs text-gray-500 px-1 py-0.5 md:hidden">
                                  +{Object.keys(dayRecords).length - 3}件
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
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {selectedDate}の記録
                  </h3>
                  <button
                    onClick={() => setShowDetail(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
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
                        <div className="space-y-1 text-sm">
                          <p>血圧: {(record as HealthRecord).bloodPressure?.systolic || ''}/{(record as HealthRecord).bloodPressure?.diastolic || ''}mmHg</p>
                          <p>脈拍: {(record as HealthRecord).pulse || ''}回/分</p>
                          <p>体重: {(record as HealthRecord).weight || ''}kg</p>
                          <p>運動: {(record as HealthRecord).exercise?.type || ''} {(record as HealthRecord).exercise?.duration || ''}分</p>
                          <p>食事: 主食:{(record as HealthRecord).meal?.staple || ''} 主菜:{(record as HealthRecord).meal?.mainDish || ''} 副菜:{(record as HealthRecord).meal?.sideDish || ''} その他:{(record as HealthRecord).meal?.other || ''}</p>
                          {(record as HealthRecord).dailyLife && (
                            <p>日常生活: {(record as HealthRecord).dailyLife}</p>
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
                  className="fixed inset-0 bg-transparent flex items-center justify-center z-50 p-4"
                  onClick={cancelEditing}
                >
                  <div 
                    className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-orange-600">
                        記録を編集
                      </h3>
                      <button 
                        onClick={cancelEditing}
                        className="text-gray-500 hover:text-gray-700 text-2xl"
                      >
                        ×
                      </button>
                    </div>

                    {/* 日付変更機能 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        記録日付
                      </label>
                      <input
                        type="date"
                        value={editingRecord.date}
                        onChange={(e) => setEditingRecord({
                          ...editingRecord,
                          date: e.target.value
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="mb-4">
                      <p className="text-sm text-gray-600">
                        {editingRecord.date} {formatTime24h(editingRecord.time)}
                      </p>
                    </div>

                    {/* 血圧 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        血圧
                      </label>
                      <div className="flex gap-2 items-center">
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span>/</span>
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-600">mmHg</span>
                      </div>
                    </div>

                    {/* 脈拍 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        脈拍
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-600">回/分</span>
                      </div>
                    </div>

                    {/* 体重 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        体重
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-600">kg</span>
                      </div>
                    </div>

                    {/* 運動 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        運動
                      </label>
                      <div className="flex gap-2">
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
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">選択してください</option>
                          <option value="歩行">歩行</option>
                          <option value="ランニング">ランニング</option>
                          <option value="自転車">自転車</option>
                          <option value="筋トレ">筋トレ</option>
                          <option value="その他">その他</option>
                        </select>
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
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="flex items-center text-sm text-gray-600">分</span>
                      </div>
                    </div>
                    {/* 食事内容 */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        食事内容
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {/* 主食 */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">主食</label>
                          <div className="space-y-1">
                            {['ごはん', 'パン', 'めん', 'いも類'].map(item => (
                              <label key={item} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.staple).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('staple', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 主菜 */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">主菜</label>
                          <div className="space-y-1">
                            {['魚', '肉', '卵'].map(item => (
                              <label key={item} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.mainDish).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('mainDish', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 副菜 */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">副菜</label>
                          <div className="space-y-1">
                            {['野菜', '海藻', 'きのこ'].map(item => (
                              <label key={item} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={convertStringToArray(editingRecord.record.meal?.sideDish).includes(item)}
                                  onChange={(e) => setEditingRecord({
                                    ...editingRecord,
                                    record: handleMealChange('sideDish', item, e.target.checked, editingRecord.record)
                                  })}
                                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                                />
                                <span className="text-sm text-gray-700">{item}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* その他 */}
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">その他</label>
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
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                    {/* 日常生活のこと */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        日常生活のこと
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
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* ボタン */}
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={saveEdit}
                        className="flex-1 bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 font-medium"
                      >
                        保存
                      </button>
                      <button
                        onClick={cancelEditing}
                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 font-medium"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                </div>
              )}
      </main>
    </div>
  );
}