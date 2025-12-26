"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth";

function getRoleFromLocalStorage(): "patient" | "medical" | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem("loginRole");
  if (v === "medical") return "medical";
  if (v === "patient") return "patient";
  return null;
}

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  // ログイン前でも到達できる想定のページ
  const publicPrefixes = ["/reset-password", "/terms", "/privacy", "/contact", "/family-invite"];
  return publicPrefixes.some((p) => pathname.startsWith(p));
}

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<"patient" | "medical" | null>(null);

  // localStorage のロール変更を拾う（同一タブ内の切替対策）
  useEffect(() => {
    if (!pathname) return;
    const r = getRoleFromLocalStorage();
    // public path でも状態は同期しておく（ログアウト→再選択の直後に反映させる）
    setRole((prev) => (prev === r ? prev : r));
  }, [pathname]);

  // localStorage に無い場合はSupabase（DB）から復元
  useEffect(() => {
    const ensureRole = async () => {
      const localRole = getRoleFromLocalStorage();
      if (localRole) {
        setRole(localRole);
        return;
      }
      if (role) return;
      if (!pathname) return;
      if (isPublicPath(pathname)) return;

      const userId = getCurrentUserId();
      if (!userId) return;

      try {
        const res = await fetch(`/api/auth/role?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const r = data?.role === "medical" ? "medical" : "patient";
        setRole(r);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("loginRole", r);
        }
      } catch {
        // ignore
      }
    };
    ensureRole();
  }, [pathname, role]);

  useEffect(() => {
    if (!pathname) return;
    if (isPublicPath(pathname)) return;

    // まず localStorage を優先（同一ユーザーでの切替を可能にする）
    const effectiveRole = getRoleFromLocalStorage() || role;
    // まだロールが確定していない場合は何もしない（復元を待つ）
    if (!effectiveRole) return;
    const isMedicalPage = pathname === "/medical" || pathname.startsWith("/medical/");

    // 患者側：/medical を閲覧不可
    if (effectiveRole === "patient" && isMedicalPage) {
      router.replace("/health-records");
      return;
    }

    // 医療従事者側：/medical 以外は閲覧不可
    if (effectiveRole === "medical" && !isMedicalPage) {
      router.replace("/medical");
    }
  }, [pathname, role, router]);

  return null;
}


