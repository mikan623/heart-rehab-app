"use client";

import NavigationBar from "@/components/NavigationBar";

type Props = {
  /** ページタイトル（スマホで表示） */
  title: string;
  /** デスクトップ時のタイトル装飾（任意） */
  desktopTitleClassName?: string;
  /** スマホ時のタイトル装飾（任意） */
  mobileTitleClassName?: string;
  /** LINEアプリのセーフエリア上余白（px） */
  topPaddingPx?: number;
  /** 右上に追加で置きたい要素（デスクトップ時のみ） */
  desktopRight?: React.ReactNode;
};

export default function PageHeader({
  title,
  desktopTitleClassName = "text-2xl font-bold text-orange-800",
  mobileTitleClassName = "text-lg font-bold text-orange-800",
  topPaddingPx,
  desktopRight,
}: Props) {
  return (
    <header
      className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1"
      style={{ paddingTop: topPaddingPx !== undefined ? `${topPaddingPx}px` : "8px" }}
    >
      {/* デスクトップ版：横並び */}
      <div className="hidden md:flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          <h1 className={desktopTitleClassName}>{title}</h1>
        </div>
        {desktopRight ?? <NavigationBar />}
      </div>

      {/* スマホ版：縦並び */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 mb-2">
          <h1 className={mobileTitleClassName}>{title}</h1>
        </div>
        <div className="flex justify-center">
          <NavigationBar />
        </div>
      </div>
    </header>
  );
}


