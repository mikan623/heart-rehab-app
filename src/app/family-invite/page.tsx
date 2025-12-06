"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    liff: any;
  }
}

interface InviteInfo {
  valid: boolean;
  patientId: string;
  patientName?: string | null;
  expiresAt?: string;
  used?: boolean;
  isExpired?: boolean;
}

export default function FamilyInvitePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);

  const [familyUserId, setFamilyUserId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [relationship, setRelationship] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [inviteId, setInviteId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const id = url.searchParams.get("familyInviteId");
        if (!id) {
          setError("招待IDが無効です。もう一度QRコードを読み取ってください。");
          setLoading(false);
          return;
        }
        setInviteId(id);

        // LIFF 初期化 & 家族側ユーザー情報取得
        if (typeof window !== "undefined" && window.liff) {
          await window.liff.init({
            liffId: process.env.NEXT_PUBLIC_LIFF_ID,
          });

          if (!window.liff.isLoggedIn()) {
            window.liff.login();
            return;
          }

          const profile = await window.liff.getProfile();
          setFamilyUserId(profile.userId);
          setName(profile.displayName || "");

          // IDトークンからメール取得（あれば）
          try {
            const idToken = await window.liff.getIDToken();
            if (idToken) {
              const decoded = JSON.parse(atob(idToken.split(".")[1]));
              if (decoded.email) {
                setEmail(decoded.email);
              }
            }
          } catch {
            // メールは任意なので失敗しても無視
          }
        } else {
          setError("LIFF が利用できません。LINEアプリからアクセスしてください。");
          setLoading(false);
          return;
        }

        // 招待情報取得
        const res = await fetch(`/api/family-invites?familyInviteId=${id}`);
        if (!res.ok) {
          setError("この招待リンクは無効か、期限切れです。");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setInviteInfo(data);

        if (!data.valid) {
          setError("この招待リンクは無効か、すでに利用されています。");
        }
      } catch (err: any) {
        console.error(err);
        setError("招待情報の読み込み中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInfo || !inviteInfo.patientId || !familyUserId) return;

    setSubmitting(true);
    setError(null);

    try {
      // 家族メンバーとして登録
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: inviteInfo.patientId,
          familyMember: {
            name,
            email,
            relationship,
            lineUserId: familyUserId,
            isRegistered: true,
          },
        }),
      });

      if (!res.ok) {
        let message = "家族登録に失敗しました。";
        try {
          const data = await res.json();
          if (res.status === 409 && data?.error) {
            message = data.error;
          }
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      // 招待を使用済みに更新（任意）
      if (inviteId) {
        await fetch("/api/family-invites", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteId }),
        });
      }

      setCompleted(true);
      alert("家族として登録が完了しました。これから健康記録が共有されます。");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100">
        <p className="text-gray-600">読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 px-4">
        <div className="max-w-md bg-white rounded-xl shadow-md p-6">
          <h1 className="text-xl font-bold text-red-600 mb-4">家族登録エラー</h1>
          <p className="text-gray-700 mb-4 whitespace-pre-line">{error}</p>
          <p className="text-sm text-gray-500">
            お手数ですが、招待を送ってくれた方にもう一度QRコードを発行してもらってください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-orange-100 px-4 py-8">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 text-center">
          家族として登録
        </h1>

        <p className="text-sm text-gray-700 text-center">
          {inviteInfo?.patientName
            ? `${inviteInfo.patientName} さんの健康記録があなたのLINEに共有されます。`
            : "ご家族の健康記録があなたのLINEに共有されます。"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              あなたのお名前
            </label>
              <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              disabled={completed}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              続柄
            </label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
              disabled={completed}
            >
              <option value="">選択してください</option>
              <option value="配偶者">配偶者</option>
              <option value="子供">子供</option>
              <option value="親">親</option>
              <option value="兄弟">兄弟</option>
              <option value="姉妹">姉妹</option>
              <option value="その他">その他</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              メールアドレス（任意）
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="example@email.com"
              disabled={completed}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || completed}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-full hover:shadow-lg disabled:opacity-60"
          >
            {completed ? "登録済み" : submitting ? "登録中..." : "この内容で登録する"}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center">
          登録後は、このLINEアカウントにご家族の健康記録が自動で送信されます。
        </p>

        {completed && (
          <p className="text-sm text-green-700 text-center font-semibold">
            登録ありがとうございます。このLINEアカウントにご家族の健康記録が自動で共有されます。
          </p>
        )}
      </div>
    </div>
  );
}



