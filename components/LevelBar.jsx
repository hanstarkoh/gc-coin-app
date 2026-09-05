'use client';

export default function LevelBar({ level }) {
  if (!level) return null;
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-grape flex items-center justify-center text-white font-display text-sm">
            Lv.{level.level}
          </div>
          <span className="text-sm text-gray-500">다음 레벨까지</span>
        </div>
        <span className="text-sm font-bold text-grape">{level.xpToNext} GC 남음</span>
      </div>
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-grape to-grape-deep rounded-full transition-all duration-700"
          style={{ width: `${level.progressPct}%` }}
        />
      </div>
    </div>
  );
}
