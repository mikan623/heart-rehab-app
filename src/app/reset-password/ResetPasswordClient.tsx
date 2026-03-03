"use client";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const isTokenFlow = !!token;
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ① リセットリンク送信（メール）
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (response.ok) {
        setSuccess('メールを送信しました（該当アカウントが存在する場合）。受信箱をご確認ください。');
      } else {
        const data = await response.json();
        setError(data.error || '送信に失敗しました');
      }
    } catch (err) {
      setError('エラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // ② トークン提示で新しいパスワードを設定
  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 6) {
      setError('パスワードは6文字以上である必要があります');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiFetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword,
        })
      });

      if (response.ok) {
        setSuccess('パスワードが正常に変更されました！');
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || 'パスワード変更に失敗しました');
      }
    } catch (err) {
      setError('エラーが発生しました');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🔐 パスワード再設定</h1>
          <p className="text-gray-600">
            {isTokenFlow
              ? 'メールのリンクから開いた場合は、新しいパスワードを設定してください'
              : '登録メールアドレスを入力すると、再設定リンクをお送りします'}
          </p>
        </div>

        {/* ① リセットリンク送信 */}
        {!isTokenFlow && (
          <form onSubmit={handleRequestSubmit} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">📧 再設定リンクを送信</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-100 border-2 border-green-300 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-pink-600 disabled:opacity-50"
            >
              {isLoading ? '送信中...' : '送信する'}
            </button>
          </form>
        )}

        {/* ② トークンで新PW設定 */}
        {isTokenFlow && (
          <form onSubmit={handleConfirmSubmit} className="bg-white rounded-2xl shadow-lg p-6 border-2 border-orange-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4">🔐 新しいパスワードを設定</h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔐 新しいパスワード
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="6文字以上"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔐 パスワード確認
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-100 border-2 border-green-300 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-lg hover:from-orange-600 hover:to-pink-600 disabled:opacity-50"
            >
              {isLoading ? '変更中...' : 'パスワードを変更'}
            </button>
          </form>
        )}

        {/* ホームへのリンク */}
        <div className="text-center mt-6">
          <Link href="/" className="text-orange-600 hover:text-orange-700 font-semibold">
            ← ホームへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
