'use client';
import { useEffect, useState } from 'react';

export default function AnnouncementTicker({ items }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, 4000);
    return () => clearInterval(id);
  }, [items.length]);

  if (items.length === 0) return null;
  const current = items[index % items.length];

  return (
    <div className="bg-white border-2 border-gold rounded-2xl px-4 py-3 flex items-center gap-2.5 overflow-hidden">
      <span className="text-xl shrink-0">📢</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy truncate">{current.message}</p>
        <p className="text-[10.5px] text-gray-400">- {current.kid_name}</p>
      </div>
      {items.length > 1 && (
        <span className="text-[10.5px] text-gray-400 shrink-0">
          {(index % items.length) + 1}/{items.length}
        </span>
      )}
    </div>
  );
}
