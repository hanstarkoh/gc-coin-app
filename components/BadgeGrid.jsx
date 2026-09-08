'use client';
import { BADGE_DEFS } from '@/lib/badges';

export default function BadgeGrid({ earnedKeys }) {
  const earnedSet = new Set(earnedKeys);
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {BADGE_DEFS.map((b) => {
        const earned = earnedSet.has(b.key);
        return (
          <div
            key={b.key}
            title={`${b.name} - ${b.desc}`}
            className={`icon-badge ${earned ? 'icon-badge-gold' : 'icon-badge-gray grayscale opacity-60'} aspect-square rounded-2xl flex-col p-1.5`}
          >
            <div className="text-xl">{b.icon}</div>
            <div className="text-[9.5px] leading-tight mt-1 font-medium text-navy text-center">{b.name}</div>
          </div>
        );
      })}
    </div>
  );
}
