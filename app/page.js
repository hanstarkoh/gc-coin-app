import TopBar from '@/components/TopBar';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="금정코인" sub="금정청소년수련관 · 주말 방과후 아카데미" />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-10">
        <div className="text-center px-4">
          <div className="font-display text-3xl text-navy">오늘도 코인을 모아볼까요?</div>
          <p className="text-sm text-gray-500 mt-2">출석하면 코인을 받고, 코인으로 간식을 사 먹어요.</p>
        </div>

        <div className="grid grid-cols-2 gap-3.5 mt-9">
          <Link
            href="/kid"
            className="bg-white border-2 border-navy rounded-2xl py-7 px-3 text-center hover:-translate-y-0.5 transition"
          >
            <div className="w-14 h-14 rounded-full bg-mint/15 flex items-center justify-center text-2xl mx-auto mb-3">
              🙋
            </div>
            <div className="font-display text-lg text-navy">청소년</div>
            <p className="text-xs text-gray-500 mt-1">내 코인 확인 · 간식 주문</p>
          </Link>

          <Link
            href="/admin"
            className="bg-white border-2 border-navy rounded-2xl py-7 px-3 text-center hover:-translate-y-0.5 transition"
          >
            <div className="w-14 h-14 rounded-full bg-gold/15 flex items-center justify-center text-2xl mx-auto mb-3">
              🗂️
            </div>
            <div className="font-display text-lg text-navy">관리자</div>
            <p className="text-xs text-gray-500 mt-1">코인 지급 · 메뉴 관리</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
