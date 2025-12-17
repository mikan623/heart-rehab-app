'use client';

import React, { useState } from 'react';

interface Patient {
  userId: string;
  displayName: string | null;
  age: number | null;
  gender: string | null;
  email: string | null;
}

interface HealthRecord {
  id: string;
  date: string;
  time: string;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  pulse: number | null;
  weight: number | null;
  exercise: any;
  meal: any;
  dailyLife: string | null;
  medicationTaken: boolean | null;
  createdAt: string;
}

const MedicalPage: React.FC = () => {
  const [searchName, setSearchName] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const keyword = searchName.trim();
    if (!keyword) {
      setPatients([]);
      setSelectedPatient(null);
      setRecords([]);
      return;
    }

    try {
      setSearching(true);
      setSelectedPatient(null);
      setRecords([]);

      const res = await fetch(`/api/medical/patients?name=${encodeURIComponent(keyword)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '患者検索に失敗しました');
        setPatients([]);
        return;
      }

      setPatients(data.patients || []);
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
      setPatients([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setError(null);
    setRecords([]);

    try {
      setLoadingRecords(true);
      const res = await fetch(`/api/health-records?userId=${encodeURIComponent(patient.userId)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '健康記録の取得に失敗しました');
        return;
      }

      setRecords(data.records || []);
    } catch (err) {
      console.error(err);
      setError('通信エラーが発生しました');
    } finally {
      setLoadingRecords(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
          医療従事者用 患者検索・健康記録一覧
        </h1>

        <p className="text-sm md:text-base text-gray-600 mb-4">
          患者さんのお名前を入力して検索すると、その患者さんの健康記録一覧を確認できます。
        </p>

        <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            患者名で検索
          </label>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="例）山田太郎"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-400 bg-white"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-pink-500 text-white text-sm md:text-base font-semibold shadow-sm hover:bg-pink-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {searching ? '検索中…' : '検索する'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            フルネームだけでなく、苗字や名前の一部でも検索できます。
          </p>
        </form>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* 左：患者一覧 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">患者一覧</h2>

            {patients.length === 0 && !searching && (
              <p className="text-sm text-gray-500">まだ検索結果がありません。</p>
            )}

            {patients.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {patients.map((patient) => (
                  <li
                    key={patient.userId}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm md:text-base font-medium text-gray-900">
                        {patient.displayName || '名前未登録'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {patient.age != null ? `${patient.age}歳` : '年齢未登録'} /{' '}
                        {patient.gender || '性別未登録'}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {patient.email}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectPatient(patient)}
                      className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-pink-400 text-pink-600 text-xs md:text-sm font-semibold hover:bg-pink-50"
                    >
                      記録を見る
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 右：健康記録一覧 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">健康記録一覧</h2>

            {!selectedPatient && (
              <p className="text-sm text-gray-500">
                左の一覧から患者さんを選択すると、ここに健康記録が表示されます。
              </p>
            )}

            {selectedPatient && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-900">
                  {selectedPatient.displayName || '名前未登録'} さんの記録
                </p>
                <p className="text-xs text-gray-500">
                  {selectedPatient.age != null ? `${selectedPatient.age}歳` : '年齢未登録'} /{' '}
                  {selectedPatient.gender || '性別未登録'}
                </p>
              </div>
            )}

            {loadingRecords && (
              <p className="text-sm text-gray-500">健康記録を読み込み中です…</p>
            )}

            {!loadingRecords && selectedPatient && records.length === 0 && (
              <p className="text-sm text-gray-500">まだ健康記録が登録されていません。</p>
            )}

            {!loadingRecords && records.length > 0 && (
              <div className="max-h-96 overflow-y-auto space-y-3">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className="border border-gray-200 rounded-lg p-3 text-xs md:text-sm bg-gray-50"
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-semibold text-gray-800">
                        {record.date} {record.time}
                      </span>
                      {record.medicationTaken && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] md:text-xs font-semibold">
                          服薬済み
                        </span>
                      )}
                    </div>
                    <p className="text-gray-800">
                      🩺 血圧: {record.bloodPressure?.systolic}/{record.bloodPressure?.diastolic} mmHg
                    </p>
                    <p className="text-gray-800">
                      💓 脈拍: {record.pulse != null ? `${record.pulse} 回/分` : '-'}
                    </p>
                    <p className="text-gray-800">
                      ⚖️ 体重: {record.weight != null ? `${record.weight} kg` : '-'}
                    </p>
                    {record.exercise && (
                      <p className="text-gray-800">
                        🏃‍♀️ 運動: {(record.exercise as any).type || '-'}{' '}
                        {(record.exercise as any).duration
                          ? `(${(record.exercise as any).duration})`
                          : ''}
                      </p>
                    )}
                    {record.meal && (
                      <p className="text-gray-800">
                        🍽 食事:{' '}
                        {[
                          (record.meal as any).staple,
                          (record.meal as any).mainDish,
                          (record.meal as any).sideDish,
                          (record.meal as any).other,
                        ]
                          .flat()
                          .filter(Boolean)
                          .join('、') || '-'}
                      </p>
                    )}
                    {record.dailyLife && (
                      (() => {
                        const symptomsMatch = record.dailyLife.match(/【症状】([^【]*)/);
                        const memoMatch = record.dailyLife.match(/【メモ】(.*)/);
                        const symptoms = symptomsMatch ? symptomsMatch[1].trim() : '';
                        const memo = memoMatch ? memoMatch[1].trim() : '';
                        
                        return (
                          <>
                            {symptoms && (
                              <p className="text-gray-800">
                                💭 自覚症状: {symptoms}
                              </p>
                            )}
                            {memo && (
                              <p className="text-gray-800">
                                📝 その他: {memo}
                              </p>
                            )}
                          </>
                        );
                      })()
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalPage;


