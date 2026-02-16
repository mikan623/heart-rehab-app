"use client";

export default function LandingHeader() {
  return (
    <header className="bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10">
            <img
              src="/heart-animation.gif"
              alt="心臓ちゃん"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-orange-800">
            心臓リハビリ手帳
          </h1>
        </div>
      </div>
    </header>
  );
}
