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
            className={`aspect-square rounded-xl flex flex-col items-center justify-center text-center p-1.5 border-2 ${
              earned ? 'bg-gold-light border-gold' : 'bg-gray-50 border-gray-100 grayscale opacity-50'
            }`}
          >
            <div className="text-xl">{b.icon}</div>
            <div className="text-[9.5px] leading-tight mt-1 font-medium text-navy">{b.name}</div>
          </div>
        );
      })}
    </div>
  );
}
