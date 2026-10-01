'use client';
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { FORTUNE_TIERS } from '@/lib/fortunes';

const TIER_KEYS = FORTUNE_TIERS.map((t) => t.key);
const BY_KEY = Object.fromEntries(FORTUNE_TIERS.map((t) => [t.key, t]));
const CELL_H = 64;
const CYCLES = 4;

const EFFECT_CLASS = {
  sparkle: 'fortune-sparkle',
  wobble: 'fortune-wobble',
  shake: 'fortune-shake',
  rain: 'fortune-shake fortune-rain',
};

function fireConfetti(effect) {
  if (effect === 'confetti-gold') {
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.4 }, colors: ['#F2AC1E', '#FFE8B8', '#C98A0E'] });
  } else if (effect === 'confetti-mint') {
    confetti({ particleCount: 90, spread: 80, origin: { y: 0.4 }, colors: ['#3FB68B', '#82E4BE'] });
  }
}

// result: { tier, label, emoji, color, effect, phrase } — 서버가 이미 뽑아서 정해준 값.
// 룰렛은 그 결과에 "정확히 멈추도록" 연출만 담당함(가짜 랜덤 애니메이션).
export default function FortuneWheel({ result, onClose }) {
  const [spinning, setSpinning] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const reelRef = useRef(null);

  const targetIndex = TIER_KEYS.indexOf(result.tier);
  const translateY = -(CYCLES * TIER_KEYS.length + targetIndex) * CELL_H;

  const reelItems = [];
  for (let c = 0; c <= CYCLES; c++) {
    for (const key of TIER_KEYS) reelItems.push(key);
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (reelRef.current) reelRef.current.style.transform = `translateY(${translateY}px)`;
    });
    const t = setTimeout(() => {
      setSpinning(false);
      setRevealed(true);
      fireConfetti(result.effect);
    }, 2000);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectClass = revealed ? EFFECT_CLASS[result.effect] || '' : '';

  return (
    <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-4">
      <div className={`bg-white rounded-3xl p-5 max-w-xs w-full text-center ${effectClass}`}>
        <div className="font-display text-base text-navy mb-3">오늘의 운세</div>

        <div
          className="relative mx-auto overflow-hidden rounded-2xl border-2 border-gray-100 bg-paper"
          style={{ height: CELL_H, width: 170 }}
        >
          <div
            ref={reelRef}
            style={{ transition: spinning ? 'transform 2s cubic-bezier(0.12, 0.85, 0.18, 1)' : 'none' }}
          >
            {reelItems.map((key, i) => {
              const t = BY_KEY[key];
              return (
                <div
                  key={i}
                  className="flex items-center justify-center gap-1.5 font-display text-xl"
                  style={{ height: CELL_H, color: t.color }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </div>
              );
            })}
          </div>
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-b-2 border-gold pointer-events-none"
            style={{ height: CELL_H }}
          />
        </div>

        {revealed && (
          <p className="text-sm text-gray-600 mt-4 animate-popIn leading-relaxed">{result.phrase}</p>
        )}

        <button
          disabled={spinning}
          onClick={onClose}
          className="btn-3d btn-3d-navy mt-4 bg-navy text-white rounded-full px-6 py-2.5 text-sm font-display w-full disabled:opacity-40"
        >
          {spinning ? '두근두근...' : '확인'}
        </button>
      </div>
    </div>
  );
}
