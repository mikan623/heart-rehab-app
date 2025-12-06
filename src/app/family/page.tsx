"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NavigationBar from "@/components/NavigationBar";
import { getSession, isLineLoggedIn, setLineLogin, setLineLoggedInDB } from "@/lib/auth";

// 家族メンバーの型定義
interface FamilyMember {
  id: string;
  name: string;
  email: string;
  relationship: string;
  lineUserId?: string;
  isRegistered: boolean; // string から boolean に変更
}

export default function FamilyPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🆕 追加：LINEミニアプリ最適化用の状態
  const [isLineApp, setIsLineApp] = useState(false);
  const [lineSafeArea, setLineSafeArea] = useState({ top: 0, bottom: 0 });

  // 家族用招待QRコード用の状態（全体用）
  const [inviteQrUrl, setInviteQrUrl] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // 認証チェック
  useEffect(() => {
    const session = getSession();
    
    // メールログインセッション優先
    if (session) {
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

  useEffect(() => {
    const initData = async () => {
      try {
        // メールログインセッションがある場合はLIFF初期化をスキップ
        const session = getSession();
        if (session) {
          console.log('📧 メールログイン検出: LIFF初期化をスキップ');
          setIsLoading(false);
          return;
        }

        // LIFF初期化処理
        if (typeof window !== 'undefined' && window.liff) {
          try {
            await window.liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID || '' });
            console.log('LIFF initialized successfully');
            
            // ログインチェック
            if (window.liff.isLoggedIn()) {
              const profile = await window.liff.getProfile();
              const userId = profile.userId;
              setCurrentUserId(userId);
              
              // 🆕 LINE ログイン状態をメモリに保存
              setLineLogin(userId, profile.displayName);
              console.log('✅ LINE ログイン状態をメモリに保存');
              
              // Supabase に保存（背景で実行、エラー無視）
              setLineLoggedInDB(userId, true, userId)
                .then(() => console.log('✅ LINE ログイン状態を Supabase に保存'))
                .catch((error) => console.error('⚠️ Supabase 保存失敗（無視）:', error));

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

  // 家族用招待QRコードを生成（家族メンバー共通）
  const generateFamilyInviteQr = async () => {
    try {
      if (!currentUserId) {
        alert('ユーザー情報の取得に失敗しました。もう一度ページを開き直してください。');
        return;
      }

      setGeneratingInvite(true);

      const response = await fetch('/api/family-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: currentUserId })
      });

      if (!response.ok) {
        console.error('❌ 招待リンク作成失敗:', response.status);
        alert('招待用QRコードの作成に失敗しました。時間をおいて再度お試しください。');
        return;
      }

      const data = await response.json();
      const inviteId = data.inviteId as string;

      // LIFF の URL を生成（LINE上で開く想定）
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      let inviteUrl = '';
      if (liffId) {
        inviteUrl = `https://liff.line.me/${liffId}?familyInviteId=${inviteId}`;
      } else if (typeof window !== 'undefined') {
        inviteUrl = `${window.location.origin}/family-invite?familyInviteId=${inviteId}`;
      }

      setInviteQrUrl(inviteUrl);

      console.log('✅ 家族招待URL生成:', inviteUrl);
    } catch (error) {
      console.error('❌ 招待QR生成エラー:', error);
      alert('招待用QRコードの作成に失敗しました。');
    } finally {
      setGeneratingInvite(false);
    }
  };

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

  // 家族メンバーを更新する関数（ローカルのみ）
  const updateFamilyMember = (id: string, field: keyof FamilyMember, value: string | boolean) => {
    // ローカルステートを更新するだけ（入力フォーム用）
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
  };

  // 家族メンバーを DB に保存する関数（手動保存）
  const saveFamilyMemberToDatabase = async (id: string) => {
    try {
      const member = familyMembers.find(m => m.id === id);
      if (!member) return;

      // バリデーション
      if (!member.name || !member.email) {
        alert('名前とメールアドレスを入力してください');
        return;
      }

      let userId = 'user-1';
      if (typeof window !== 'undefined' && window.liff && window.liff.isLoggedIn && window.liff.isLoggedIn()) {
        try {
          const profile = await window.liff.getProfile();
          userId = profile.userId;
        } catch (error) {
          console.log('⚠️ LIFF プロフィール取得エラー:', error);
        }
      }

      // 新規メンバーかどうかで POST/PATCH を分ける
      if (id.length <= 15) {
        // 新規メンバー → POST
        const response = await fetch('/api/family-members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            familyMember: member
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ 家族メンバーをデータベースに保存');
          
          // 一時的な ID を DB の ID に置き換え
          setFamilyMembers(prev => 
            prev.map(m => m.id === id ? { ...member, id: result.familyMember.id } : m)
          );
          alert('家族メンバーを追加しました！');
        } else {
          console.error('❌ 保存失敗:', response.status);
          alert('保存に失敗しました');
        }
      } else {
        // 既存メンバー → PATCH
        const response = await fetch('/api/family-members', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            memberId: id,
            name: member.name,
            email: member.email,
            relationship: member.relationship,
            lineUserId: member.lineUserId,
            isRegistered: member.isRegistered
          })
        });

        if (response.ok) {
          console.log('✅ 家族メンバーを更新しました');
          alert('更新しました！');
        } else {
          console.error('❌ 更新失敗:', response.status);
          alert('更新に失敗しました');
        }
      }
    } catch (error) {
      console.error('❌ エラー:', error);
      alert('エラーが発生しました');
    }
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
        email: '',
        relationship: '',
        isRegistered: false
      };
      
      // ローカルステートにも追加
      setFamilyMembers(prev => [...prev, newMember]);
      
      // 🆕 データベースには保存しない
      // （名前と メールアドレス が入力されたら updateFamilyMember で保存）
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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  // 認証されていない場合はローディング画面
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return isAuthenticated ? (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
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
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
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
        className={`p-4 md:p-6 space-y-6 ${isLineApp ? 'line-app-container' : ''}`}
        style={{
          paddingTop: isLineApp ? `${lineSafeArea.top}px` : '16px',
          paddingBottom: isLineApp ? `${lineSafeArea.bottom}px` : '16px',
          minHeight: isLineApp ? 'calc(var(--vh, 1vh) * 100)' : 'auto'
        }}
      >
        {/* 家族メンバー管理セクション */}
        <div className="bg-orange-50 rounded-lg border-2 border-orange-300 p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
              👨‍👩‍👧‍👦 家族メンバー
            </h2>
          </div>

          {/* 共通QRコード表示エリア：左 = 家族用招待QR / 右 = 公式アカウントQR */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-gray-800">家族用招待QRコード</p>
              {inviteQrUrl && (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                      inviteQrUrl
                    )}`}
                    alt="家族用招待QRコード"
                    className="w-40 h-40 bg-white p-2 rounded-lg border border-orange-200"
                  />
                </>
              )}
              <p className="text-xs text-gray-500 text-center break-all">
                「📱 家族用QRコードを表示」ボタンを押すと、ここに招待用QRコードが表示されます。
              </p>
              <button
                onClick={generateFamilyInviteQr}
                disabled={generatingInvite || !currentUserId}
                className="mt-1 py-2 px-4 rounded-lg font-semibold text-sm md:text-base border border-orange-400 text-orange-700 bg-white hover:bg-orange-50 disabled:opacity-60"
              >
                {generatingInvite ? 'QRコード生成中...' : '📱 家族用QRコードを表示'}
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">心臓リハビリ手帳 公式LINEアカウント</p>
              <img
                src="/line-official-qr.png"
                alt="心臓リハビリ手帳 公式LINEアカウント QRコード"
                className="w-40 h-40 bg-white p-2 rounded-lg border border-green-300"
              />
              <p className="text-xs text-gray-500 text-center">
                このQRコードをLINEアプリで読み取ると、心臓リハビリ手帳の公式アカウントを友だち追加できます。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {familyMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-lg border-2 border-orange-200 p-4 md:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">
                    {member.name || '（名前未設定）'}
                  </h3>
                  <button
                    onClick={() => removeFamilyMember(member.id)}
                    className="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 font-medium"
                  >
                    🗑️ 削除
                  </button>
                </div>

                {/* 名前 */}
                <div className="mb-4">
                  <label className="block text-lg font-semibold text-gray-700 mb-2">名前</label>
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateFamilyMember(member.id, 'name', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                    placeholder="山田太郎"
                  />
                </div>

                {/* メールアドレス */}
                <div className="mb-4">
                  <label className="block text-lg font-semibold text-gray-700 mb-2">メールアドレス</label>
                  <input
                    type="email"
                    value={member.email}
                    onChange={(e) => updateFamilyMember(member.id, 'email', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                    placeholder="example@email.com"
                  />
                </div>

                {/* 関係性 */}
                <div className="mb-4">
                  <label className="block text-lg font-semibold text-gray-700 mb-2">関係性</label>
                  <select
                    value={member.relationship}
                    onChange={(e) => updateFamilyMember(member.id, 'relationship', e.target.value)}
                    className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 font-semibold"
                  >
                    <option value="">選択してください</option>
                    <option value="配偶者">配偶者</option>
                    <option value="子供">子供</option>
                    <option value="親">親</option>
                    <option value="兄弟">兄弟</option>
                    <option value="姉妹">姉妹</option>
                    <option value="その他">その他</option>
                  </select>
                </div>

                {/* LINE User ID */}
                <div className="mb-4">
                  <label className="block text-lg font-semibold text-gray-700 mb-2">LINE User ID</label>
                  <input
                    type="text"
                    value={member.lineUserId || ''}
                    onChange={(e) => updateFamilyMember(member.id, 'lineUserId', e.target.value)}
                    className="w-full px-4 py-3 text-base border-2 border-orange-300 rounded-lg focus:outline-none focus:border-orange-500"
                    placeholder="U1234567890abcdef..."
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    💡 LINE User IDを入力すると自動通知が可能になります
                  </p>
                </div>

                {/* ボタングループ */}
                <div className="flex gap-3 flex-col md:flex-row">
                  {/* 保存ボタン（新規メンバーのみ） */}
                  {member.id.length <= 15 && (
                    <button
                      onClick={() => saveFamilyMemberToDatabase(member.id)}
                      disabled={!member.name || !member.email}
                      className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg ${
                        member.name && member.email
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      💾 保存
                    </button>
                  )}

                  {/* 登録ボタン */}
                  <button
                    onClick={() => registerFamilyMember(member.id)}
                    disabled={!member.name || !member.email || Boolean(member.isRegistered)}
                    className={`flex-1 py-3 px-4 rounded-lg font-bold text-lg ${
                      Boolean(member.isRegistered)
                        ? 'bg-green-500 text-white cursor-not-allowed'
                        : member.name && member.email
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {Boolean(member.isRegistered) ? '✅ 登録済み' : '🤝 LINEで招待'}
                  </button>
                </div>
              </div>
            ))}

            {familyMembers.length === 0 && (
              <div className="text-center py-12 bg-orange-100 rounded-lg">
                <p className="text-2xl font-bold text-gray-700 mb-2">家族メンバーが登録されていません</p>
                <p className="text-lg text-gray-600">「➕ 追加」ボタンから家族メンバーを追加してください</p>
              </div>
            )}
          </div>
        </div>

        {/* 共有設定セクション */}
        <div className="bg-blue-50 rounded-lg border-2 border-blue-300 p-4 md:p-6">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
            📤 共有設定
          </h2>

          <div className="space-y-4 mb-6">
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-50">
              <input type="checkbox" className="w-7 h-7 text-blue-500" defaultChecked />
              <span className="text-lg font-semibold text-gray-800">健康記録を自動共有</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-50">
              <input type="checkbox" className="w-7 h-7 text-blue-500" defaultChecked />
              <span className="text-lg font-semibold text-gray-800">記録忘れの通知を送信</span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-blue-200 cursor-pointer hover:bg-blue-50">
              <input type="checkbox" className="w-7 h-7 text-blue-500" />
              <span className="text-lg font-semibold text-gray-800">異常値の通知を送信</span>
            </label>
          </div>

          {/* 共有機能ボタン */}
          <div className="flex gap-3 flex-col md:flex-row">
            <button
              onClick={shareHealthRecord}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-4 rounded-lg font-bold text-lg hover:from-blue-600 hover:to-blue-700"
            >
              📊 健康記録を共有
            </button>

            <button
              onClick={sendReminderNotification}
              className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white py-4 px-4 rounded-lg font-bold text-lg hover:from-yellow-600 hover:to-yellow-700"
            >
              ⏰ 記録忘れ通知
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