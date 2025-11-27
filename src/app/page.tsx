"use client";
import { useState, useEffect } from "react"; 
import NavigationBar from "@/components/NavigationBar";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 健康記録の型定義
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
  medicationTaken?: boolean;
}

// LIFFの型定義を追加
declare global {
  interface Window {
    liff: any;
  }
}

export default function Home() {
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
  const [healthRecord, setHealthRecord] = useState({
    bloodPressure: { systolic: '', diastolic: '' },
    pulse: '',
    exercise: { type: '', duration: '' },
    weight: '',  
    meal: {
      staple: [],        // 配列に変更
      mainDish: [],      // 配列に変更
      sideDish: [],      // 配列に変更
      other: ''
    },
    dailyLife: '',
    medicationTaken: false
  });
  
  // 入力フィールドの再レンダリングを防ぐためのキー
  const [inputKey, setInputKey] = useState(0);
  
  // 健康記録の型定義を追加
  interface HealthRecord {
    bloodPressure: { systolic: string; diastolic: string };
    pulse: string;
    exercise: { type: string; duration: string };
    weight: string;
    meal: {
      staple: string | string[];
      mainDish: string | string[];
      sideDish: string | string[];
      other: string;
    };
    dailyLife: string;
    medicationTaken?: boolean;
  }

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
    switch (emotion) {
      case 'happy':
        return '/心臓ちゃん_笑顔.png';
      case 'sad':
        return '/心臓ちゃん_悲しい.png';
      default:
        return '/心臓ちゃん.png';
    }
  };

  // 記録データを保存する状態を追加
  const [savedRecords, setSavedRecords] = useState<{[key: string]: {[key: string]: HealthRecord}}>({});

  // 詳細表示用の状態を追加
  const [showHeartRehabInfo, setShowHeartRehabInfo] = useState(false);

  // LIFF関連の状態を追加
  const [liff, setLiff] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
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
        // ローカル環境の場合はLIFF機能をスキップ
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('ローカル環境: LIFF機能をスキップ');
          setIsLiffReady(true);
          return;
        }

        // LIFFが利用可能かチェック
        if (typeof window !== 'undefined' && window.liff) {
          // LIFF初期化
          await window.liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID 
          });
          
          setLiff(window.liff);
          setIsLiffReady(true);

          // ログイン状態をチェック
          if (window.liff.isLoggedIn()) {
            // ユーザー情報を取得
            const profile = await window.liff.getProfile();
            setUser(profile);
            console.log('LINEユーザー情報:', profile);

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
      const target = event.target as HTMLElement;
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
  
  // LINE Messaging API設定
  const LINE_CHANNEL_ACCESS_TOKEN = process.env.NEXT_PUBLIC_LINE_ACCESS_TOKEN;

  // LINE Messaging APIで家族にメッセージを送信
  const sendLineMessageToFamily = async (memberId: string, message: string) => {
    try {
      const response = await fetch('/api/line/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: memberId,
          message: message,
          accessToken: LINE_CHANNEL_ACCESS_TOKEN,
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
  const shareHealthRecordToAllFamily = async (healthRecord: any) => {
    // 家族メンバー情報を取得
    const familyMembers = JSON.parse(localStorage.getItem('familyMembers') || '[]');
    
    const message = `💖 心臓ちゃんからの健康報告 💖\n\n` +
      `日時: ${new Date().toLocaleDateString('ja-JP')}\n` +
      `血圧: ${healthRecord.bloodPressure?.systolic || ''}/${healthRecord.bloodPressure?.diastolic || ''}mmHg\n` +
      `脈拍: ${healthRecord.pulse || ''}回/分\n` +
      `体重: ${healthRecord.weight || ''}kg\n` +
      `運動: ${healthRecord.exercise?.type || ''} ${healthRecord.exercise?.duration || ''}分\n` +
      `食事: 主食${healthRecord.meal?.staple || ''} 主菜${healthRecord.meal?.mainDish || ''} 副菜${healthRecord.meal?.sideDish || ''}\n` +
      `\n心臓ちゃんからのメッセージ: 今日もお疲れ様でした！💪`;

    // 登録済みの家族メンバーに送信
    const registeredMembers = familyMembers.filter((member: any) => 
      member.isRegistered && member.lineUserId
    );

    for (const member of registeredMembers) {
      await sendLineMessageToFamily(member.lineUserId, message);
    }
  };

  // 異常値検出時の緊急通知
  const sendEmergencyNotification = async (healthRecord: any) => {
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
      const familyMembers = JSON.parse(localStorage.getItem('familyMembers') || '[]');
      
      const registeredMembers = familyMembers.filter((member: any) => 
        member.isRegistered && member.lineUserId
      );

      for (const member of registeredMembers) {
        await sendLineMessageToFamily(member.lineUserId, emergencyMessage);
      }
    }
  };

  //localStorage保存処理
  const handleSaveHealthRecord = async () => {
    try {
      // バリデーション
      if (!healthRecord.bloodPressure.systolic || !healthRecord.bloodPressure.diastolic || !healthRecord.pulse) {
        alert('血圧と脈拍は必須項目です');
        return;
      }

      // 日時から日付と時間を分離
      const dateTime = new Date(selectedDateTime);
      const dateKey = `${dateTime.getFullYear()}-${String(dateTime.getMonth() + 1).padStart(2, '0')}-${String(dateTime.getDate()).padStart(2, '0')}`;
      const timeKey = `${String(dateTime.getHours()).padStart(2, '0')}:${String(dateTime.getMinutes()).padStart(2, '0')}`;

      // データベースに保存
      const response = await fetch('/api/health-records', {
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
        const result = await response.json();
        alert(`${timeKey}の健康記録を保存しました！`);
        
        // ✨ LIFF で Bot に「健康記録」というメッセージを送信（1秒後に実行）
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            console.log('🔍 setTimeout 実行');
            console.log('🔍 LIFF 存在確認:', !!window.liff);
            
            if (window.liff) {
              const isLoggedIn = window.liff.isLoggedIn?.() || false;
              console.log('🔍 LIFF ログイン状態:', isLoggedIn);
              
              if (isLoggedIn && window.liff.sendMessages) {
                console.log('📱 Bot にメッセージを送信中...');
                window.liff.sendMessages([
                  {
                    type: 'text',
                    text: '健康記録'
                  }
                ])
                .then(() => {
                  console.log('✅ Bot メッセージ送信成功');
                })
                .catch((error: any) => {
                  console.error('❌ Bot メッセージ送信エラー:', error);
                });
              } else {
                console.log('⚠️ LIFF が完全に初期化されていません');
              }
            } else {
              console.log('⚠️ window.liff が存在しません');
            }
          }, 1000);
        }
        
        // フォームをリセット
        setHealthRecord({
          bloodPressure: { systolic: '', diastolic: '' },
          pulse: '',
          exercise: { type: '', duration: '' },
          weight: '',
          meal: {
            staple: [],
            mainDish: [],
            sideDish: [],
            other: ''
          },
          dailyLife: '',
          medicationTaken: false
        });
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
        
        // フォームをリセット
        setHealthRecord({
          bloodPressure: { systolic: '', diastolic: '' },
          pulse: '',
          exercise: { type: '', duration: '' },
          weight: '',
          meal: {
            staple: [],
            mainDish: [],
            sideDish: [],
            other: ''
          },
          dailyLife: '',
          medicationTaken: false
        });
      } else {
        const error = await response.json();
        alert(`保存に失敗しました: ${error.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('保存中にエラーが発生しました');
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
        medications: profile.medications || '',
        physicalFunction: profile.physicalFunction || ''
      },
      healthRecords: saved,
      exportDate: new Date().toISOString(),
      version: '1.0'
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
    const saved = JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}');
    
    let csv = '日付,時間,収縮期血圧,拡張期血圧,脈拍,体重,運動種目,運動時間,主食,主菜,副菜,その他,日常生活\n';
    
    Object.entries(saved).forEach(([date, times]: any) => {
      Object.entries(times).forEach(([time, record]: any) => {
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

  /* 他のinputはappearanceをリセット */
  .line-app-container input:not([type="number"]),
  .line-app-container select,
  .line-app-container textarea {
    -webkit-appearance: none;
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

  return (
    <div className="min-h-screen bg-orange-50">
      {/* LINEアプリ用スタイル追加 */}
      {typeof window !== 'undefined' && isLineApp && (
        <style dangerouslySetInnerHTML={{ __html: lineAppStyles }} />
      )}
      {/* 左側：アプリタイトル */}
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
            {/* 心臓ちゃんのイラスト */}
            <div className="w-12 h-12 flex-shrink-0">
              <img 
                src={getHeartImage(heartEmotion)} 
                alt="心臓ちゃん" 
                className="w-full h-full object-contain heartbeat-float"
              />
            </div>
            <h1 
              className="text-xl font-bold text-orange-800 cursor-pointer hover:text-orange-600 transition-colors"
              onClick={() => setShowHeartRehabInfo(true)}
            >
              心臓リハビリ手帳
            </h1>
          </div>
          <NavigationBar />
        </div>
        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            {/* 心臓ちゃんのイラスト */}
            <div className="w-10 h-10 flex-shrink-0">
              <img 
                src={getHeartImage(heartEmotion)} 
                alt="心臓ちゃん" 
                className="w-full h-full object-contain heartbeat-float"
              />
            </div>
            <h1 
              className="text-lg font-bold text-orange-800 cursor-pointer hover:text-orange-600 transition-colors"
              onClick={() => setShowHeartRehabInfo(true)}
            >
              心臓リハビリ手帳
            </h1>
          </div>
          
          {/* ナビゲーションボタン */}
          <div className="flex justify-center">
            <NavigationBar />
          </div>
        </div>
      </header>

      {/* ウェルカムメッセージ */}
      {user?.displayName && (
        <div className="bg-gradient-to-r from-orange-100 to-orange-50 border-l-4 border-orange-400 p-4 m-4 rounded-lg">
          <p className="text-orange-800 font-semibold text-lg">
            ようこそ、{user.displayName}さん！
          </p>
          <p className="text-orange-700 text-sm mt-1">
            今日も健康記録を入力しましょう。
          </p>
        </div>
      )}

      {/* メインコンテンツ */}
      <main 
        className={`p-3 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '12px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '12px',
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        {/* 健康記録（横幅full） */}
        <section className="bg-white rounded-lg shadow-sm p-3 mb-2 w-full">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 gap-2">
            <h2 className="text-lg font-semibold text-gray-800">
              健康記録
            </h2>
            
            {/* 日付と時間を統合 */}
            <div className="w-full md:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                記録日時 <span className="text-xs text-gray-500">（現在の日時が自動入力されています）</span>
              </label>
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(e) => setSelectedDateTime(e.target.value)}
                className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  isLineApp ? 'line-input' : ''
                }`}
                style={isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}}
              />
            </div>
          </div>

          {/* 入力フォーム */}
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            {/* 血圧 */}
            <div className="flex-1">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    収縮期血圧（上）
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    onKeyDown={blockInvalidKeys}
                    value={healthRecord?.bloodPressure?.systolic || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 空文字列または有効な数値のみ許可
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setHealthRecord({
                          ...healthRecord,
                          bloodPressure: {
                            ...healthRecord?.bloodPressure,
                            systolic: value
                          }
                        });
                      }
                    }}
                    placeholder="入力してください"
                    className={`w-full px-1 py-0.5 md:px-2 md:py-1 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={{
                      ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                      WebkitAppearance: 'textfield' as any
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 mb-1">
                    拡張期血圧（下）
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    onKeyDown={blockInvalidKeys}
                    value={healthRecord?.bloodPressure?.diastolic || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setHealthRecord({
                          ...healthRecord,
                          bloodPressure: {
                            ...healthRecord?.bloodPressure,
                            diastolic: value
                          }
                        });
                      }
                    }}
                    placeholder="入力してください"
                    className={`w-full px-1 py-0.5 md:px-2 md:py-1 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={{
                      ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                      WebkitAppearance: 'textfield' as any
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 脈拍 */}
            <div className="flex-1">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  脈拍数
                </label>
                <div className="flex gap-3">
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    onKeyDown={blockInvalidKeys}
                    value={healthRecord?.pulse || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setHealthRecord({
                          ...healthRecord,
                          pulse: value
                        });
                      }
                    }}
                    placeholder="入力してください"
                    className={`flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={{
                      ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                      WebkitAppearance: 'textfield' as any
                    }}
                  />
                  <span className="text-sm text-gray-500 self-end pb-3">回/分</span>
                </div>
              </div>
            </div>
            
            {/* 体重 */}
            <div className="flex-1">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  体重
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  onKeyDown={blockInvalidKeys}
                  value={healthRecord?.weight || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setHealthRecord({
                        ...healthRecord,
                        weight: value
                      });
                    }
                  }}
                  placeholder="入力してください"
                  className={`w-full px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                    isLineApp ? 'line-input' : ''
                  }`}
                  style={{
                    ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                    WebkitAppearance: 'textfield' as any
                  }}
                />
              </div>
            </div>
              
            {/* 運動内容 */}
            <div className="flex-1">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  運動内容
                </label>
                <div className="flex gap-2">
                  <select
                    value={healthRecord?.exercise?.type || ''}
                    onChange={(e) => setHealthRecord({
                      ...healthRecord,
                      exercise: {
                        ...healthRecord?.exercise,
                        type: e.target.value
                      }
                    })}
                    className={`flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={{
                      ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                      WebkitAppearance: 'textfield' as any
                    }}
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
                    min={0}
                    inputMode="numeric"
                    onKeyDown={blockInvalidKeys}
                    value={healthRecord?.exercise?.duration || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || /^\d*\.?\d*$/.test(value)) {
                        setHealthRecord({
                          ...healthRecord,
                          exercise: {
                            ...healthRecord?.exercise,
                            duration: value
                          }
                        });
                      }
                    }}
                    placeholder="0"
                    className={`w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={{
                      ...(isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}),
                      WebkitAppearance: 'textfield' as any
                    }}
                  />
                  <span className="flex items-center text-base text-gray-600">分</span>
                </div>
              </div>
            </div>
          </div>

          {/* 食事内容 */}
          <div className="mb-2">
            <label className="block text-sm text-gray-600 mb-1">
              食事内容
            </label>
            
            {/* スマホ版：縦配置（その他は下の段） */}
            <div className="md:hidden">
              <div className="flex flex-row gap-1">
                {/* 主食 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">主食</label>
                  <div className="space-y-1">
                    {['ごはん', 'パン', 'めん', 'いも類'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.staple).includes(item)}
                          onChange={(e) => handleMealChange('staple', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.staple).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.staple).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 主菜 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">主菜</label>
                  <div className="space-y-1">
                    {['魚', '肉', '卵'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.mainDish).includes(item)}
                          onChange={(e) => handleMealChange('mainDish', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.mainDish).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.mainDish).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 副菜 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">副菜</label>
                  <div className="space-y-1">
                    {['野菜', '海藻', 'きのこ'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.sideDish).includes(item)}
                          onChange={(e) => handleMealChange('sideDish', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.sideDish).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.sideDish).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* スマホ版：その他（下の段） */}
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">その他</label>
                <input
                  type="text"
                  value={healthRecord?.meal?.other || ''}
                  onChange={(e) => setHealthRecord({
                    ...healthRecord,
                    meal: {
                      ...healthRecord.meal,
                      other: e.target.value
                    }
                  })}
                  placeholder="果物、乳製品など"
                  className={`w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                    isLineApp ? 'line-input' : ''
                  }`}
                  style={isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}}
                />
              </div>
            </div>

            {/* デスクトップ版：元の横配置 */}
            <div className="hidden md:block">
              <div className="flex flex-row gap-2">
                {/* 主食 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">主食</label>
                  <div className="space-y-1">
                    {['ごはん', 'パン', 'めん', 'いも類'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.staple).includes(item)}
                          onChange={(e) => handleMealChange('staple', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.staple).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.staple).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 主菜 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">主菜</label>
                  <div className="space-y-1">
                    {['魚', '肉', '卵'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.mainDish).includes(item)}
                          onChange={(e) => handleMealChange('mainDish', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.mainDish).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.mainDish).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 副菜 */}
                <div className="flex-1 min-w-0">
                  <label className="block text-xs text-gray-500 mb-1">副菜</label>
                  <div className="space-y-1">
                    {['野菜', '海藻', 'きのこ'].map(item => (
                      <label key={item} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={convertStringToArray(healthRecord?.meal?.sideDish).includes(item)}
                          onChange={(e) => handleMealChange('sideDish', item, e.target.checked)}
                          className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">{item}</span>
                      </label>
                    ))}
                  </div>
                  {convertStringToArray(healthRecord?.meal?.sideDish).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {convertStringToArray(healthRecord?.meal?.sideDish).map(item => (
                        <span key={item} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* その他（自由記載） */}
                <div className="flex-[2]">
                  <label className="block text-xs text-gray-500 mb-1">その他</label>
                  <input
                    type="text"
                    value={healthRecord?.meal?.other || ''}
                    onChange={(e) => setHealthRecord({
                      ...healthRecord,
                      meal: {
                        ...healthRecord.meal,
                        other: e.target.value
                      }
                    })}
                    placeholder="果物、乳製品など"
                    className={`w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 ${
                      isLineApp ? 'line-input' : ''
                    }`}
                    style={isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 🆕 服薬確認 */}
          <div className="mb-2">
            <label className="block text-sm text-gray-600 mb-2">
              服薬確認
            </label>
            <label className="flex items-center space-x-2 p-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-orange-50">
              <input
                type="checkbox"
                checked={healthRecord?.medicationTaken || false}
                onChange={(e) => setHealthRecord({
                  ...healthRecord,
                  medicationTaken: e.target.checked
                })}
                className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 w-4 h-4"
              />
              <span className="text-sm text-gray-700">今、薬飲みました</span>
            </label>
          </div>

          {/* 日常生活のこと */}
          <div className="mb-2">
            <label className="block text-sm text-gray-600 mb-1">
              日常生活のこと（自由記載）
            </label>
            <textarea
              value={healthRecord?.dailyLife || ''}
              onChange={(e) => setHealthRecord({
                ...healthRecord,
                dailyLife: e.target.value
              })}
              placeholder="気分、体調の変化、気になったことなど自由にお書きください"
              rows={3}
              className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none ${
                isLineApp ? 'line-input' : ''
              }`}
              style={isLineApp ? { fontSize: '16px', minHeight: '44px' } : {}}
            />
            </div>
            
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
          <div className="mt-2 flex justify-center">
            <button 
              onClick={handleSaveHealthRecord}
              disabled={!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse}
              className={`w-auto text-white py-2 px-4 rounded-lg font-medium text-lg ${
                (!healthRecord?.bloodPressure?.systolic || !healthRecord?.bloodPressure?.diastolic || !healthRecord?.pulse)
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-orange-500 hover:bg-orange-600'
              } ${isLineApp ? 'line-input' : ''}`}
              style={isLineApp ? { minHeight: '44px', fontSize: '18px', padding: '16px 24px' } : {}}
            >
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
                
                return getButtonText();
              })()}
            </button>
          </div>
        </section>

      </main>

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
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-2 md:space-y-3 text-gray-700">
              <div className="bg-orange-50 p-2 md:p-3 rounded-lg">
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
                  <li>• AIアドバイスで健康管理をサポート</li>
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
    </div>
  );
}