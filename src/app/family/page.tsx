"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";

// 家族メンバーの型定義
interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  lineUserId?: string;
  isRegistered: boolean; // string から boolean に変更
}

export default function FamilyPage() {
  const router = useRouter();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🆕 追加：LINEミニアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });

  useEffect(() => {
    const initData = async () => {
      try {
        // LIFF初期化処理
        if (typeof window !== 'undefined' && window.liff) {
          try {
            await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });
            console.log('LIFF initialized successfully');
            
            // ログインチェック
            if (window.liff.isLoggedIn()) {
              const profile = await window.liff.getProfile();
              const userId = profile.userId;

              // 🆕 LINEアプリ内判定
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
              
              // 🆕 データベースから家族メンバーを取得
              const response = await fetch(`/api/family-members?userId=${userId}`);
              
              if (response.ok) {
                const data = await response.json();
                console.log('✅ 家族メンバーをデータベースから取得:', data.familyMembers.length);
                setFamilyMembers(data.familyMembers);
              } else {
                console.error('データベース取得エラー、localStorageから読み込み');
                // フォールバック: localStorageから読み込み
                const savedFamily = localStorage.getItem('familyMembers');
                if (savedFamily) {
                  const parsedFamily = JSON.parse(savedFamily);
                  const convertedFamily = parsedFamily.map((member: any) => ({
                    ...member,
                    isRegistered: member.isRegistered === 'true' || member.isRegistered === true
                  }));
                  setFamilyMembers(convertedFamily);
                }
              }
            }
          } catch (error: unknown) {
            console.error('LIFF initialization failed:', error);
            // エラー時はlocalStorageから読み込み
            const savedFamily = localStorage.getItem('familyMembers');
            if (savedFamily) {
              const parsedFamily = JSON.parse(savedFamily);
              const convertedFamily = parsedFamily.map((member: any) => ({
                ...member,
                isRegistered: member.isRegistered === 'true' || member.isRegistered === true
              }));
              setFamilyMembers(convertedFamily);
            }
          }
        } else {
          // LIFFが使えない場合（ローカル環境）
          const savedFamily = localStorage.getItem('familyMembers');
          if (savedFamily) {
            const parsedFamily = JSON.parse(savedFamily);
            const convertedFamily = parsedFamily.map((member: any) => ({
              ...member,
              isRegistered: member.isRegistered === 'true' || member.isRegistered === true
            }));
            setFamilyMembers(convertedFamily);
          } else {
            setFamilyMembers([]);
          }
        }
      } catch (error) {
        console.error('初期化エラー:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initData();
  }, []);

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
    const message = `💖 心臓ちゃんからの健康報告 💖\n\n` +
      `日時: ${new Date().toLocaleDateString('ja-JP')}\n` +
      `血圧: ${healthRecord.bloodPressure?.systolic || ''}/${healthRecord.bloodPressure?.diastolic || ''}mmHg\n` +
      `脈拍: ${healthRecord.pulse || ''}回/分\n` +
      `体重: ${healthRecord.weight || ''}kg\n` +
      `運動: ${healthRecord.exercise?.type || ''} ${healthRecord.exercise?.duration || ''}分\n` +
      `食事: 主食${healthRecord.meal?.staple || ''} 主菜${healthRecord.meal?.mainDish || ''} 副菜${healthRecord.meal?.sideDish || ''}\n` +
      `\n心臓ちゃんからのメッセージ: 今日もお疲れ様でした！💪`;

    // 登録済みの家族メンバーに送信
    const registeredMembers = familyMembers.filter(member => 
      member.isRegistered && member.lineUserId
    );

    for (const member of registeredMembers) {
      await sendLineMessageToFamily(member.lineUserId!, message);
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

      const registeredMembers = familyMembers.filter(member => 
        member.isRegistered && member.lineUserId
      );

      for (const member of registeredMembers) {
        await sendLineMessageToFamily(member.lineUserId!, emergencyMessage);
      }
    }
  };

  // 家族メンバーを更新する関数（データベース連携）
  const updateFamilyMember = async (id: string, field: keyof FamilyMember, value: string | boolean) => {
    // ローカルステートを更新
    const member = familyMembers.find(m => m.id === id);
    if (!member) return;

    const updatedMember = { ...member, [field]: value };

    // ローカルステートを更新（即座に反映）
    setFamilyMembers(prev => {
      const updated = prev.map(m => 
        m.id === id ? updatedMember : m
      );
      return updated;
    });
    
    // 🆕 新規メンバーの場合、名前と関係性が揃ったら DB に保存
    if (id.length <= 15) {
      // 一時的な ID（数字）= 新規メンバー
      if (updatedMember.name && updatedMember.relationship) {
        // 名前と関係性が揃った → DB に保存
        try {
          let userId = 'user-1';
          if (typeof window !== 'undefined' && window.liff && window.liff.isLoggedIn && window.liff.isLoggedIn()) {
            try {
              const profile = await window.liff.getProfile();
              userId = profile.userId;
            } catch (error) {
              console.log('⚠️ LIFF プロフィール取得エラー:', error);
            }
          }

          const response = await fetch('/api/family-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              familyMember: updatedMember
            })
          });

          if (response.ok) {
            const result = await response.json();
            console.log('✅ 家族メンバーをデータベースに保存');
            
            // 一時的な ID を DB の ID に置き換え
            setFamilyMembers(prev => 
              prev.map(m => m.id === id ? { ...updatedMember, id: result.familyMember.id } : m)
            );
          } else {
            console.error('❌ 保存失敗:', response.status);
          }
        } catch (error) {
          console.error('❌ エラー:', error);
        }
      }
    }
    // ✅ 修正：DB ID のメンバーは updateFamilyMember では保存しない
    // （手動の「保存」ボタンで保存する）
  };

  // 家族メンバーの登録
  const registerFamilyMember = async (id: string) => {
    // LINE友達追加の処理
    if (typeof window !== 'undefined' && window.liff) {
      try {
        // LIFFが初期化されているか確認
        if (!window.liff.isInClient()) {
          console.log('Not in LINE client, using fallback');
          // ローカル環境やブラウザでのテスト用
          updateFamilyMember(id, 'isRegistered', true);
          alert('家族メンバーを登録しました！（テスト用）');
          return;
        }

        await window.liff.shareTargetPicker([
          {
            type: 'text',
            text: `心臓リハビリ手帳に招待されました！\n\n${familyMembers.find(m => m.id === id)?.name}さんから健康記録の共有を依頼されています。\n\nアプリをダウンロードして、一緒に健康管理を始めましょう！`
          }
        ]);
        
        updateFamilyMember(id, 'isRegistered', 'true');
        alert('家族に招待を送信しました！');
      } catch (error: unknown) {
        console.error('LIFF initialization failed:', error);
      }
    } else {
      // ローカル環境でのテスト用
      updateFamilyMember(id, 'isRegistered', 'true');
      alert('家族メンバーを登録しました！（テスト用）');
    }
  };

  // 家族メンバーを追加する関数（データベース連携）
  const addFamilyMember = async () => {
    try {
      // 一旦ローカルに追加（UX向上のため）
      const newMember: FamilyMember = {
        id: Date.now().toString(), // 一時的なID
        name: '',
        relationship: '配偶者',
        isRegistered: false
      };
      
      // ローカルステートにも追加
      setFamilyMembers(prev => [...prev, newMember]);
      
      // 🆕 データベースには保存しない
      // （名前と LINE User ID が入力されたら updateFamilyMember で保存）
      console.log('✅ 新しい家族メンバーをローカルに追加');
    } catch (error) {
      console.error('❌ エラー:', error);
      alert('エラーが発生しました');
    }
  };

  // 家族メンバーを削除する関数（データベース連携）
  const removeFamilyMember = async (id: string) => {
    try {
      // データベースのIDかチェック（cuidの形式）
      if (id.length > 15) {
        // データベースから削除
        const response = await fetch(`/api/family-members?memberId=${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log('✅ データベースから削除成功');
        } else {
          console.error('❌ データベース削除失敗');
        }
      }
      
      // ローカルステートから削除
      setFamilyMembers(prev => {
        const updated = prev.filter(member => member.id !== id);
        localStorage.setItem('familyMembers', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('削除エラー:', error);
      // エラーでもローカルからは削除
      setFamilyMembers(prev => {
        const updated = prev.filter(member => member.id !== id);
        localStorage.setItem('familyMembers', JSON.stringify(updated));
        return updated;
      });
    }
  };

  // 健康記録を家族に共有する関数
  const shareHealthRecord = async () => {
    try {
      // 最新の健康記録を取得
      const healthRecords = localStorage.getItem('healthRecords');
      const profile = localStorage.getItem('profile_local');
      
      if (!healthRecords) {
        alert('共有する健康記録がありません。');
        return;
      }

      const records = JSON.parse(healthRecords);
      const profileData = profile ? JSON.parse(profile) : null;
      
      // 最新の記録日を取得
      const latestDate = Object.keys(records).sort().reverse()[0];
      const latestRecord = records[latestDate];
      
      if (!latestRecord) {
        alert('共有する記録がありません。');
        return;
      }

      // 共有メッセージを作成
      const shareMessage = `💖 健康記録の共有 💖

  ${profileData?.displayName || 'ユーザー'}さんからの健康記録です。

  📅 記録日: ${latestDate}
  ${profileData?.age ? `👤 年齢: ${profileData.age}歳` : ''}
  ${profileData?.gender ? `👤 性別: ${profileData.gender}` : ''}

  📊 最新の記録:
  ${latestRecord.morning ? `🌅 朝: 血圧 ${latestRecord.morning.bloodPressure.systolic}/${latestRecord.morning.bloodPressure.diastolic}mmHg, 脈拍 ${latestRecord.morning.pulse}回/分, 体重 ${latestRecord.morning.weight}kg` : ''}
  ${latestRecord.afternoon ? `☀️ 昼: 血圧 ${latestRecord.afternoon.bloodPressure.systolic}/${latestRecord.afternoon.bloodPressure.diastolic}mmHg, 脈拍 ${latestRecord.afternoon.pulse}回/分, 体重 ${latestRecord.afternoon.weight}kg` : ''}
  ${latestRecord.evening ? `🌙 夜: 血圧 ${latestRecord.evening.bloodPressure.systolic}/${latestRecord.evening.bloodPressure.diastolic}mmHg, 脈拍 ${latestRecord.evening.pulse}回/分, 体重 ${latestRecord.evening.weight}kg` : ''}

  心臓ちゃんより 💖`;

      // LINEで共有
      if (typeof window !== 'undefined' && window.liff) {
        if (window.liff.isInClient()) {
          await window.liff.shareTargetPicker([
            {
              type: 'text',
              text: shareMessage
            }
          ]);
          alert('健康記録を家族に共有しました！');
        } else {
          // ローカル環境でのテスト用
          console.log('Share message:', shareMessage);
          alert('健康記録の共有準備が完了しました！（テスト用）');
        }
      } else {
        // ローカル環境でのテスト用
        console.log('Share message:', shareMessage);
        alert('健康記録の共有準備が完了しました！（テスト用）');
      }
    } catch (error: unknown) {
      console.error('Share health record error:', error);
      alert('共有に失敗しました。');
    }
  };

  // 記録忘れ通知を送信する関数
  const sendReminderNotification = async () => {
    try {
      const reminderMessage = `⏰ 記録忘れ通知 ⏰

  今日の健康記録をまだ入力していません。

  血圧、脈拍、体重の記録を忘れずに入力してくださいね！

  心臓ちゃんより 💖`;

      if (typeof window !== 'undefined' && window.liff) {
        if (window.liff.isInClient()) {
          await window.liff.shareTargetPicker([
            {
              type: 'text',
              text: reminderMessage
            }
          ]);
          alert('記録忘れ通知を送信しました！');
        } else {
          console.log('Reminder message:', reminderMessage);
          alert('記録忘れ通知の準備が完了しました！（テスト用）');
        }
      } else {
        console.log('Reminder message:', reminderMessage);
        alert('記録忘れ通知の準備が完了しました！（テスト用）');
      }
    } catch (error: unknown) {
      console.error('Send reminder notification error:', error);
      alert('通知の送信に失敗しました。');
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
      {/* 🆕 LINEアプリ用スタイル */}
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
              家族共有設定
            </h1>
          </div>
          <NavigationBar />
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          {/* タイトル部分 */}
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">
              家族共有設定
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左側：家族メンバー */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                家族メンバー
              </h2>
              <button
                onClick={addFamilyMember}
                className="bg-green-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-600"
              >
                ➕ 追加
              </button>
            </div>
  
            <div className="space-y-4">
              {familyMembers.map((member) => (
                <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={() => removeFamilyMember(member.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      🗑️ 削除
                    </button>
                  </div>
                  
                  {/* 🆕 名前と LINE User ID を横並び（スマホでは縦） */}
                  <div className="flex flex-col md:flex-row gap-2 md:gap-3 mb-3">
                    {/* 名前 */}
                    <div className="flex-1">
                      <label className="block text-xs md:text-sm text-gray-600 mb-1">名前</label>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => updateFamilyMember(member.id, 'name', e.target.value)}
                        className="w-full px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="山田太郎"
                      />
                    </div>

                    {/* LINE User ID */}
                    <div className="flex-1">
                      <label className="block text-xs md:text-sm text-gray-600 mb-1">LINE User ID（自動送信用）</label>
                      <input
                        type="text"
                        value={member.lineUserId || ''}
                        onChange={(e) => updateFamilyMember(member.id, 'lineUserId', e.target.value)}
                        className="w-full px-2 md:px-3 py-1 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="U1234567890abcdef..."
                      />
                    </div>
                  </div>

                  {/* 説明文 */}
                  <p className="text-xs text-gray-500 mb-3">
                    LINE User IDを入力すると自動通知が可能になります
                  </p>

                  {/* 登録ボタン */}
                  <button
                    onClick={() => registerFamilyMember(member.id)}
                    disabled={!member.name || Boolean(member.isRegistered)}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-sm ${
                      Boolean(member.isRegistered)
                        ? 'bg-green-500 text-white cursor-not-allowed'
                        : member.name
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {Boolean(member.isRegistered) ? '登録済み' : 'LINEで招待'}
                  </button>
                </div>
              ))}
              
              {familyMembers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>家族メンバーが登録されていません</p>
                  <p className="text-sm">「追加」ボタンから家族メンバーを追加してください</p>
                </div>
              )}
            </div>
          </div>

          {/* 右側：共有設定 */}
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              共有設定
            </h2>
            
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5 text-orange-500" defaultChecked />
                <span className="text-gray-700">健康記録を自動共有</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5 text-orange-500" defaultChecked />
                <span className="text-gray-700">記録忘れの通知を送信</span>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5 text-orange-500" />
                <span className="text-gray-700">異常値の通知を送信</span>
              </label>
            </div>
            
            {/* 共有機能ボタン */}
            <div className="flex gap-2">
              <button
                onClick={shareHealthRecord}
                className="bg-blue-500 text-white py-2 px-3 rounded-lg font-medium hover:bg-blue-600 text-sm flex-1"
              >
                📊 共有
              </button>
              
              <button
                onClick={sendReminderNotification}
                className="bg-yellow-500 text-white py-2 px-3 rounded-lg font-medium hover:bg-yellow-600 text-sm flex-1"
              >
                ⏰ 通知
              </button>
            </div>
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="mt-4">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600"
          >
            設定を保存
          </button>
        </div>
      </main>
    </div>
  );
}