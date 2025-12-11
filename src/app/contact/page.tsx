"use client";

import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !email || !message) {
      setError("お名前・メールアドレス・お問い合わせ内容は必須です。");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, category, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "送信に失敗しました。時間をおいて再度お試しください。");
      }

      setSuccess("お問い合わせを送信しました。担当者よりご連絡いたします。");
      setName("");
      setEmail("");
      setCategory("general");
      setMessage("");
    } catch (err: any) {
      setError(err.message || "送信に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white shadow-sm px-2 py-1">
        {/* デスクトップ版：横並び */}
        <div className="hidden md:flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">
              お問い合わせ
            </h1>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
          >
            ホームに戻る
          </a>
        </div>

        {/* スマホ版：縦並び */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h1 className="text-lg font-bold text-orange-800">お問い合わせ</h1>
            <a
              href="/"
              className="px-3 py-1 bg-orange-500 text-white rounded-lg font-medium text-sm hover:bg-orange-600 transition-colors"
            >
              戻る
            </a>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-4 md:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              心臓リハビリ手帳 お問い合わせフォーム
            </h2>
            <p className="text-sm text-gray-600">
              アプリに関するご質問・不具合のご報告・ご要望などがございましたら、以下のフォームからお気軽にご連絡ください。
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-4 rounded-lg border border-green-300 bg-green-50 text-green-700 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                お名前 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="山田 太郎"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="example@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                お問い合わせ種別
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="general">一般的なご質問</option>
                <option value="bug">不具合のご報告</option>
                <option value="request">機能追加のご要望</option>
                <option value="other">その他</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                お問い合わせ内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full min-h-[160px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="できるだけ詳しくご記入ください。"
                required
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-full hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60"
              >
                {loading ? "送信中..." : "送信する"}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">
              送信いただいた内容は、サポート対応およびサービス改善の目的以外には使用いたしません。
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}






