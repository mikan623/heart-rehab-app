import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            ページが見つかりません
          </h2>
          <p className="text-gray-600 mb-4">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
        </div>

        <Link
          href="/"
          className="inline-block bg-orange-500 text-white py-2 px-6 rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}