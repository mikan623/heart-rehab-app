"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";

// LIFF型定義を追加（ここから）
declare global {
  interface Window {
    liff: any;
  }
}

interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    userId: '',
    displayName: '',
    age: '',
    gender: '',
    height: '',
    targetWeight: '',
    diseases: [],
    medications: '',
    physicalFunction: '',
    emergencyContact: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  // 🆕 追加：LINEアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });
  const [liff, setLiff] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const getStorageKey = (baseKey: string) => {
    if (profile?.userId) {
      return `${baseKey}_${profile.userId}`;
    }
    return `${baseKey}_local`;
  };

  // 疾患リスト
  const diseaseOptions = [
    '心筋梗塞',
    '狭心症',
    '心不全',
    '高血圧',
    '糖尿病',
    '脂質異常症',
    'その他',
  ];

  useEffect(() => {
    const initLiff = async () => {
      try {
        // ローカル環境の場合はLIFF機能をスキップ
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.log('ローカル環境: LIFF機能をスキップ');
          
          // 🆕 ローカル環境でもデータベースから取得を試みる
          const savedProfile = localStorage.getItem('profile_local');
          if (savedProfile) {
            setProfile(JSON.parse(savedProfile));
          }
          setIsLoading(false);
          return;
        }
  
        if (typeof window !== 'undefined' && window.liff) {
          await window.liff.init({ 
            liffId: process.env.NEXT_PUBLIC_LIFF_ID 
          });
          
          setLiff(window.liff);
          
          if (window.liff.isLoggedIn()) {
            const liffProfile = await window.liff.getProfile();
            setUser(liffProfile);
            
            // LINEアプリ内判定
            if (window.liff.isInClient()) {
              setIsLineApp(true);
              
              const handleResize = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                const statusBarHeight = window.screen.height - window.innerHeight > 100 ? 44 : 20;
                setLineSafeArea({
                  top: statusBarHeight,
                  bottom: 0
                });
              };
              
              handleResize();
              window.addEventListener('resize', handleResize);
            }
  
            // 🆕 データベースからプロフィール取得を試みる
            try {
              const response = await fetch(`/api/profiles?userId=${liffProfile.userId}`);
              
              if (response.ok) {
                const data = await response.json();
                
                if (data.profile) {
                  // データベースにプロフィールがある場合
                  console.log('✅ プロフィールをデータベースから取得');
                  setProfile({
                    userId: liffProfile.userId,
                    displayName: data.profile.displayName || liffProfile.displayName,
                    age: data.profile.age?.toString() || '',
                    gender: data.profile.gender || '',
                    height: data.profile.height?.toString() || '',
                    targetWeight: data.profile.targetWeight?.toString() || '',
                    diseases: data.profile.diseases || [],
                    medications: data.profile.medications || '',
                    physicalFunction: data.profile.physicalFunction || '',
                    emergencyContact: data.profile.emergencyContact || '',
                  });
                } else {
                  // データベースにない場合は、localStorageを確認
                  console.log('📝 データベースにプロフィールなし、localStorageを確認');
                  const savedProfile = localStorage.getItem(`profile_${liffProfile.userId}`);
                  if (savedProfile) {
                    setProfile(JSON.parse(savedProfile));
                  } else {
                    // 初回はLINEプロフィールから基本情報を設定
                    setProfile(prev => ({
                      ...prev,
                      userId: liffProfile.userId,
                      displayName: liffProfile.displayName,
                    }));
                  }
                }
              }
            } catch (error) {
              console.error('プロフィール取得エラー:', error);
              // エラー時はlocalStorageから読み込み
              const savedProfile = localStorage.getItem(`profile_${liffProfile.userId}`);
              if (savedProfile) {
                setProfile(JSON.parse(savedProfile));
              } else {
                setProfile(prev => ({
                  ...prev,
                  userId: liffProfile.userId,
                  displayName: liffProfile.displayName,
                }));
              }
            }
          } else {
            window.liff.login();
          }
        }
      } catch (error) {
        console.error('LIFF初期化エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initLiff();
  }, []);

  const handleDiseaseToggle = (disease: string) => {
    setProfile(prev => ({
      ...prev,
      diseases: prev.diseases.includes(disease)
        ? prev.diseases.filter(d => d !== disease)
        : [...prev.diseases, disease]
    }));
  };

  const handleSave = async () => {
    try {
      // ローカルストレージに保存（バックアップ）
      const storageKey = profile.userId ? `profile_${profile.userId}` : 'profile_local';
      localStorage.setItem(storageKey, JSON.stringify(profile));
      
      // 🆕 データベースにも保存（userIdが空でもuser-1を使用）
      const userId = profile.userId || 'user-1';
      console.log('💾 プロフィールをデータベースに保存中...', { userId });
      
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          profile: profile
        })
      });
  
      if (response.ok) {
        const result = await response.json();
        console.log('✅ データベース保存成功:', result);
        alert('プロフィールを保存しました！');
      } else {
        const error = await response.json();
        console.error('❌ データベース保存失敗:', error);
        alert('保存に失敗しました（localStorageには保存されています）');
      }
      
      router.push('/');
    } catch (error) {
      console.error('プロフィール保存エラー:', error);
      alert('保存に失敗しました（localStorageには保存されています）');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50">
      {/* LINEアプリ用スタイル */}
      {typeof window !== 'undefined' && isLineApp && (
        <style dangerouslySetInnerHTML={{
          __html: `
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
              プロフィール設定
            </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              プロフィール設定
            </h1>
          </div>
          
          {/* ナビゲーションボタン */}
          <div className="flex justify-center">
            <NavigationBar />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          {/* 基本情報 */}
          <h2 className="text-lg font-semibold text-gray-800 mb-3">基本情報</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 名前 */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm text-gray-600 mb-1">お名前</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="山田太郎"
              />
            </div>

            {/* 年齢 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">年齢</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({...profile, age: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="65"
              />
            </div>

            {/* 性別 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">性別</label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({...profile, gender: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </select>
            </div>

            {/* 身長 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">身長（cm）</label>
              <input
                type="number"
                value={profile.height}
                onChange={(e) => setProfile({...profile, height: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="170"
              />
            </div>

            {/* 目標体重 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">目標体重（kg）</label>
              <input
                type="number"
                value={profile.targetWeight}
                onChange={(e) => setProfile({...profile, targetWeight: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="65"
              />
            </div>
          </div>
        </div>

        {/* 医療情報 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">医療情報</h2>
          
          <div className="space-y-3">
            {/* 基礎疾患 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">基礎疾患（複数選択可）</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-2">
                {diseaseOptions.map((disease) => (
                  <label key={disease} className="flex items-center gap-1 sm:gap-2 p-1 sm:p-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-orange-50">
                    <input
                      type="checkbox"
                      checked={profile.diseases.includes(disease)}
                      onChange={() => handleDiseaseToggle(disease)}
                      className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500"
                    />
                    <span className="text-xs sm:text-sm text-gray-700">{disease}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 服薬情報 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">服薬情報</label>
              <textarea
                value={profile.medications}
                onChange={(e) => setProfile({...profile, medications: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="例：降圧剤、血液サラサラの薬など"
                rows={3}
              />
            </div>

            {/* 身体機能 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">身体機能・制限事項</label>
              <textarea
                value={profile.physicalFunction}
                onChange={(e) => setProfile({...profile, physicalFunction: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="例：歩行時に息切れあり、階段は手すりが必要など"
                rows={3}
              />
            </div>

            {/* 緊急連絡先 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">緊急連絡先</label>
              <input
                type="tel"
                value={profile.emergencyContact}
                onChange={(e) => setProfile({...profile, emergencyContact: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="090-1234-5678"
              />
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <button
          onClick={handleSave}
          className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600"
        >
          保存する
        </button>
      </main>
    </div>
  );
}