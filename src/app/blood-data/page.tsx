'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import NavigationBar from '@/components/NavigationBar';
import { getSession, isLineLoggedIn } from '@/lib/auth';
import { HealthRecordIcon, CalendarIcon, GraphIcon, FamilyIcon, SettingsIcon, TestIcon } from '@/components/NavIcons';

// 学ぶアイコン
const LearnIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 7V12C2 16.55 3.84 20.74 6.78 23.9C7.94 25.08 9.23 26.01 10.58 26.72C11.04 26.97 11.51 27.19 12 27.38C12.49 27.19 12.96 26.97 13.42 26.72C14.77 26.01 16.06 25.08 17.22 23.9C20.16 20.74 22 16.55 22 12V7L12 2M12 4.18L20 7.5V12C20 16.88 18.72 21.24 16.54 24.8C15.84 25.56 15.09 26.25 14.3 26.87C13.41 26.47 12.56 25.97 11.76 25.38C10.97 24.8 10.25 24.12 9.59 23.4C7.78 21.08 6.54 18.16 6.05 15H12V13H6.05V12C6.05 9.85 6.58 7.82 7.51 6.06C8.45 4.29 9.74 2.84 11.25 1.84V4.18H12Z" />
  </svg>
);

interface BloodValues {
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
}

interface CPXTest {
  id?: string;
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
}

interface BloodData {
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
  cpxTests: CPXTest[];
  createdAt: string;
}

export default function BloodDataPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bloodDataList, setBloodDataList] = useState<BloodData[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // ページモード: 'list' | 'new' | 'edit'
  const [pageMode, setPageMode] = useState<'list' | 'new' | 'edit'>('list');
  const [recordType, setRecordType] = useState<'blood' | 'cpx' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 入力フォーム
  const [testDate, setTestDate] = useState<string>('');
  const [bloodValues, setBloodValues] = useState<BloodValues>({
    hbA1c: null,
    randomBloodSugar: null,
    totalCholesterol: null,
    triglycerides: null,
    hdlCholesterol: null,
    ldlCholesterol: null,
    bun: null,
    creatinine: null,
    uricAcid: null,
    hemoglobin: null,
    bnp: null,
  });
  const [cpxTests, setCpxTests] = useState<CPXTest[]>([
    {
      testDate: '',
      cpxRound: 1,
      atOneMinBefore: null,
      atDuring: null,
      maxLoad: null,
      loadWeight: null,
      vo2: null,
      mets: null,
      heartRate: null,
      systolicBloodPressure: null,
      findings: null,
    }
  ]);

  // CPX記録モードでは、上の検査日を各CPXに自動適用（下の検査日入力は不要）
  useEffect(() => {
    if (!testDate) return;
    if (recordType !== 'cpx') return;
    setCpxTests((prev) =>
      prev.map((t) => ({
        ...t,
        testDate,
      }))
    );
  }, [testDate, recordType]);

  const hasAnyBloodValue = (item: BloodData) => {
    return (
      item.hbA1c !== null ||
      item.randomBloodSugar !== null ||
      item.totalCholesterol !== null ||
      item.triglycerides !== null ||
      item.hdlCholesterol !== null ||
      item.ldlCholesterol !== null ||
      item.bun !== null ||
      item.creatinine !== null ||
      item.uricAcid !== null ||
      item.hemoglobin !== null ||
      item.bnp !== null
    );
  };

  type CPXCardItem = CPXTest & { bloodDataId: string; parentCreatedAt: string };

  const bloodCards = bloodDataList.filter(hasAnyBloodValue);
  const cpxCards: CPXCardItem[] = bloodDataList
    .flatMap((bd) =>
      (bd.cpxTests || []).map((cpx) => ({
        ...cpx,
        bloodDataId: bd.id,
        parentCreatedAt: bd.createdAt,
      }))
    )
    .sort((a, b) => {
      const da = a.testDate || '';
      const db = b.testDate || '';
      if (da !== db) return db.localeCompare(da); // testDate desc
      return (b.cpxRound ?? 0) - (a.cpxRound ?? 0);
    });

  const openCpxEditByBloodDataId = (bloodDataId: string) => {
    const parent = bloodDataList.find((b) => b.id === bloodDataId);
    if (parent) handleEditCPX(parent);
  };

  // 認証チェック
  useEffect(() => {
    const session = getSession();
    
    // メールログインセッション優先（LINE ログインより優先）
    if (session) {
      setUserId(session.userId);
      setIsAuthenticated(true);
      setIsLoading(false);
      return;
    }

    // メールログインセッションがない場合のみ LINE ログインをチェック
    const lineLoggedIn = isLineLoggedIn();
    if (!lineLoggedIn) {
      // ログインしていない場合はランディングページへ
      router.push('/');
      setIsLoading(false);
      return;
    }

    // LINE ログインユーザーの場合、ユーザーIDをローカルストレージから取得
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
      setIsAuthenticated(true);
    }
    
    setIsLoading(false);
  }, [router]);

  // 血液データリストを取得
  useEffect(() => {
    if (userId) {
      fetchBloodDataList();
    }
  }, [userId]);

  const fetchBloodDataList = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/blood-data?userId=${userId}`);
      const data = await response.json();
      setBloodDataList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('血液データ取得エラー:', error);
    }
  };

  const resetForm = () => {
    setTestDate('');
    setBloodValues({
      hbA1c: null,
      randomBloodSugar: null,
      totalCholesterol: null,
      triglycerides: null,
      hdlCholesterol: null,
      ldlCholesterol: null,
      bun: null,
      creatinine: null,
      uricAcid: null,
      hemoglobin: null,
      bnp: null,
    });
    setCpxTests([
      {
        testDate: '',
        cpxRound: 1,
        atOneMinBefore: null,
        atDuring: null,
        maxLoad: null,
        loadWeight: null,
        vo2: null,
        mets: null,
        heartRate: null,
        systolicBloodPressure: null,
        findings: null,
      }
    ]);
  };

  const handleSave = async () => {
    if (!testDate || !userId) {
      alert('検査日を入力してください');
      return;
    }

    setSaveStatus('saving');
    try {
      const payload = {
        mode: recordType || 'blood',
        userId,
        testDate,
        ...(recordType === 'cpx'
          ? { cpxTests: cpxTests.filter(t => t.testDate) } // CPXのみ
          : { bloodValues, cpxTests: cpxTests.filter(t => t.testDate) }), // 互換: blood側でもCPX送信は許可
      };

      const method = pageMode === 'edit' ? 'PUT' : 'POST';
      const url = pageMode === 'edit' ? `/api/blood-data` : `/api/blood-data`;
      const body = pageMode === 'edit' ? { ...payload, id: editingId } : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error('保存に失敗しました');

      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
        resetForm();
        setPageMode('list');
        fetchBloodDataList();
      }, 1500);
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました');
      setSaveStatus('idle');
    }
  };

  const handleEdit = (bloodData: BloodData) => {
    setEditingId(bloodData.id);
    setTestDate(bloodData.testDate);
    // 編集は従来通り「血液データ（＋CPX）」編集として扱う（必要なら後で分割導線も追加）
    setRecordType('blood');
    setBloodValues({
      hbA1c: bloodData.hbA1c,
      randomBloodSugar: bloodData.randomBloodSugar,
      totalCholesterol: bloodData.totalCholesterol,
      triglycerides: bloodData.triglycerides,
      hdlCholesterol: bloodData.hdlCholesterol,
      ldlCholesterol: bloodData.ldlCholesterol,
      bun: bloodData.bun,
      creatinine: bloodData.creatinine,
      uricAcid: bloodData.uricAcid,
      hemoglobin: bloodData.hemoglobin,
      bnp: bloodData.bnp,
    });
    setCpxTests(bloodData.cpxTests || [{
      testDate: '',
      cpxRound: 1,
      atOneMinBefore: null,
      atDuring: null,
      maxLoad: null,
      loadWeight: null,
      vo2: null,
      mets: null,
      heartRate: null,
      systolicBloodPressure: null,
      findings: null,
    }]);
    setPageMode('edit');
  };

  // 運動負荷試験（CPX）の編集として開く
  const handleEditCPX = (bloodData: BloodData) => {
    setEditingId(bloodData.id);
    setTestDate(bloodData.testDate);
    setRecordType('cpx');
    // 血液値は保持（画面では非表示だが将来の切替用）
    setBloodValues({
      hbA1c: bloodData.hbA1c,
      randomBloodSugar: bloodData.randomBloodSugar,
      totalCholesterol: bloodData.totalCholesterol,
      triglycerides: bloodData.triglycerides,
      hdlCholesterol: bloodData.hdlCholesterol,
      ldlCholesterol: bloodData.ldlCholesterol,
      bun: bloodData.bun,
      creatinine: bloodData.creatinine,
      uricAcid: bloodData.uricAcid,
      hemoglobin: bloodData.hemoglobin,
      bnp: bloodData.bnp,
    });
    setCpxTests(
      bloodData.cpxTests && bloodData.cpxTests.length > 0
        ? bloodData.cpxTests
        : [
            {
              testDate: bloodData.testDate,
              cpxRound: 1,
              atOneMinBefore: null,
              atDuring: null,
              maxLoad: null,
              loadWeight: null,
              vo2: null,
              mets: null,
              heartRate: null,
              systolicBloodPressure: null,
              findings: null,
            },
          ]
    );
    setPageMode('edit');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('この検査データを削除しますか？（運動負荷試験も一緒に削除されます）')) return;
    try {
      const res = await fetch(`/api/blood-data?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      await fetchBloodDataList();
    } catch (e) {
      console.error('削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  const handleDeleteCPX = async (cpxId: string) => {
    if (!confirm('この運動負荷試験（CPX）を削除しますか？')) return;
    try {
      const res = await fetch(`/api/blood-data?cpxId=${encodeURIComponent(cpxId)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      await fetchBloodDataList();
    } catch (e) {
      console.error('CPX削除エラー:', e);
      alert('削除に失敗しました');
    }
  };

  const handleAddCPXRow = () => {
    const nextRound = Math.max(...cpxTests.map(t => t.cpxRound), 0) + 1;
    setCpxTests([...cpxTests, {
      testDate: '',
      cpxRound: nextRound,
      atOneMinBefore: null,
      atDuring: null,
      maxLoad: null,
      loadWeight: null,
      vo2: null,
      mets: null,
      heartRate: null,
      systolicBloodPressure: null,
      findings: null,
    }]);
  };

  const handleRemoveCPXRow = (index: number) => {
    setCpxTests(cpxTests.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm px-4 py-4">
        {/* タイトル */}
        <div className="max-w-6xl mx-auto mb-3">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">血液検査データ</h1>
          <p className="text-sm text-gray-600">検査結果を記録・管理します</p>
        </div>

        {/* PC版ナビゲーション（右側）*/}
        <div className="hidden md:block">
          <div className="max-w-6xl mx-auto flex justify-end">
            <nav className="flex gap-2 flex-wrap justify-end">
            <button 
              onClick={() => window.location.href = '/health-records'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <HealthRecordIcon className="w-5 h-5" />
              <span className="text-[10px]">健康記録</span>
            </button>
            <button 
              onClick={() => window.location.href = '/calendar'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-[10px]">カレンダー</span>
            </button>
            <button 
              onClick={() => window.location.href = '/learn'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <LearnIcon className="w-5 h-5" />
              <span className="text-[10px]">学ぶ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/blood-data'}
              className="flex flex-col items-center gap-0.5 bg-orange-400 text-white border border-orange-400 py-1 px-2 rounded-lg font-medium text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <TestIcon className="w-5 h-5" />
              <span className="text-[10px]">検査</span>
            </button>
            <button 
              onClick={() => window.location.href = '/graph'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <GraphIcon className="w-5 h-5" />
              <span className="text-[10px]">グラフ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/family'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px]">
              <FamilyIcon className="w-5 h-5" />
              <span className="text-[10px]">家族</span>
            </button>
            <button 
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs whitespace-nowrap flex-shrink-0 min-w-[50px] relative">
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px]">メニュー</span>
            </button>
            </nav>
          </div>
        </div>

        {/* スマホ版ナビゲーション（MD未満） */}
        <nav className="md:hidden flex gap-1 overflow-x-auto whitespace-nowrap">
            <button 
              onClick={() => window.location.href = '/health-records'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <HealthRecordIcon className="w-5 h-5" />
              <span className="text-[10px]">健康記録</span>
            </button>
            <button 
              onClick={() => window.location.href = '/calendar'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <CalendarIcon className="w-5 h-5" />
              <span className="text-[10px]">カレンダー</span>
            </button>
            <button 
              onClick={() => window.location.href = '/learn'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <LearnIcon className="w-5 h-5" />
              <span className="text-[10px]">学ぶ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/blood-data'}
              className="flex flex-col items-center gap-0.5 bg-orange-400 text-white border border-orange-400 py-1 px-2 rounded-lg font-medium text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <TestIcon className="w-5 h-5" />
              <span className="text-[10px]">検査</span>
            </button>
            <button 
              onClick={() => window.location.href = '/graph'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <GraphIcon className="w-5 h-5" />
              <span className="text-[10px]">グラフ</span>
            </button>
            <button 
              onClick={() => window.location.href = '/family'}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px]">
              <FamilyIcon className="w-5 h-5" />
              <span className="text-[10px]">家族</span>
            </button>
            <button 
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="flex flex-col items-center gap-0.5 bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-[10px] whitespace-nowrap flex-shrink-0 min-w-[44px] relative">
              <SettingsIcon className="w-5 h-5" />
              <span className="text-[10px]">メニュー</span>
            </button>
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* メインコンテンツ */}

        {/* メインコンテンツ */}

        {/* リスト表示 */}
        {pageMode === 'list' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => {
                  resetForm();
                  setRecordType('blood');
                  setPageMode('new');
                }}
                className="w-full bg-gradient-to-r from-orange-400 to-pink-400 text-white font-bold py-3 px-4 rounded-lg hover:from-orange-500 hover:to-pink-500 transition-all duration-200 click-animate"
              >
                🩸 血液検査データを記録する
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setRecordType('cpx');
                  setPageMode('new');
                }}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 click-animate"
              >
                🏃 運動負荷試験のデータを記録する
              </button>
            </div>

            <div className="space-y-4">
              {/* 血液検査データ */}
              <div className="bg-white/60 rounded-lg p-4 border border-orange-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3">🩸 血液検査データ</h3>
                {bloodCards.length === 0 ? (
                  <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                    血液検査データがまだ登録されていません
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bloodCards.map((item) => (
                      <div key={`blood_${item.id}`} className="bg-white rounded-lg p-6 shadow-md">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-gray-800">
                              {new Date(item.testDate).toLocaleDateString('ja-JP')}
                            </h4>
                            <p className="text-sm text-gray-500">
                              登録日時: {new Date(item.createdAt).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-all duration-200 click-animate text-sm"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                            >
                              削除
                            </button>
                          </div>
                        </div>

                        {/* 代表値サマリ */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {item.hbA1c !== null && (
                            <div>
                              <span className="text-gray-600">HbA1c:</span>
                              <span className="font-bold ml-2">{item.hbA1c}%</span>
                            </div>
                          )}
                          {item.randomBloodSugar !== null && (
                            <div>
                              <span className="text-gray-600">随時血糖:</span>
                              <span className="font-bold ml-2">{item.randomBloodSugar}mg/dL</span>
                            </div>
                          )}
                          {item.totalCholesterol !== null && (
                            <div>
                              <span className="text-gray-600">総コレステロール:</span>
                              <span className="font-bold ml-2">{item.totalCholesterol}mg/dL</span>
                            </div>
                          )}
                          {item.bnp !== null && (
                            <div>
                              <span className="text-gray-600">BNP:</span>
                              <span className="font-bold ml-2">{item.bnp}pg/mL</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 運動負荷試験（CPX）データ */}
              <div className="bg-white/60 rounded-lg p-4 border border-blue-100">
                <h3 className="text-lg font-bold text-gray-800 mb-3">🏃 運動負荷試験データ</h3>
                {cpxCards.length === 0 ? (
                  <div className="bg-white rounded-lg p-6 text-center text-gray-500">
                    運動負荷試験データがまだ登録されていません
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cpxCards.map((cpx, idx) => (
                      <div
                        key={`cpx_${cpx.id || `${cpx.bloodDataId}_${cpx.cpxRound}_${idx}`}`}
                        className="bg-white rounded-lg p-6 shadow-md"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-bold text-gray-800">
                              {cpx.testDate ? new Date(cpx.testDate).toLocaleDateString('ja-JP') : '日付未設定'} / CPX #{cpx.cpxRound}
                            </h4>
                            <p className="text-sm text-gray-500">
                              登録日時: {new Date(cpx.parentCreatedAt).toLocaleString('ja-JP')}
                            </p>
                          </div>
                          <button
                            onClick={() => openCpxEditByBloodDataId(cpx.bloodDataId)}
                            className="bg-indigo-500 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition-all duration-200 click-animate text-sm"
                          >
                            編集
                          </button>
                          {cpx.id && (
                            <button
                              onClick={() => handleDeleteCPX(cpx.id!)}
                              className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                            >
                              削除
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                          {cpx.loadWeight !== null && <div><span className="text-gray-600">負荷:</span><span className="font-bold ml-2">{cpx.loadWeight}W</span></div>}
                          {cpx.vo2 !== null && <div><span className="text-gray-600">VO2:</span><span className="font-bold ml-2">{cpx.vo2}</span></div>}
                          {cpx.mets !== null && <div><span className="text-gray-600">Mets:</span><span className="font-bold ml-2">{cpx.mets}</span></div>}
                          {cpx.heartRate !== null && <div><span className="text-gray-600">心拍:</span><span className="font-bold ml-2">{cpx.heartRate}bpm</span></div>}
                          {cpx.systolicBloodPressure !== null && <div><span className="text-gray-600">収縮期血圧:</span><span className="font-bold ml-2">{cpx.systolicBloodPressure}mmHg</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* 入力・編集フォーム */}
        {(pageMode === 'new' || pageMode === 'edit') && (
          <div className="bg-white rounded-lg p-6 shadow-md">
            <div className="flex items-start justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {pageMode === 'new'
                  ? ((recordType || 'blood') === 'cpx' ? '運動負荷試験データ新規登録' : '血液検査データ新規登録')
                  : '血液データ編集'}
              </h2>
              <div className="flex items-center gap-2">
                {pageMode === 'edit' && editingId && (
                  <button
                    onClick={() => {
                      handleDelete(editingId);
                      resetForm();
                      setRecordType(null);
                      setPageMode('list');
                    }}
                    className="bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                  >
                    削除
                  </button>
                )}
                <button
                  onClick={() => {
                    resetForm();
                    setRecordType(null);
                    setPageMode('list');
                  }}
                  className="text-gray-500 hover:text-gray-700 font-bold"
                >
                  ✕ キャンセル
                </button>
              </div>
            </div>

            {/* 検査日 */}
            <div className="mb-6">
              <label className="block text-gray-700 font-bold mb-2">検査日 *</label>
              <input
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full px-4 py-2 border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* 血液検査結果 */}
            {(recordType || 'blood') !== 'cpx' && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">検査結果</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* HbA1c */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">HbA1c (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.hbA1c || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, hbA1c: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="4.3～5.8"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* 随時血糖 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">随時血糖 (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={bloodValues.randomBloodSugar || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, randomBloodSugar: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="140未満"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* 総コレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">総コレステロール (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={bloodValues.totalCholesterol || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, totalCholesterol: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="130～220"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* 中性脂肪 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">中性脂肪 (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={bloodValues.triglycerides || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, triglycerides: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="30～150"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* HDLコレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">HDLコレステロール (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={bloodValues.hdlCholesterol || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, hdlCholesterol: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="40～100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* LDLコレステロール */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">LDLコレステロール (mg/dL)</label>
                  <input
                    type="number"
                    step="1"
                    value={bloodValues.ldlCholesterol || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, ldlCholesterol: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="70～139"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* BUN */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">BUN (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.bun || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, bun: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="8～20"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* Cr (クレアチニン) */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">Cr (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.creatinine || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, creatinine: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0.3～0.8"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* 尿酸 */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">尿酸 (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.uricAcid || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, uricAcid: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="2.6～6"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* ヘモグロビン */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">ヘモグロビン (mg/dL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.hemoglobin || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, hemoglobin: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="12～18"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                {/* BNP */}
                <div>
                  <label className="block text-gray-600 text-sm mb-1">BNP (pg/mL)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bloodValues.bnp || ''}
                    onChange={(e) => setBloodValues({ ...bloodValues, bnp: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="18以下"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
            )}

            {/* 運動負荷試験データ */}
            {(recordType || 'blood') !== 'blood' && (
            <div className="mb-6">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">運動負荷試験と運動処方の記録</h3>
              </div>

              <div className="space-y-4">
                {cpxTests.map((cpx, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-gray-800">CPX #{cpx.cpxRound}</h4>
                      {cpxTests.length > 1 && (
                        <button
                          onClick={() => handleRemoveCPXRow(index)}
                          className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition-all duration-200 click-animate text-sm"
                        >
                          削除
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* 検査日は上の「検査日」を使用（ここは表示のみ） */}
                      <div className="md:col-span-2">
                        <p className="text-sm text-gray-600">
                          検査日: <span className="font-bold text-gray-800">{testDate ? new Date(testDate).toLocaleDateString('ja-JP') : '未入力'}</span>
                        </p>
                      </div>

                      {/* AT1分前 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">AT1分前</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cpx.atOneMinBefore || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].atOneMinBefore = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* AT中 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">AT中</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cpx.atDuring || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].atDuring = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* 最大負荷時 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">最大負荷時</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cpx.maxLoad || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].maxLoad = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* 負荷量(W) */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">負荷量 (W)</label>
                        <input
                          type="number"
                          step="1"
                          value={cpx.loadWeight || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].loadWeight = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* VO2 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">VO2 (ml/min/kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cpx.vo2 || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].vo2 = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* Mets */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">Mets</label>
                        <input
                          type="number"
                          step="0.1"
                          value={cpx.mets || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].mets = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* 心拍数 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">心拍数 (bpm)</label>
                        <input
                          type="number"
                          step="1"
                          value={cpx.heartRate || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].heartRate = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* 収縮期血圧 */}
                      <div>
                        <label className="block text-gray-600 text-sm mb-1">収縮期血圧 (mmHg)</label>
                        <input
                          type="number"
                          step="1"
                          value={cpx.systolicBloodPressure || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].systolicBloodPressure = e.target.value ? parseFloat(e.target.value) : null;
                            setCpxTests(newCpxTests);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        />
                      </div>

                      {/* 所見 */}
                      <div className="md:col-span-2">
                        <label className="block text-gray-600 text-sm mb-1">所見</label>
                        <textarea
                          value={cpx.findings || ''}
                          onChange={(e) => {
                            const newCpxTests = [...cpxTests];
                            newCpxTests[index].findings = e.target.value || null;
                            setCpxTests(newCpxTests);
                          }}
                          placeholder="所見やメモを入力..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* 操作ボタン */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                className={`flex-1 font-bold py-3 px-4 rounded-lg transition-all duration-200 click-animate text-white ${
                  saveStatus === 'saving'
                    ? 'bg-yellow-500 save-saving'
                    : saveStatus === 'saved'
                    ? 'bg-green-500 save-saved'
                    : 'bg-gradient-to-r from-orange-400 to-pink-400 hover:from-orange-500 hover:to-pink-500'
                }`}
              >
                {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '保存済' : '保存する'}
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setPageMode('list');
                }}
                className="flex-1 bg-gray-400 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-500 transition-all duration-200 click-animate"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

