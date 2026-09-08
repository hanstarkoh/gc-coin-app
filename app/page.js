import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function getTodayMenu() {
  const sb = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('menu_items')
    .select('id, name, price')
    .eq('item_date', today)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function getActiveEvents() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, description, reward')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

export default async function Home() {
  const [menu, events] = await Promise.all([getTodayMenu(), getActiveEvents()]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar
        title="금정코인"
        sub="금정청소년수련관 · 주말 방과후 아카데미"
        right={
          <Link
            href="/admin"
            aria-label="관리자"
            className="w-8 h-8 rounded-full border border-white/40 flex items-center justify-center text-sm hover:border-white transition"
          >
            🗂️
          </Link>
        }
      />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-8 space-y-4">
        <div className="text-center px-4 mb-2">
          <div className="font-display text-3xl text-navy">오늘도 코인을 모아볼까요?</div>
          <p className="text-sm text-gray-500 mt-2">출석하면 코인을 받고, 코인으로 간식을 사 먹어요.</p>
        </div>

        <Link
          href="/kid"
          className="btn-3d btn-3d-navy block bg-navy text-white rounded-2xl py-5 text-center font-display text-lg"
        >
          🙋 청소년으로 시작하기
        </Link>

        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4">
          <div className="font-display text-base text-navy mb-1">오늘의 메뉴</div>
          {menu.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">오늘은 아직 메뉴가 올라오지 않았어요.</p>
          )}
          {menu.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between py-3 border-b border-dashed border-gray-200 last:border-0"
            >
              <div className="font-bold text-sm">{item.name}</div>
              <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
            </div>
          ))}
          {menu.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">로그인하면 코인으로 바로 주문할 수 있어요.</p>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4">
          <div className="font-display text-base text-navy mb-1">진행 중인 이벤트</div>
          {events.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">지금 진행 중인 이벤트가 없어요.</p>
          )}
          {events.map((ev) => (
            <div key={ev.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
              <div className="flex items-center justify-between">
                <div className="font-bold text-sm">{ev.title}</div>
                <div className="text-xs text-gold-deep font-bold">+{ev.reward} GC</div>
              </div>
              {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
            </div>
          ))}
          {events.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">로그인하고 완료 표시를 하면 관리자 승인 후 코인을 받아요.</p>
          )}
        </div>
      </div>
    </div>
  );
}
