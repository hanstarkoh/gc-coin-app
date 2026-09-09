import Link from 'next/link';
import TopBar from '@/components/TopBar';
import Sparkline from '@/components/Sparkline';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { unstable_noStore as noStore } from 'next/cache';
import { maybeUpdateStockPrices } from '@/lib/stocks';

export const dynamic = 'force-dynamic';

const HISTORY_POINTS = 14;

async function getMenu() {
  noStore();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('menu_items')
    .select('id, name, price, stock')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function getOrdersOpen() {
  noStore();
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('settings').select('orders_open').eq('id', 1).single();
  if (error) return false;
  return data.orders_open;
}

async function getActiveEvents() {
  noStore();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('events')
    .select('id, title, description, reward')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function getActiveStocks() {
  noStore();
  const sb = supabaseAdmin();
  await maybeUpdateStockPrices(sb);
  const { data: stocks, error } = await sb
    .from('stocks')
    .select('id, name, emoji, price')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error || stocks.length === 0) return [];

  return Promise.all(
    stocks.map(async (s) => {
      const { data: history } = await sb
        .from('stock_price_history')
        .select('price, recorded_at')
        .eq('stock_id', s.id)
        .order('recorded_at', { ascending: false })
        .limit(HISTORY_POINTS);
      const prices = (history || []).map((h) => h.price).reverse();
      const prevClose = prices.length > 1 ? prices[prices.length - 2] : s.price;
      return {
        ...s,
        history: prices,
        changePct: prevClose ? Math.round(((s.price - prevClose) / prevClose) * 1000) / 10 : 0,
      };
    })
  );
}

async function getActiveGoal() {
  noStore();
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('group_goals')
    .select('id, title, description, target, current, achieved_at')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export default async function Home() {
  const [menu, events, stocks, ordersOpen, goal] = await Promise.all([
    getMenu(),
    getActiveEvents(),
    getActiveStocks(),
    getOrdersOpen(),
    getActiveGoal(),
  ]);

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
        <div className="text-center px-4 mb-1">
          <div className="icon-badge icon-badge-gold w-16 h-16 rounded-full text-3xl mx-auto mb-3 animate-popIn">🪙</div>
          <div className="font-display text-3xl text-navy">오늘도 코인을 모아볼까요?</div>
          <p className="text-sm text-gray-500 mt-2">출석하면 코인을 받고, 코인으로 간식을 사 먹어요.</p>
        </div>

        <Link
          href="/kid"
          className="btn-3d btn-3d-navy block bg-navy text-white rounded-2xl py-5 text-center font-display text-lg"
        >
          🙋 청소년으로 시작하기
        </Link>

        {goal && (
          <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-badge icon-badge-coral w-7 h-7 rounded-lg text-sm">🎉</div>
              <div className="font-display text-base text-navy">기부함 · {goal.title}</div>
            </div>
            {goal.description && <p className="text-xs text-gray-500 mb-2">{goal.description}</p>}
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-coral to-coral-deep rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.round((goal.current / goal.target) * 100))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-gray-500">
                {goal.current} / {goal.target} GC
              </span>
              {goal.achieved_at ? (
                <span className="font-bold text-mint-deep">🎉 목표 달성!</span>
              ) : (
                <span className="text-gray-400">로그인하고 기부해보세요</span>
              )}
            </div>
          </div>
        )}

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="icon-badge icon-badge-mint w-7 h-7 rounded-lg text-sm">🍪</div>
              <div className="font-display text-base text-navy">간식 메뉴</div>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                ordersOpen ? 'bg-mint/15 text-mint-deep' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {ordersOpen ? '주문 가능' : '주문 마감'}
            </span>
          </div>
          {menu.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">등록된 메뉴가 없어요.</p>}
          {menu.map((item) => {
            const soldOut = item.stock !== null && item.stock <= 0;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between py-3 border-b border-dashed border-gray-200 last:border-0 ${soldOut ? 'opacity-40' : ''}`}
              >
                <div>
                  <div className="font-bold text-sm">{item.name}</div>
                  {item.stock !== null && !soldOut && <div className="text-[11px] text-gray-400">재고 {item.stock}개</div>}
                </div>
                {soldOut ? (
                  <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-400">품절</span>
                ) : (
                  <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
                )}
              </div>
            );
          })}
          {menu.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {ordersOpen ? '로그인하면 코인으로 바로 주문할 수 있어요.' : '지금은 주문을 받지 않고 있어요.'}
            </p>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-badge icon-badge-grape w-7 h-7 rounded-lg text-sm">🎯</div>
            <div className="font-display text-base text-navy">진행 중인 이벤트</div>
          </div>
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

        {stocks.length > 0 && (
          <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="icon-badge icon-badge-navy w-7 h-7 rounded-lg text-sm">📈</div>
              <div className="font-display text-base text-navy">실시간 모의투자</div>
            </div>
            {stocks.map((s) => {
              const up = s.changePct >= 0;
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">
                      {s.emoji} {s.name}
                    </div>
                    <div className={`text-xs font-bold ${up ? 'text-mint-deep' : 'text-coral-deep'}`}>
                      {s.price} GC ({up ? '+' : ''}{s.changePct}%)
                    </div>
                  </div>
                  <Sparkline values={s.history} color={up ? '#3FB68B' : '#E2574C'} />
                </div>
              );
            })}
            <p className="text-xs text-gray-400 mt-2">로그인하고 코인으로 종목을 사고팔 수 있어요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
