"use client";
import { useState, useEffect } from "react";
import NavigationBar from "@/components/NavigationBar";
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
import Link from "next/link";

// プロフィール用インターフェース
interface UserProfile {
  userId: string;
  displayName: string;
  age: string;
  gender: string;
  height: string;
  targetWeight: string;
  diseases: string[];
  medications: string;
  physicalFunction: string;
  emergencyContact: string;
}

// 健康記録の型定義
interface HealthRecord {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  exercise: { type: string; duration: string };
  weight: string;
  meal: {
    staple: string;
    mainDish: string;
    sideDish: string;
    other: string;
  };
  dailyLife?: string;
}

// 心臓ちゃんの表情を決定する関数
const getHeartEmotion = (record: HealthRecord) => {
  let score = 0;
  
  // 血圧の評価（正常範囲: 収縮期<140, 拡張期<90）
  const systolic = parseInt(record.bloodPressure.systolic);
  const diastolic = parseInt(record.bloodPressure.diastolic);
  
  if (systolic < 120 && diastolic < 80) {
    score += 2; // 理想的な血圧
  } else if (systolic < 140 && diastolic < 90) {
    score += 1; // 正常な血圧
  } else {
    score -= 1; // 高血圧
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

  // 体重の評価（BMI計算）
  const weight = parseFloat(record.weight) || 0;
  if (weight > 0) {
    // 仮の身長170cmとして計算
    const height = 1.7;
    const bmi = weight / (height * height);
    if (bmi >= 18.5 && bmi <= 24.9) {
      score += 1; // 正常BMI
    } else if (bmi < 18.5 || bmi > 24.9) {
      score -= 1; // 異常BMI
    }
  }
  
  // 食事の評価
  if (record.meal?.staple && record.meal?.mainDish && record.meal?.sideDish) {
    score += 1; // バランスの取れた食事
  }
  
  // スコアに基づいて表情を決定
  if (score >= 4) return '😊'; // とても良い
  if (score >= 2) return '😐'; // 普通
  if (score >= 0) return '😕'; // やや悪い
  return '😢'; // 悪い
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

// AIアドバイスに基づいて心臓ちゃんの表情を決定
const getHeartEmotionFromAdvice = (advice: string) => {
  if (!advice) return 'normal';
  
  // ポジティブなキーワード
  const positiveKeywords = [
    '良い', '素晴らしい', '完璧', '理想', '正常', '改善', '向上', 
    'おめでとう', '成功', '良い調子', '安定', '健康的', '適切',
    '推奨', '継続', '順調', '良い結果', '優秀', '素晴らしい結果'
  ];
  
  // ネガティブなキーワード
  const negativeKeywords = [
    '注意', '危険', '問題', '改善が必要', '心配', '高血圧', '異常',
    '見直し', '気をつけて', '要観察', '不調', '悪化', '危険信号',
    '医療機関', '医師', '相談', '検査', '治療', '警告'
  ];
  
  // ポジティブなキーワードの数をカウント
  const positiveCount = positiveKeywords.filter(keyword => 
    advice.includes(keyword)
  ).length;
  
  // ネガティブなキーワードの数をカウント
  const negativeCount = negativeKeywords.filter(keyword => 
    advice.includes(keyword)
  ).length;
  
  // 感情を決定
  if (positiveCount > negativeCount && positiveCount > 0) {
    return 'happy'; // 笑顔
  } else if (negativeCount > positiveCount && negativeCount > 0) {
    return 'sad'; // 悲しい
  } else {
    return 'normal'; // 普通
  }
};

// Chart.jsの登録
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

// 健康記録データの型定義
interface HealthRecord {
  bloodPressure: { systolic: string; diastolic: string };
  pulse: string;
  exercise: { type: string; duration: string };
  weight: string;
  meal: {
    staple: string;      // 主食
    mainDish: string;    // 主菜
    sideDish: string;    // 副菜
    other: string;       // その他
  };
}

interface HealthRecords {
  [date: string]: {
    morning?: HealthRecord;
    afternoon?: HealthRecord;
    evening?: HealthRecord;
  };
}

export default function GraphPage() {
  const [savedRecords, setSavedRecords] = useState<HealthRecords>({});
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [showAdvice, setShowAdvice] = useState(false);

  // 🆕 追加：LINEミニアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });
  const [liff, setLiff] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

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

  // LIFF初期化とLINEアプリ検出
  useEffect(() => {
    const initLiff = async () => {
      try {
        // ローカル環境の場合はLIFF機能をスキップ
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('ローカル環境: LIFF機能をスキップ');
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
                  safeArea: { top: statusBarHeight, bottom: 0 }
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
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
      }
    };
    
    initLiff();
  }, []);

  // localStorageからデータを読み込み → データベースからデータを取得
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
        console.error('Failed to fetch health records');
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
    
    // プロフィール情報は引き続きlocalStorageから取得
    if (typeof window !== 'undefined') {
      const savedProfile = localStorage.getItem(getStorageKey('profile'));
      if (savedProfile) {
        setProfile(JSON.parse(savedProfile));
      }
    }
  }, []); // 依存配列を空にして、初回のみ実行

  // 心臓ちゃんの表情状態を追加
  const [heartEmotion, setHeartEmotion] = useState('normal');

  // AIアドバイス取得関数（Hugging Face API版）
  const getAIAdvice = async () => {
    setIsLoadingAdvice(true);
    try {
      // 最新の健康記録を取得
      const latestDate = Object.keys(savedRecords).sort().pop();
      if (!latestDate) {
        setAiAdvice('健康記録がありません。まず健康記録を入力してください。');
        setShowAdvice(true);
        setHeartEmotion('sad');
        return;
      }
      
      const latestTime = Object.keys(savedRecords[latestDate]).sort().pop();
      if (!latestTime) {
        setAiAdvice('健康記録がありません。まず健康記録を入力してください。');
        setShowAdvice(true);
        setHeartEmotion('sad');
        return;
      }
      
      // 型安全なアクセス
      const dayRecords = savedRecords[latestDate];
      const latestRecord = dayRecords[latestTime as keyof typeof dayRecords];
      
      if (!latestRecord) {
        setAiAdvice('健康記録の取得に失敗しました。');
        setShowAdvice(true);
        setHeartEmotion('sad');
        return;
      }
      
      // プロンプト作成
      const prompt = `
  患者プロフィール:
  - 年齢: ${profile?.age || '未設定'}歳
  - 性別: ${profile?.gender || '未設定'}
  - 身長: ${profile?.height || '未設定'}cm
  - 目標体重: ${profile?.targetWeight || '未設定'}kg
  - 疾患: ${profile?.diseases?.join(', ') || 'なし'}

  直近のバイタル:
  - 血圧: ${latestRecord.bloodPressure.systolic}/${latestRecord.bloodPressure.diastolic} mmHg
  - 脈拍: ${latestRecord.pulse} bpm
  - 体重: ${latestRecord.weight} kg

  運動内容: ${latestRecord.exercise.type} ${latestRecord.exercise.duration}分
  食事: 主食${latestRecord.meal.staple}, 主菜${latestRecord.meal.mainDish}, 副菜${latestRecord.meal.sideDish}

  循環器リハビリ指導員として、この患者に具体的で実践的なアドバイスを日本語で簡潔に教えてください。
  `;

      // Next.js API Route経由でアドバイス取得
      const response = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          healthData: {
            summary: {
              totalRecords: Object.keys(savedRecords).length,
              latestDate: latestDate,
            },
            records: savedRecords,
          },
          profile: profile,
        }),
      });

      const data = await response.json();
      
      // 🔍 デバッグ用ログを追加
      console.log('📥 API Response:', { 
        ok: response.ok, 
        status: response.status,
        data 
      });
      
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || data?.details || 'アドバイスの取得に失敗しました。');
      }
      
      console.log('✅ Setting advice:', data.advice); // これも追加
      
      setAiAdvice(data.advice);
      setShowAdvice(true);

      // AIアドバイスに基づいて心臓ちゃんの表情を更新
      const emotion = getHeartEmotionFromAdvice(data.advice);
      setHeartEmotion(emotion);

      return;
      
    } catch (error: any) {
      console.error('AI Advice Error:', error);
      
      // エラーメッセージをユーザーフレンドリーに
      let errorMessage = 'エラーが発生しました。もう一度お試しください。';
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'タイムアウトしました。しばらく待ってから再度お試しください。';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAiAdvice(errorMessage);
      setShowAdvice(true);
      setHeartEmotion('sad');
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  // グラフデータの準備関数
  const prepareGraphData = () => {
    const dates = Object.keys(savedRecords).sort();
    const labels: string[] = [];
    const bloodPressureData: { systolic: number[], diastolic: number[] } = { systolic: [], diastolic: [] };
    const pulseData: number[] = [];
    const weightData: number[] = [];

    dates.forEach(date => {
      const dayRecords = savedRecords[date];
      if (!dayRecords) return;
      
      // その日の全時間帯のデータを取得
      const timeRecords = Object.entries(dayRecords);
      
      // 各時間帯のデータを処理
      timeRecords.forEach(([time, record]) => {
        // 時間表記を統一（morning/afternoon/evening を時間に変換）
        const getDisplayTime = (time: string) => {
          if (time === 'morning') return '08:00';
          if (time === 'afternoon') return '14:00';
          if (time === 'evening') return '20:00';
          return time; // 既に時間形式の場合はそのまま
        };
        
        const displayTime = getDisplayTime(time);
        
        // 血圧データの処理
        if (record && record.bloodPressure?.systolic && record.bloodPressure?.diastolic) {
          labels.push(`${date.split('-')[1]}/${date.split('-')[2]} ${displayTime}`);
          bloodPressureData.systolic.push(parseInt(record.bloodPressure.systolic));
          bloodPressureData.diastolic.push(parseInt(record.bloodPressure.diastolic));
        }
        
        // 脈拍データの処理
        if (record && record.pulse) {
          pulseData.push(parseInt(record.pulse));
        }
        
        // 体重データの処理
        if (record && record.weight) {
          weightData.push(parseFloat(record.weight));
        }
      });
    });

    return {
      labels,
      bloodPressureData,
      pulseData,
      weightData
    };
  };

  // グラフデータの準備
  const graphData = prepareGraphData();

    // 年齢・性別に応じた正常範囲を計算
    const getNormalRanges = () => {
      let bpSystolicMax = 140;
      let bpSystolicMin = 90;
      let bpDiastolicMax = 90;
      let bpDiastolicMin = 60;
      let pulseMax = 100;
      let pulseMin = 60;
      
      // 年齢による調整
      if (profile && profile.age) {
        const age = parseInt(profile.age);
        
        if (age >= 65) {
          // 高齢者は少し高めの範囲を許容
          bpSystolicMax = 150;
          bpDiastolicMax = 90;
          pulseMax = 90; // 高齢者は脈拍がやや低め
        }
        
        if (age < 40) {
          // 若年者は少し厳しめ
          bpSystolicMax = 130;
          pulseMax = 100;
        }
      }
      
      return {
        bloodPressure: {
          systolic: { min: bpSystolicMin, max: bpSystolicMax },
          diastolic: { min: bpDiastolicMin, max: bpDiastolicMax }
        },
        pulse: { min: pulseMin, max: pulseMax },
        weight: { 
          min: profile && profile.targetWeight ? parseFloat(profile.targetWeight) - 10 : 50, 
          max: profile && profile.targetWeight ? parseFloat(profile.targetWeight) + 10 : 100 
        }
      };
    };

    const normalRanges = getNormalRanges();

  // 血圧グラフ用のデータ
  const bloodPressureChartData = {
    labels: graphData.labels,
    datasets: [
      // 背景: 正常範囲 (拡張期) - Y軸60から90の間を薄い緑色で塗りつぶし
      {
        label: '正常範囲 (拡張期)',
        data: Array(graphData.labels.length).fill(normalRanges.bloodPressure.diastolic.min), // 60
        borderColor: 'transparent',
        backgroundColor: 'rgba(34, 197, 94, 0.2)', // 薄い緑色
        pointRadius: 0,
        borderWidth: 0,
        fill: { value: normalRanges.bloodPressure.diastolic.max }, // 60から90まで塗りつぶし
        order: 0, // 最も奥に描画
      },
      // 背景: 正常範囲 (収縮期) - Y軸90から140の間を薄い緑色で塗りつぶし
      {
        label: '正常範囲 (収縮期)',
        data: Array(graphData.labels.length).fill(normalRanges.bloodPressure.systolic.min), // 90
        borderColor: 'transparent',
        backgroundColor: 'rgba(239, 68, 68, 0.2)', // 薄い赤色
        pointRadius: 0,
        borderWidth: 0,
        fill: { value: normalRanges.bloodPressure.systolic.max }, // 90から140まで塗りつぶし
        order: 1, // 拡張期正常範囲の上に描画
      },
      // 背景: 高血圧範囲 - Y軸140より上を薄い赤色で塗りつぶし
      {
        label: '高血圧範囲',
        data: Array(graphData.labels.length).fill(normalRanges.bloodPressure.systolic.max), // 140
        borderColor: 'transparent',
        backgroundColor: 'rgba(239, 68, 68, 0.2)', // 薄い赤色
        pointRadius: 0,
        borderWidth: 0,
        fill: 'end', // 140からグラフの上端まで塗りつぶし
        order: 2, // 収縮期正常範囲の上に描画
      },
      // 実際のデータ線: 収縮期血圧 (赤色)
      {
        label: '収縮期血圧',
        data: graphData.bloodPressureData.systolic,
        borderColor: 'rgb(239, 68, 68)', // 赤色
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
        fill: false, // 塗りつぶさない
        order: 3, // 背景の上に描画
      },
      // 実際のデータ線: 拡張期血圧 (緑色)
      {
        label: '拡張期血圧',
        data: graphData.bloodPressureData.diastolic,
        borderColor: 'rgb(34, 197, 94)', // 緑色
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
        fill: false, // 塗りつぶさない
        order: 4, // 背景の上に描画
      },
    ],
  };

  // 脈拍グラフ用のデータ
  const pulseChartData = {
    labels: graphData.labels,
    datasets: [
      // 背景: 正常範囲 (脈拍) - Y軸60から100の間を薄い青色で塗りつぶし
      {
        label: '正常範囲 (脈拍)',
        data: Array(graphData.labels.length).fill(normalRanges.pulse.min), // 60
        borderColor: 'transparent',
        backgroundColor: 'rgba(59, 130, 246, 0.2)', // 薄い青色
        pointRadius: 0,
        borderWidth: 0,
        fill: { value: normalRanges.pulse.max }, // 60から100まで塗りつぶし
        order: 0, // 最も奥に描画
      },
      // 実際のデータ線: 脈拍 (青色)
      {
        label: '脈拍',
        data: graphData.pulseData,
        borderColor: 'rgb(59, 130, 246)', // 青色
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
        fill: false, // 塗りつぶさない
        order: 1, // 背景の上に描画
      },
    ],
  };

  // 体重グラフ用のデータ
  const weightChartData = {
    labels: graphData.labels,
    datasets: [
      // 背景: 正常範囲 (体重)
      {
        label: '正常範囲 (体重)',
        data: Array(graphData.labels.length).fill(normalRanges.weight.min),
        borderColor: 'transparent',
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        pointRadius: 0,
        borderWidth: 0,
        fill: { value: normalRanges.weight.max },
        order: 0,
      },
      // 目標体重ライン（追加）
      ...(profile && profile.targetWeight ? [{
        label: '目標体重',
        data: Array(graphData.labels.length).fill(parseFloat(profile.targetWeight)),
        borderColor: 'rgb(249, 115, 22)', // オレンジ色
        backgroundColor: 'transparent',
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [5, 5], // 点線
        fill: false,
        order: 1,
      }] : []),
      // 実際のデータ線: 体重
      {
        label: '体重',
        data: graphData.weightData,
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.1,
        pointRadius: 3,
        borderWidth: 2,
        fill: false,
        order: 2,
      },
    ],
  };

  // グラフのオプション設定
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: function(legendItem: any) {
            // 正常値範囲の凡例を非表示にする
            return !legendItem.text.includes('正常値範囲');
          },
          usePointStyle: false,
          boxWidth: 20,
          boxHeight: 2,
          padding: 15,
        }
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 6, // 表示するラベルの最大数を増やす
          maxRotation: 45, // ラベルを45度回転
          minRotation: 45, // 最小回転角度も45度に設定
          font: {
            size: 10, // フォントサイズを小さくする
          },
          padding: 15, // パディングを調整
        },
      },
      y: {
        beginAtZero: true,
      },
    },
    // fill設定を追加
    fill: true,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-orange-700">データを読み込み中...</p>
        </div>
      </div>
    );
  }

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
            健康記録グラフ
      </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              健康記録グラフ
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
        {/* プロフィール情報表示 - ここから追加 */}
        {profile && (
          <section className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">プロフィール情報</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-600">お名前</p>
                <p className="font-medium text-gray-800">{profile.displayName || '未設定'}</p>
              </div>
              <div>
                <p className="text-gray-600">年齢</p>
                <p className="font-medium text-gray-800">{profile.age ? `${profile.age}歳` : '未設定'}</p>
              </div>
              <div>
                <p className="text-gray-600">性別</p>
                <p className="font-medium text-gray-800">{profile.gender || '未設定'}</p>
              </div>
              <div>
                <p className="text-gray-600">目標体重</p>
                <p className="font-medium text-orange-600">{profile.targetWeight ? `${profile.targetWeight}kg` : '未設定'}</p>
              </div>
              {profile.diseases.length > 0 && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-gray-600">基礎疾患</p>
                  <p className="font-medium text-gray-800">{profile.diseases.join('、')}</p>
                </div>
              )}
            </div>
          </section>
        )}
  
        {/* グラフ表示エリア */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            健康記録の推移
          </h2>
          
          {/* グラフ表示 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 血圧グラフ */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">血圧</h3>
              <div className="h-[500px]">
                <Line data={bloodPressureChartData} options={chartOptions} />
              </div>
            </div>

            {/* 脈拍グラフ */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">脈拍</h3>
              <div className="h-[500px]">
                <Line data={pulseChartData} options={chartOptions} />
              </div>
            </div>

            {/* 体重グラフ */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">体重</h3>
              <div className="h-[500px]">
                <Line data={weightChartData} options={chartOptions} />
              </div>
            </div>
          </div>
        </div>

        {/* AIアドバイスセクション */}
        <section className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-0 mb-3">
            {/* タイトル部分 */}
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              {/* 心臓ちゃんのイラスト */}
              <div className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                <img 
                  src={getHeartImage(heartEmotion)} 
                  alt="心臓ちゃん" 
                  className="w-full h-full object-contain heartbeat-float"
                />
              </div>
              AIアドバイス
            </h2>

            {/* ボタングループ */}
            <div className="flex gap-2">
              <button
                onClick={getAIAdvice}
                disabled={isLoadingAdvice}
                className="bg-orange-500 text-white py-1.5 px-3 md:py-2 md:px-4 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-400 text-xs md:text-sm whitespace-nowrap"
              >
                {isLoadingAdvice ? '分析中...' : 'アドバイスを取得'}
              </button>
              {showAdvice && (
                <button
                  onClick={() => {
                    console.log('閉じるボタンがクリックされました');
                    setShowAdvice(false);
                    console.log('showAdvice:', false);
                  }}
                  className="bg-gray-500 text-white py-1.5 px-3 md:py-2 md:px-4 rounded-lg font-medium hover:bg-gray-600 text-xs md:text-sm whitespace-nowrap"
                >
                  閉じる
                </button>
              )}
            </div>
          </div>
          
          {showAdvice && aiAdvice && (
            <div className="bg-gradient-to-r from-orange-50 to-pink-50 rounded-lg p-4 mt-3 border-l-4 border-orange-400">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                    {aiAdvice}
                  </p>
                  <div className="mt-3 text-sm text-orange-600 font-medium">
                    💖 心臓ちゃんより 💖
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
