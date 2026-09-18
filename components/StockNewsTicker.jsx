'use client';
import { useEffect, useState } from 'react';

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function StockNewsTicker({ items }) {
  const [index, setIndex] = useState(0);
  const list = items || [];

  useEffect(() => {
    if (list.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 border-2 bg-gray-50 border-gray-200">
        <span className="text-xl shrink-0">📰</span>
        <p className="text-sm font-medium text-gray-400">오늘은 아직 종목 소식이 없어요.</p>
      </div>
    );
  }

  const current = list[index % list.length];
  const up = current.pct > 0;

  return (
    <div
      className={`rounded-2xl px-4 py-3 flex items-center gap-2.5 overflow-hidden border-2 ${
        up ? 'bg-mint/10 border-mint' : 'bg-coral/10 border-coral'
      }`}
    >
      <span className="text-xl shrink-0">📰</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy truncate">{current.headline}</p>
        <p className={`text-[10.5px] font-bold ${up ? 'text-mint-deep' : 'text-coral-deep'}`}>
          {current.stock_name} · {up ? '▲' : '▼'} 오늘 {fmtTime(current.created_at)}
        </p>
      </div>
      {list.length > 1 && (
        <span className="text-[10.5px] text-gray-400 shrink-0">
          {(index % list.length) + 1}/{list.length}
        </span>
      )}
    </div>
  );
}
