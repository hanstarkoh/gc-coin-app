'use client';

export default function TopBar({ title, sub, onExit }) {
  return (
    <div className="sticky top-0 z-20 bg-navy text-white px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-gold border-2 border-gold-deep flex items-center justify-center font-display text-navy-deep text-xs">
          GC
        </div>
        <div>
          <div className="font-display text-lg leading-tight">{title}</div>
          {sub && <div className="text-[11px] text-white/70 leading-tight">{sub}</div>}
        </div>
      </div>
      {onExit && (
        <button
          onClick={onExit}
          className="text-xs border border-white/40 rounded-full px-3 py-1.5 hover:border-white transition"
        >
          나가기
        </button>
      )}
    </div>
  );
}
