'use client';
import { useEffect, useState } from 'react';

// toLocaleTimeString('ko-KR', ...)을 썼더니 서버(Node, ICU 데이터 환경에 따라 'ko-KR'이
// 'en-US'로 조용히 폴백돼 "AM 3:20")와 브라우저(항상 "오전 3:20")가 다르게 렌더링돼서
// 하이드레이션 경고가 났음(2026-10, 실제로 콘솔에서 확인). Intl 로케일/타임존을 환경에
// 맡기지 않고 KST(UTC+9) 기준으로 직접 계산해서 서버/클라이언트가 항상 똑같이 찍히게 함.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function fmtTime(iso) {
  try {
    const kst = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
    let h = kst.getUTCHours();
    const m = String(kst.getUTCMinutes()).padStart(2, '0');
    const period = h < 12 ? '오전' : '오후';
    h = h % 12 || 12;
    return `${period} ${h}:${m}`;
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
