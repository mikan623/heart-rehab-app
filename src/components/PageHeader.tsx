"use client";

import NavigationBar from "@/components/NavigationBar";

type Props = {
  /** ページタイトル */
  title: string;
  /** サブタイトル（デスクトップ時のみ、タイトル下に表示） */
  subtitle?: string;
  /** タイトル左のアイコン（心臓ちゃんなど） */
  icon?: React.ReactNode;
  /** タイトルクリック時のコールバック（指定時はタイトルをクリック可能に） */
  onTitleClick?: () => void;
  /** デスクトップ時のタイトル装飾（任意） */
  desktopTitleClassName?: string;
  /** スマホ時のタイトル装飾（任意） */
  mobileTitleClassName?: string;
  /** LINEアプリ内表示時のセーフエリア上余白（px） */
  lineSafeAreaTop?: number;
  /** 上余白（px）。lineSafeAreaTop 未指定時のみ有効 */
  topPaddingPx?: number;
  /** 右上の要素。未指定時は NavigationBar を表示 */
  rightContent?: React.ReactNode;
  /** LINEアプリ内表示かどうか（line-app-header クラス付与） */
  isLineApp?: boolean;
};

export default function PageHeader({
  title,
  subtitle,
  icon,
  onTitleClick,
  desktopTitleClassName = "text-xl font-bold text-orange-800",
  mobileTitleClassName = "text-lg font-bold text-orange-800",
  lineSafeAreaTop,
  topPaddingPx,
  rightContent,
  isLineApp = false,
}: Props) {
  const paddingTop =
    lineSafeAreaTop !== undefined
      ? `${lineSafeAreaTop + 8}px`
      : topPaddingPx !== undefined
        ? `${topPaddingPx}px`
        : "8px";

  const titleBaseClass = onTitleClick
    ? "cursor-pointer hover:text-orange-600 transition-colors"
    : "";

  const renderTitle = (titleClassName: string) => (
    <div className="flex items-center gap-3">
      {icon}
      <h1
        className={`${titleClassName} ${titleBaseClass}`}
        onClick={onTitleClick}
        onKeyDown={
          onTitleClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTitleClick();
                }
              }
            : undefined
        }
        role={onTitleClick ? "button" : undefined}
        tabIndex={onTitleClick ? 0 : undefined}
      >
        {title}
      </h1>
    </div>
  );

  const right = rightContent ?? <NavigationBar />;

  return (
    <header
      className={`sticky top-0 z-50 bg-white shadow-sm px-2 py-1 ${isLineApp ? "line-app-header" : ""}`}
      style={{ paddingTop }}
    >
      {/* デスクトップ版：横並び */}
      <div className="hidden md:flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          {subtitle ? (
            <div>
              {renderTitle(desktopTitleClassName)}
              <p className="text-xs text-gray-600">{subtitle}</p>
            </div>
          ) : (
            renderTitle(desktopTitleClassName)
          )}
        </div>
        {right}
      </div>

      {/* スマホ版：縦並び */}
      <div className="md:hidden">
        <div className="flex items-center gap-3 mb-2">
          {renderTitle(mobileTitleClassName)}
        </div>
        <div className="flex justify-center">{right}</div>
      </div>
    </header>
  );
}


