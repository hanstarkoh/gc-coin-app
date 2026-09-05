'use client';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function Celebration({ type, amount, level, onClose }) {
  useEffect(() => {
    const colors = type === 'levelup' ? ['#7C5CBF', '#F2AC1E', '#3FB68B'] : ['#F2AC1E', '#FFE8B8'];
    confetti({
      particleCount: type === 'levelup' ? 140 : 80,
      spread: 90,
      origin: { y: 0.4 },
      colors,
    });
  }, [type]);

  return (
    <div className="fixed inset-0 z-50 bg-navy-deep/60 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-8 text-center max-w-xs w-full animate-popIn">
        {type === 'levelup' ? (
          <>
            <div className="text-5xl mb-2">🎉</div>
            <div className="font-display text-2xl text-grape">레벨 업!</div>
            <div className="font-display text-4xl text-navy my-2">Lv.{level}</div>
            <p className="text-sm text-gray-500">계속 코인을 모아서 더 높은 레벨에 도전해봐요!</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-2 animate-coinSpin inline-block">🪙</div>
            <div className="font-display text-2xl text-gold-deep">+{amount} GC 획득!</div>
            <p className="text-sm text-gray-500 mt-2">오늘도 코인을 모았어요</p>
          </>
        )}
        <button
          onClick={onClose}
          className="mt-5 bg-navy text-white rounded-full px-6 py-2.5 text-sm font-bold w-full"
        >
          확인
        </button>
      </div>
    </div>
  );
}
