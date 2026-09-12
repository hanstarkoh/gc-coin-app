'use client';
import { useEffect, useState } from 'react';

export default function StockNewsTicker({ items }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 4000);
    return () => clearInterval(id);
  }, [items.length]);

  if (!items || items.length === 0) return null;
  const current = items[index % items.length];
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
          {current.stock_name} {up ? '+' : ''}
          {current.pct}%
        </p>
      </div>
      {items.length > 1 && (
        <span className="text-[10.5px] text-gray-400 shrink-0">
          {(index % items.length) + 1}/{items.length}
        </span>
      )}
    </div>
  );
}
