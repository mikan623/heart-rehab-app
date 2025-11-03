"use client";
import { useState, useEffect } from "react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function NavigationBar() {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
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

  // PDF出力関数
  const exportToPDF = async () => {
    try {
      console.log('💾 PDF出力開始');

      // 印刷用のHTMLを作成
      const printContent = document.createElement('div');
      printContent.style.width = '794px'; // A4幅
      printContent.style.padding = '20px';
      printContent.style.fontFamily = 'Arial, sans-serif';
      printContent.style.fontSize = '12px';
      printContent.style.lineHeight = '1.4';
      
      // 🆕 データベースから健康記録を取得
      let saved: any = {};
      let profile: any = {};
      
      try {
        // LINEユーザーIDを取得
        let userId = 'user-1'; // デフォルト

        // ローカル環境ではLIFF機能をスキップ
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          try {
            if (typeof window !== 'undefined' && window.liff && window.liff.isLoggedIn && window.liff.isLoggedIn()) {
              const liffProfile = await window.liff.getProfile();
              userId = liffProfile.userId;
              console.log('✅ LIFFユーザーIDを取得:', userId);
            }
          } catch (error) {
            console.log('⚠️ LIFFユーザーID取得エラー、デフォルトを使用:', error);
            userId = 'user-1';
          }
        } else {
          console.log('🏠 ローカル環境: デフォルトユーザーIDを使用');
        }

        console.log('💾 NavigationBar: データベースからデータ取得を試行中', { userId }); // 🆕 ログ追加
        
        // データベースから健康記録を取得
        const healthResponse = await fetch(`/api/health-records?userId=${userId}`);
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log('✅ 健康記録をデータベースから取得');
          
          // データベースの形式をPDF用に変換
          healthData.records.forEach((record: any) => {
            const dateKey = record.date.split('T')[0];
            const timeKey = record.time;
            
            if (!saved[dateKey]) {
              saved[dateKey] = {};
            }
            
            saved[dateKey][timeKey] = {
              bloodPressure: {
                systolic: record.bloodPressure.systolic.toString(),
                diastolic: record.bloodPressure.diastolic.toString()
              },
              pulse: record.pulse?.toString() || '',
              weight: record.weight?.toString() || '',
              exercise: record.exercise || { type: '', duration: '' },
              meal: record.meal || {
                staple: '',
                mainDish: '',
                sideDish: '',
                other: ''
              },
              dailyLife: record.dailyLife || ''
            };
          });
        } else {
          console.log('❌ データベース取得失敗、localStorageを使用');
          saved = JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}');
        }
        
        // データベースからプロフィールを取得
        const profileResponse = await fetch(`/api/profiles?userId=${userId}`);
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.profile) {
            console.log('✅ プロフィールをデータベースから取得');
            profile = {
              displayName: profileData.profile.displayName,
              age: profileData.profile.age,
              gender: profileData.profile.gender,
              targetWeight: profileData.profile.targetWeight,
              diseases: profileData.profile.diseases,
              medications: profileData.profile.medications,
              physicalFunction: profileData.profile.physicalFunction,
              emergencyContact: profileData.profile.emergencyContact
            };
          } else {
            console.log('❌ プロフィールなし、localStorageを使用');
            profile = JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}');
          }
        } else {
          console.log('❌ プロフィール取得失敗、localStorageを使用');
          profile = JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}');
        }
      } catch (error) {
        console.error('データベースからの取得エラー、localStorageを使用:', error);
        saved = JSON.parse(localStorage.getItem(getStorageKey('healthRecords')) || '{}');
        profile = JSON.parse(localStorage.getItem(getStorageKey('profile')) || '{}');
      }
    
      // ヘッダー情報
      printContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #c2410c; font-size: 24px; margin: 0;">心臓リハビリ手帳</h1>
          <p style="margin: 5px 0; color: #666;">健康記録サマリー</p>
          <p style="margin: 0; color: #666;">作成日: ${new Date().toLocaleString('ja-JP')}</p>
        </div>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 8px;">
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 10px 0;">患者情報</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div><strong>お名前:</strong> ${profile.displayName || '未設定'}</div>
            <div><strong>年齢:</strong> ${profile.age || '未設定'}歳</div>
            <div><strong>性別:</strong> ${profile.gender || '未設定'}</div>
            <div><strong>目標体重:</strong> ${profile.targetWeight || '未設定'}kg</div>
          </div>
          ${profile.diseases?.length > 0 ? `<div><strong>基礎疾患:</strong> ${profile.diseases.join('、')}</div>` : ''}
          ${profile.medications ? `<div><strong>服用薬:</strong> ${profile.medications}</div>` : ''}
          ${profile.physicalFunction ? `<div><strong>身体機能・制限事項:</strong> ${profile.physicalFunction}</div>` : ''}
          ${profile.emergencyContact ? `<div><strong>緊急連絡先:</strong> ${profile.emergencyContact}</div>` : ''}
        </div>
        
        <div>
          <h2 style="color: #c2410c; font-size: 18px; margin: 0 0 15px 0;">健康記録</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">日付</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">時間</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">血圧</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">脈拍</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">体重</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">運動</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">食事</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">日常生活</th>
              </tr>
            </thead>
            <tbody id="records-table">
            </tbody>
          </table>
        </div>
      `;
      
      // 記録データを追加
      const tbody = printContent.querySelector('#records-table');
      const sortedDates = Object.keys(saved).sort();
      
      sortedDates.forEach(date => {
        const dayRecords = saved[date];
        const sortedTimes = Object.keys(dayRecords)
        .sort((a, b) => formatTime24h(a).localeCompare(formatTime24h(b)));
        
        sortedTimes.forEach(time => {
          const record = dayRecords[time];
          if (!record) return;
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="border: 1px solid #ddd; padding: 8px;">${date}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${formatTime24h(time)}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.bloodPressure?.systolic || ''}/${record.bloodPressure?.diastolic || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.pulse || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.weight || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.exercise?.type || ''} ${record.exercise?.duration || ''}分</td>
            <td style="border: 1px solid #ddd; padding: 8px;">主食:${record.meal?.staple || ''} 主菜:${record.meal?.mainDish || ''} 副菜:${record.meal?.sideDish || ''} 他:${record.meal?.other || ''}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${record.dailyLife || '-'}</td>
          `;
          tbody?.appendChild(row);
        });
      });
      
      // 一時的にDOMに追加
      document.body.appendChild(printContent);
      
      // HTMLをCanvasに変換
      const canvas = await html2canvas(printContent, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      // PDFを作成
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgWidth = 210; // A4幅
      const pageHeight = 295; // A4高さ
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // PDFをダウンロード
      pdf.save(`心臓リハビリ手帳_${new Date().toISOString().slice(0,10)}.pdf`);
      
      // 一時要素を削除
      document.body.removeChild(printContent);

      console.log('✅ NavigationBar: PDF出力完了'); // 🆕 ログ追加
      
    } catch (error) {
      console.error('PDF出力エラー:', error);
      alert('PDF出力に失敗しました。');
    }
  };

  // 設定メニューを閉じる
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

  return (
    <div className="flex gap-1">
      <button 
        onClick={() => window.location.href = '/'}
        className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
        健康記録
      </button>
      <button 
        onClick={() => window.location.href = '/calendar'}
        className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
        カレンダー
      </button>
      <button 
        onClick={() => window.location.href = '/profile'}
        className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
        プロフィール
      </button>
      <button 
        onClick={() => window.location.href = '/graph'}
        className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
        グラフ
      </button>
      <button 
        onClick={() => window.location.href = '/family'}
        className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
        家族
      </button>
      <div className="relative">
        <button 
          onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          className="bg-white border border-orange-300 text-orange-700 py-1 px-2 rounded-lg font-medium hover:bg-orange-50 text-xs">
          設定
        </button>
 
        {/* ドロップダウンメニュー */}
        {showSettingsMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="py-1">
              <button
                onClick={() => {
                  window.location.href = '/terms';
                  setShowSettingsMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                利用規約
              </button>
              <button 
                onClick={exportHealthData}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                医療機関用エクスポート
              </button>
              <button
                onClick={() => {
                  exportToPDF();
                  setShowSettingsMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                PDF印刷
              </button>
            </div>
          </div>
        )}
      </div>
    </div>  
  );
}