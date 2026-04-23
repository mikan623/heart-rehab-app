"use client";

import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { usePathname } from "next/navigation";

type DriverInstance = ReturnType<typeof driver>;

const tourSteps: Record<string, DriveStep[]> = {
  "/health-records": [
    {
      element: "#tour-health-date",
      popover: {
        title: "📅 記録する日付・時間帯を選ぶ",
        description: "今日の日付と、朝・昼・夜の時間帯を選んでから記録を始めましょう。",
        side: "bottom",
      },
    },
    {
      element: "#tour-health-bp",
      popover: {
        title: "🩺 血圧を入力する",
        description: "上の血圧（収縮期）と下の血圧（拡張期）を入力します。単位はmmHgです。",
        side: "bottom",
      },
    },
    {
      element: "#tour-health-pulse",
      popover: {
        title: "💓 脈拍を入力する",
        description: "1分間の脈拍数を入力します。",
        side: "bottom",
      },
    },
    {
      element: "#tour-health-weight",
      popover: {
        title: "⚖️ 体重を入力する",
        description: "体重をkgで入力します。毎日同じ時間に測ると変化が分かりやすくなります。",
        side: "bottom",
      },
    },
    {
      element: "#tour-health-exercise",
      popover: {
        title: "🚶 運動を記録する",
        description: "今日した運動の種類と時間を選びましょう。ウォーキングや体操など選べます。",
        side: "top",
      },
    },
    {
      element: "#tour-health-meal",
      popover: {
        title: "🍱 食事を記録する",
        description: "今日の食事内容を選びましょう。主食・主菜・副菜・その他から選べます。",
        side: "top",
      },
    },
    {
      element: "#tour-health-medication",
      popover: {
        title: "💊 服薬確認",
        description: "今日の薬を飲んだかチェックしましょう。朝・昼・夜ごとに記録できます。",
        side: "top",
      },
    },
    {
      element: "#tour-health-save",
      popover: {
        title: "✅ 記録を保存する",
        description: "入力が終わったら「保存する」ボタンを押しましょう。家族へのLINE通知も送られます。",
        side: "top",
      },
    },
    {
      element: "#tour-health-pdf",
      popover: {
        title: "📄 PDF出力",
        description: "記録をPDFにして印刷できます。受診時に医師に見せるときに便利です。",
        side: "top",
      },
    },
  ],

  "/calendar": [
    {
      element: "#tour-calendar-nav",
      popover: {
        title: "📅 月を切り替える",
        description: "「＜」「＞」ボタンで前後の月に移動できます。",
        side: "bottom",
      },
    },
    {
      element: "#tour-calendar-grid",
      popover: {
        title: "🗓 記録のある日を確認する",
        description: "記録がある日にはマークが付いています。日付をタップすると記録の詳細が表示されます。",
        side: "bottom",
      },
    },
  ],

  "/graph": [
    {
      element: "#tour-graph-tabs",
      popover: {
        title: "📊 グラフの種類を切り替える",
        description: "血圧・脈拍・体重・BMIのグラフを切り替えて確認できます。",
        side: "bottom",
      },
    },
    {
      element: "#tour-graph-chart",
      popover: {
        title: "📈 グラフを見る",
        description: "緑色の帯が正常範囲です。数値がこの範囲内に収まっているか確認しましょう。",
        side: "top",
      },
    },
  ],

  "/blood-data": [
    {
      element: "#tour-blood-tabs",
      popover: {
        title: "🩸 血液検査とCPXを切り替える",
        description: "「血液検査」と「運動負荷試験（CPX）」のタブを切り替えて入力・確認できます。",
        side: "bottom",
      },
    },
    {
      element: "#tour-blood-add",
      popover: {
        title: "➕ 新しい検査結果を追加する",
        description: "病院から検査結果をもらったら「新規追加」ボタンで入力しましょう。",
        side: "bottom",
      },
    },
  ],

  "/family": [
    {
      element: "#tour-family-members",
      popover: {
        title: "👨‍👩‍👧 家族を登録する",
        description: "家族のLINEアカウントを登録すると、記録を保存したときに通知が届きます。",
        side: "bottom",
      },
    },
    {
      element: "#tour-family-reminder",
      popover: {
        title: "⏰ リマインダーを設定する",
        description: "記録を忘れないように、毎日指定した時間にLINEでお知らせが届きます。",
        side: "top",
      },
    },
    {
      element: "#tour-family-invite",
      popover: {
        title: "📲 家族をLINEに招待する",
        description: "「家族を招待」ボタンでQRコードを表示し、家族のLINEで読み取ってもらいましょう。",
        side: "top",
      },
    },
  ],

  "/learn": [
    {
      element: "#tour-learn-content",
      popover: {
        title: "📚 心臓リハビリについて学ぶ",
        description: "心臓リハビリや日常生活のポイントについて、わかりやすく解説しています。",
        side: "bottom",
      },
    },
    {
      element: "#tour-learn-ai",
      popover: {
        title: "🤖 AIに健康アドバイスをもらう",
        description: "「アドバイスを生成」ボタンを押すと、あなたの記録データをもとにAIが個別のアドバイスをくれます。",
        side: "top",
      },
    },
  ],

  "/messages": [
    {
      element: "#tour-messages-list",
      popover: {
        title: "💬 医療従事者からのメッセージ",
        description: "担当の医師・看護師・理学療法士からのコメントがここに届きます。",
        side: "bottom",
      },
    },
  ],

  "/profile": [
    {
      element: "#tour-profile-basic",
      popover: {
        title: "👤 基本情報を入力する",
        description: "名前・年齢・性別・身長・目標体重を入力しましょう。AIアドバイスの精度が上がります。",
        side: "bottom",
      },
    },
    {
      element: "#tour-profile-disease",
      popover: {
        title: "🏥 疾患・リスク因子を登録する",
        description: "自分の疾患や動脈硬化のリスク因子を登録しておくと、より正確なアドバイスが受けられます。",
        side: "top",
      },
    },
  ],
};

export interface TourGuideHandle {
  start: () => void;
}

const TourGuide = forwardRef<TourGuideHandle>(function TourGuide(_, ref) {
  const pathname = usePathname();
  const driverRef = useRef<DriverInstance | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);

  useImperativeHandle(ref, () => ({
    start() {
      const steps = tourSteps[pathname];
      if (!steps?.length) {
        alert("このページのガイドはまだ準備中です。");
        return;
      }

      // 既存ツアーがあれば先に破棄
      driverRef.current?.destroy();

      const driverObj = driver({
        showButtons: [],
        showProgress: false,
        // ポータルボタンへのクリックを「外側クリック」と誤認して
        // ツアーを閉じないよう無効化
        allowClose: false,
        steps,
        popoverClass: "tour-popover",
        onHighlighted: () => {
          setCurrentIndex(driverObj.getActiveIndex() ?? 0);
        },
        onDestroyed: () => {
          if (driverRef.current === driverObj) {
            setIsActive(false);
            driverRef.current = null;
          }
        },
      });

      driverRef.current = driverObj;
      setTotalSteps(steps.length);
      setCurrentIndex(0);
      setIsActive(true);
      driverObj.drive();
    },
  }));

  if (!isActive || typeof document === "undefined") return null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;

  const stopAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };

  return createPortal(
    <div className="tour-nav-bar">
      <div className="tour-nav-progress">
        {currentIndex + 1} / {totalSteps} ステップ
      </div>
      <div className="tour-nav-buttons">
        <button
          onClick={(e) => { stopAll(e); driverRef.current?.movePrevious(); }}
          disabled={isFirst}
          className="tour-btn tour-btn-prev"
        >
          ← 前へ
        </button>
        <button
          onClick={(e) => { stopAll(e); driverRef.current?.destroy(); }}
          className="tour-btn tour-btn-close"
        >
          閉じる
        </button>
        <button
          onClick={(e) => { stopAll(e); driverRef.current?.moveNext(); }}
          className="tour-btn tour-btn-next"
        >
          {isLast ? "完了 ✓" : "次へ →"}
        </button>
      </div>
    </div>,
    document.body
  );
});

export default TourGuide;
