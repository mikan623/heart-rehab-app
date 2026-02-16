"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { getSession, isLineLoggedIn, setLineLogin, setLineLoggedInDB } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { Liff, LiffProfile } from "@/types/liff";

interface UserProfile {
  userId: string;
  displayName: string;
  email?: string;
  age: string;
  gender: string;
  height: string;
  targetWeight: string;
  diseases: string[];
  riskFactors: string[];
  medications: string;
  physicalFunction: string;
  emergencyContact: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isEmailLogin, setIsEmailLogin] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    userId: '',
    displayName: '',
    email: '',
    age: '',
    gender: '',
    height: '',
    targetWeight: '',
    diseases: [],
    riskFactors: [],
    medications: '',
    physicalFunction: '',
    emergencyContact: '',
  });
  const [isLoading, setIsLoading] = useState(true);

  // 🆕 追加：LINEアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });
  const [liff, setLiff] = useState<Liff | null>(null);
  const [user, setUser] = useState<LiffProfile | null>(null);
  
  // （プロフィール画面での「LINE連携」機能は廃止。LINEログイン自体は維持）
  
  // 保存状態を管理
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

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

  // 動脈硬化危険因子リスト
  const riskFactorOptions = [
    '肥満',
    '喫煙',
    '飲酒',
    '精神的ストレス',
    '運動不足',
    '生活習慣病',
    '過労',
    '家族歴',
  ];

  // 認証チェック
  useEffect(() => {
    const session = getSession();
    
    // メールログインセッション優先
    if (session) {
      setIsAuthenticated(true);
      setIsEmailLogin(true);
      return;
    }

    // LINE ログイン判定（シンプル版 - 即座に判定）
    if (isLineLoggedIn()) {
      console.log('✅ LINE ログイン確認');
      setIsAuthenticated(true);
      setIsEmailLogin(false);
      return;
    }

    // ログインなし → ホームへ
    console.log('❌ ログインなし');
    router.push('/');
  }, [router]);

  // （プロフィール画面での「LINE連携状態チェック」は廃止）

  useEffect(() => {
    const initLiff = async () => {
      try {
        const session = getSession();
        
        // メールログインの場合
        if (session) {
          console.log('📧 メールログインユーザー: プロフィール初期化', { userId: session.userId, userName: session.userName });
          
          // 🆕 メールログインユーザーのプロフィールをデータベースから取得
          try {
            const url = `/api/profiles?userId=${encodeURIComponent(session.userId)}`;
            console.log('🔍 APIをリクエスト:', url);
            const response = await fetch(url);
            
            if (response.ok) {
              const data = await response.json();
              console.log('📊 APIレスポンス:', data);
              
              if (data.profile) {
                // データベースにプロフィールがある場合
                console.log('✅ メールログインユーザーのプロフィールをデータベースから取得', data.profile);
                setProfile({
                  userId: session.userId,
                  displayName: data.profile.displayName || session.userName,
                  email: session.userId,
                  age: data.profile.age?.toString() || '',
                  gender: data.profile.gender || '',
                  height: data.profile.height?.toString() || '',
                  targetWeight: data.profile.targetWeight?.toString() || '',
                  diseases: data.profile.diseases || [],
                  riskFactors: data.profile.riskFactors || [],
                  medications: data.profile.medications || '',
                  physicalFunction: data.profile.physicalFunction || '',
                  emergencyContact: data.profile.emergencyContact || '',
                });
              } else {
                // データベースにない場合は、基本情報のみセット
                console.log('📝 メールログインユーザーのプロフィール未登録、基本情報から初期化');
                setProfile(prev => ({
                  ...prev,
                  userId: session.userId,
                  displayName: session.userName,
                  email: session.userId,
                }));
              }
            } else {
              const errorData = await response.json();
              console.log('⚠️ プロフィール取得失敗（ステータス:', response.status, '）:', errorData);
              setProfile(prev => ({
                ...prev,
                userId: session.userId,
                displayName: session.userName,
                email: session.userId,
              }));
            }
          } catch (error) {
            console.log('⚠️ プロフィール取得エラー:', error);
            setProfile(prev => ({
              ...prev,
              userId: session.userId,
              displayName: session.userName,
              email: session.userId,
            }));
          }
          
          // メールログイン時はLIFF初期化（LINE連携）は行わない
          
          setIsLoading(false);
          return;
        }
        
        if (typeof window !== 'undefined' && window.liff) {
          const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
          if (!liffId) {
            console.warn('LIFF ID missing; skipping init');
            setIsLoading(false);
            return;
          }
          await window.liff.init({ 
            liffId
          });
          
          setLiff(window.liff);
          
          if (window.liff.isLoggedIn()) {
            const liffProfile = await window.liff.getProfile();
            setUser(liffProfile);
            
            // 🆕 LINE ログイン状態をメモリに保存
            setLineLogin(liffProfile.userId, liffProfile.displayName);
            console.log('✅ LINE ログイン状態をメモリに保存');
            
            // Supabase に保存（背景で実行、エラー無視）
            setLineLoggedInDB(liffProfile.userId, true, liffProfile.userId)
              .then(() => console.log('✅ LINE ログイン状態を Supabase に保存'))
              .catch((error) => console.error('⚠️ Supabase 保存失敗（無視）:', error));
            
            // 📧 LINE プロフィールからメールアドレスを取得
            try {
              const liffIdToken = await window.liff.getIDToken();
              const decodedToken = JSON.parse(atob(liffIdToken.split('.')[1]));
              const email = decodedToken.email || '';
              
              console.log('📧 LINE メールアドレス取得:', email);
              
              // プロフィールにメールを自動入力
              setProfile(prev => ({
                ...prev,
                userId: liffProfile.userId,
                displayName: liffProfile.displayName || prev.displayName,
                email: email || prev.email,
              }));
            } catch (error) {
              console.log('⚠️ メールアドレス取得エラー（無視）:', error);
              // メール取得失敗時は displayName だけセット
              setProfile(prev => ({
                ...prev,
                userId: liffProfile.userId,
                displayName: liffProfile.displayName || prev.displayName,
              }));
            }
            
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
              const response = await apiFetch(`/api/profiles?userId=${liffProfile.userId}`);
              
              if (response.ok) {
                const data = await response.json();
                
                if (data.profile) {
                  // データベースにプロフィールがある場合
                  console.log('✅ プロフィールをデータベースから取得');
                  setProfile({
                    userId: liffProfile.userId,
                    displayName: data.profile.displayName || liffProfile.displayName,  // ✅ LINE名が優先
                    age: data.profile.age?.toString() || '',
                    gender: data.profile.gender || '',
                    height: data.profile.height?.toString() || '',
                    targetWeight: data.profile.targetWeight?.toString() || '',
                    diseases: data.profile.diseases || [],
                    riskFactors: data.profile.riskFactors || [],
                    medications: data.profile.medications || '',
                    physicalFunction: data.profile.physicalFunction || '',
                    emergencyContact: data.profile.emergencyContact || '',
                  });
                } else {
                  // データベースにない場合は、LINE プロフィールから初期化
                  console.log('📝 データベースにプロフィールなし、LINE プロフィールから初期化');
                  setProfile({
                    userId: liffProfile.userId,
                    displayName: liffProfile.displayName,  // ✅ LINE名を自動入力
                    age: '',
                    gender: '',
                    height: '',
                    targetWeight: '',
                    diseases: [],
                    riskFactors: [],
                    medications: '',
                    physicalFunction: '',
                    emergencyContact: '',
                  });
                }
              }
            } catch (error) {
              console.error('プロフィール取得エラー:', error);
              // エラー時は LINE プロフィールから初期化
              setProfile({
                userId: liffProfile.userId,
                displayName: liffProfile.displayName,  // ✅ LINE名を自動入力
                age: '',
                gender: '',
                height: '',
                targetWeight: '',
                diseases: [],
                riskFactors: [],
                medications: '',
                physicalFunction: '',
                emergencyContact: '',
              });
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

  const handleRiskFactorToggle = (riskFactor: string) => {
    setProfile(prev => ({
      ...prev,
      riskFactors: prev.riskFactors.includes(riskFactor)
        ? prev.riskFactors.filter(r => r !== riskFactor)
        : [...prev.riskFactors, riskFactor]
    }));
  };

  // （プロフィール画面での「LINE連携」ハンドラ/自動入力は廃止）

  const handleSave = async () => {
    try {
      // 保存開始
      setSaveStatus('saving');
      
      // ローカルストレージに保存（バックアップ）
      const storageKey = profile.userId ? `profile_${profile.userId}` : 'profile_local';
      localStorage.setItem(storageKey, JSON.stringify(profile));
      
      // 🆕 データベースにも保存（userIdが空でもuser-1を使用）
      const userId = profile.userId || 'user-1';
      console.log('💾 プロフィールをデータベースに保存中...', { userId });
      
      const response = await apiFetch('/api/profiles', {
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
        
        // 保存完了状態に更新
        setSaveStatus('saved');
        
        // 3秒後にアイドル状態に戻す
        setTimeout(() => {
          setSaveStatus('idle');
          router.push('/');
        }, 3000);
      } else {
        const error = await response.json();
        console.error('❌ データベース保存失敗:', error);
        alert('保存に失敗しました（localStorageには保存されています）');
        setSaveStatus('idle');
      }
    } catch (error) {
      console.error('プロフィール保存エラー:', error);
      alert('保存に失敗しました（localStorageには保存されています）');
      setSaveStatus('idle');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return isAuthenticated ? (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
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
      <PageHeader
        title="プロフィール設定"
        isLineApp={isLineApp}
        lineSafeAreaTop={isLineApp ? lineSafeArea.top : undefined}
      />

      {/* メインコンテンツ */}
      <main className="px-0 md:p-4">

        {/* 基本情報セクション */}
        <div className="bg-white rounded-none md:rounded-lg shadow-none md:shadow-sm p-4 md:p-6 mb-2 md:mb-4 w-full border-2 border-orange-300">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6">👤 基本情報</h2>

          {/* LINE プロフィール画像を表示 */}
          {user?.pictureUrl && (
            <div className="mb-6 flex justify-center">
              <img
                src={user.pictureUrl}
                alt={user.displayName}
                className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-orange-300 shadow-md object-cover"
              />
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* 名前 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-2 md:mb-3">お名前</label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 placeholder:text-gray-400"
                placeholder="氏名を入力してください"
              />
            </div>

            {/* 年齢 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-2 md:mb-3">年齢</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({...profile, age: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 placeholder:text-gray-400"
                placeholder="年齢を入力してください"
              />
            </div>

            {/* 性別 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-2 md:mb-3">性別</label>
              <select
                value={profile.gender}
                onChange={(e) => setProfile({...profile, gender: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
              >
                <option value="">選択してください</option>
                <option value="男性">男性</option>
                <option value="女性">女性</option>
                <option value="その他">その他</option>
              </select>
            </div>

            {/* 身長 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-2 md:mb-3">身長（cm）</label>
              <input
                type="number"
                value={profile.height}
                onChange={(e) => setProfile({...profile, height: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 placeholder:text-gray-400"
                placeholder="身長を入力してください"
              />
            </div>

            {/* 目標体重 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-2 md:mb-3">目標体重（kg）</label>
              <input
                type="number"
                value={profile.targetWeight}
                onChange={(e) => setProfile({...profile, targetWeight: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 placeholder:text-gray-400"
                placeholder="目標体重を入力してください"
              />
            </div>
          </div>
        </div>

        {/* 医療情報セクション */}
        <div className="bg-white rounded-none md:rounded-lg shadow-none md:shadow-sm p-4 md:p-6 mb-2 md:mb-4 w-full border-2 border-pink-300">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 md:mb-6">🏥 医療情報</h2>
          
          <div className="space-y-4 md:space-y-6">
            {/* 基礎疾患 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-3 md:mb-4">基礎疾患(複数選択可)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {diseaseOptions.map((disease) => (
                  <label key={disease} className="flex items-center gap-2 md:gap-3 p-2 md:p-3 border-2 border-pink-300 rounded-lg cursor-pointer hover:bg-pink-50">
                    <input
                      type="checkbox"
                      checked={profile.diseases.includes(disease)}
                      onChange={() => handleDiseaseToggle(disease)}
                      className="w-5 h-5 md:w-6 md:h-6 text-pink-500"
                    />
                    <span className="text-sm md:text-lg text-gray-700">{disease}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* その他の動脈硬化危険因子 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-3 md:mb-4">⚠️他の動脈硬化危険因子(複数選択可)</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                {riskFactorOptions.map((riskFactor) => (
                  <label key={riskFactor} className="flex items-center gap-2 md:gap-3 p-2 md:p-3 border-2 border-pink-300 rounded-lg cursor-pointer hover:bg-pink-50">
                    <input
                      type="checkbox"
                      checked={profile.riskFactors.includes(riskFactor)}
                      onChange={() => handleRiskFactorToggle(riskFactor)}
                      className="w-5 h-5 md:w-6 md:h-6 text-pink-500"
                    />
                    <span className="text-sm md:text-lg text-gray-700">{riskFactor}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 服薬情報 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-3 md:mb-4">💊服薬情報</label>
              <textarea
                value={profile.medications}
                onChange={(e) => setProfile({...profile, medications: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-lg border-2 border-pink-300 rounded-lg focus:outline-none focus:border-pink-500 placeholder:text-gray-400 resize-none"
                placeholder="例：降圧剤、血液サラサラの薬など"
                rows={5}
              />
            </div>

            {/* 身体機能 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-3 md:mb-4">🦵身体機能・制限事項</label>
              <textarea
                value={profile.physicalFunction}
                onChange={(e) => setProfile({...profile, physicalFunction: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-lg border-2 border-pink-300 rounded-lg focus:outline-none focus:border-pink-500 placeholder:text-gray-400 resize-none"
                placeholder="例：歩行時に息切れあり、階段は手すりが必要など"
                rows={5}
              />
            </div>

            {/* 緊急連絡先 */}
            <div>
              <label className="block text-lg md:text-xl font-semibold text-gray-700 mb-3 md:mb-4">📞緊急連絡先</label>
              <input
                type="tel"
                value={profile.emergencyContact}
                onChange={(e) => setProfile({...profile, emergencyContact: e.target.value})}
                className="w-full px-4 py-3 md:py-4 text-lg md:text-xl border-2 border-pink-300 rounded-lg focus:outline-none focus:border-pink-500 placeholder:text-gray-400"
                placeholder="090-1234-5678"
              />
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="mt-6 md:mt-8 mb-6 flex flex-col md:flex-row gap-3 md:gap-4 justify-center">
          <div className="w-full md:w-2/3">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`w-full text-white py-4 md:py-5 px-6 rounded-2xl font-bold text-2xl md:text-3xl shadow-lg transition-all ${
              saveStatus === 'saved'
                ? 'save-saved'
                : saveStatus === 'saving'
                ? 'save-saving'
                : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600'
            }`}
          >
            {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済' : '保存する'}
          </button>
          </div>
        </div>
      </main>
    </div>
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
      <p className="text-gray-600">読み込み中...</p>
    </div>
  );
}
