export function getPublicLiffId(): string | null {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id && String(id).trim() ? String(id).trim() : null;
}

/**
 * LIFF起動用URLを生成する。
 * `liff.state` には「アプリ側で開きたいパス＋クエリ」を渡す。
 *
 * 例:
 *   buildLiffUrl("/family-invite?familyInviteId=xxx")
 *   => https://liff.line.me/{LIFF_ID}?liff.state=%2Ffamily-invite%3FfamilyInviteId%3Dxxx
 */
export function buildLiffUrl(statePath: string): string | null {
  const liffId = getPublicLiffId();
  if (!liffId) return null;

  const state = statePath?.startsWith("/") ? statePath : `/${statePath || ""}`;
  return `https://liff.line.me/${encodeURIComponent(liffId)}?liff.state=${encodeURIComponent(state)}`;
}

export function isLikelyLineInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iOS/Androidともに "Line/" を含むことが多い。念のため大文字小文字は無視。
  return /Line\//i.test(ua);
}


