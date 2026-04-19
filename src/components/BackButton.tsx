"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BackButton() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // localStorageのuserIdでログイン判定（setSession()で保存される）
    const userId = localStorage.getItem("userId");
    setIsLoggedIn(!!userId);
  }, []);

  const handleBack = () => {
    if (isLoggedIn) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      onClick={handleBack}
      className="px-3 py-1 text-sm md:px-4 md:py-2 md:text-base bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
    >
      <span className="hidden md:inline">戻る</span>
      <span className="md:hidden">戻る</span>
    </button>
  );
}
