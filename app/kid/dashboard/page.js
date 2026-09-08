'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import LevelBar from '@/components/LevelBar';
import BadgeGrid from '@/components/BadgeGrid';
import Celebration from '@/components/Celebration';
import Sparkline from '@/components/Sparkline';
import { ToastProvider, useToast } from '@/components/Toast';
import { TRADE_FEE_RATE } from '@/lib/stocks';

function fmtDate(d) {
  return d.replaceAll('-', '.');
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function DashboardInner() {
  const router = useRouter();
  const showToast = useToast();
  const [me, setMe] = useState(null);
  const [menu, setMenu] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [history, setHistory] = useState(null);
  const [ordering, setOrdering] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [stocks, setStocks] = useState(null);
  const [tradeStockId, setTradeStockId] = useState(null);
  const [tradeMode, setTradeMode] = useState(null);
  const [tradeQty, setTradeQty] = useState('');
  const [trading, setTrading] = useState(false);
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [agreeing, setAgreeing] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await fetch('/api/kid/me');
    if (res.status === 401) {
      router.push('/kid');
      return null;
    }
    const data = await res.json();
    if (data.ok) setMe(data);
    return data;
  }, [router]);

  const loadMenu = useCallback(async () => {
    const res = await fetch('/api/kid/menu');
    const data = await res.json();
    if (data.ok) {
      setMenu(data.items);
      setOrdersOpen(data.ordersOpen);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/kid/events');
    const data = await res.json();
    if (data.ok) setEvents(data.events);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/kid/history');
    const data = await res.json();
    if (data.ok) setHistory(data.transactions);
    return data.ok ? data.transactions : [];
  }, []);

  const loadStocks = useCallback(async () => {
    const res = await fetch('/api/kid/stocks');
    const data = await res.json();
    if (data.ok) setStocks(data.stocks);
  }, []);

  useEffect(() => {
    (async () => {
      const meData = await loadMe();
      await loadMenu();
      await loadEvents();
      await loadStocks();
      const tx = await loadHistory();
      if (meData?.ok) checkCelebrations(meData, tx);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function checkCelebrations(meData, tx) {
    const kidId = meData.kid.id;
    const lastSeenKey = `gc_last_seen_${kidId}`;
    const lastLevelKey = `gc_last_level_${kidId}`;
    const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
    const lastLevel = Number(localStorage.getItem(lastLevelKey) || meData.level.level);

    const newEarns = (tx || []).filter(
      (t) => t.type !== 'spend' && new Date(t.created_at).getTime() > lastSeen
    );
    const gained = newEarns.reduce((s, t) => s + t.amount, 0);

    if (meData.level.level > lastLevel) {
      setCelebration({ type: 'levelup', level: meData.level.level });
    } else if (gained > 0) {
      setCelebration({ type: 'earn', amount: gained });
    }

    localStorage.setItem(lastSeenKey, String(Date.now()));
    localStorage.setItem(lastLevelKey, String(meData.level.level));
  }

  const closeCelebration = () => setCelebration(null);

  const handleOrder = async (item) => {
    if (!me || me.kid.balance < item.price) return;
    if (!confirm(`${item.name} (${item.price} GC)를 주문할까요?`)) return;
    setOrdering(item.id);
    try {
      const res = await fetch('/api/kid/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`${item.name} 주문 완료!`);
        const meData = await loadMe();
        await loadHistory();
        if (meData?.ok) {
          localStorage.setItem(`gc_last_seen_${meData.kid.id}`, String(Date.now()));
          localStorage.setItem(`gc_last_level_${meData.kid.id}`, String(meData.level.level));
        }
      } else {
        showToast(data.error || '주문에 실패했어요.');
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setOrdering(null);
    }
  };

  const handleCompleteEvent = async (event) => {
    if (!confirm(`"${event.title}"을(를) 완료했나요? 관리자 승인 후 코인이 지급돼요.`)) return;
    setCompleting(event.id);
    try {
      const res = await fetch(`/api/kid/events/${event.id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('완료 표시했어요. 관리자 승인을 기다려주세요.');
        await loadEvents();
      } else {
        showToast(data.error || '완료 표시에 실패했어요.');
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setCompleting(null);
    }
  };

  const handleAgreeInvest = async () => {
    if (!agreeChecked) return;
    setAgreeing(true);
    try {
      const res = await fetch('/api/kid/invest-agree', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        await loadMe();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setAgreeing(false);
    }
  };

  const openTrade = (stock, mode) => {
    setTradeStockId(stock.id);
    setTradeMode(mode);
    setTradeQty('');
  };

  const cancelTrade = () => {
    setTradeStockId(null);
    setTradeMode(null);
    setTradeQty('');
  };

  const confirmTrade = async () => {
    const qty = parseInt(tradeQty, 10);
    if (!qty || qty <= 0) return showToast('주식 수를 입력해주세요.');
    setTrading(true);
    try {
      const res = await fetch(`/api/kid/stocks/${tradeStockId}/${tradeMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shares: qty }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(tradeMode === 'buy' ? '매수 완료!' : '매도 완료!');
        cancelTrade();
        await Promise.all([loadStocks(), loadMe()]);
      } else {
        showToast(data.error || '거래에 실패했어요.');
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setTrading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/kid/logout', { method: 'POST' });
    router.push('/');
  };

  if (!me) {
    return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;
  }

  const { kid, level, badges, title } = me;
  const nameLabel = title ? `${title.icon} ${title.name} ${kid.name}` : kid.name;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="금정코인" sub={`${nameLabel}님`} onExit={handleLogout} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-5 space-y-4">
        <div className="hero-coin-card text-white rounded-3xl p-6 text-center">
          <div className="icon-badge icon-badge-gold w-14 h-14 rounded-full text-2xl mx-auto mb-2">🪙</div>
          <div className="text-xs text-white/60">현재 보유 코인</div>
          <div className="font-display text-5xl text-gold my-1">{kid.balance} GC</div>
          <div className="text-sm">{nameLabel}님</div>
        </div>

        <LevelBar level={level} />

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="icon-badge icon-badge-gold w-7 h-7 rounded-lg text-sm">🏅</div>
            <div className="font-display text-base text-navy">내 뱃지</div>
          </div>
          <BadgeGrid earnedKeys={badges.map((b) => b.key)} />
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="icon-badge icon-badge-navy w-7 h-7 rounded-lg text-sm">📈</div>
              <div className="font-display text-base text-navy">모의투자</div>
            </div>
          </div>
          {kid.investAgreedAt && (
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-gray-500">
                평가액 {stocks ? stocks.reduce((s, x) => s + x.myShares * x.price, 0) : 0} GC
              </span>
              <span className={`font-bold ${kid.investRealizedProfit >= 0 ? 'text-mint-deep' : 'text-coral-deep'}`}>
                실현손익 {kid.investRealizedProfit >= 0 ? '+' : ''}
                {kid.investRealizedProfit} GC
              </span>
            </div>
          )}

          {!kid.investAgreedAt ? (
            <div>
              <p className="text-xs text-gray-600 leading-relaxed mb-3">
                모의투자는 실제 돈이 아니라 코인으로 해보는 가상의 투자 놀이예요.
                <br />
                · 종목 가격은 매일 낮 12시에 무작위로 최대 ±8%까지 오르내려요.
                <br />
                · 가격이 내려간 뒤에 팔면 산 만큼 코인을 잃을 수도 있어요. 오른다고 무조건
                이득인 것도, 내린다고 무조건 손해인 것도 아니니 신중하게 생각하고 투자해보세요.
                <br />· &apos;쌀 때 사서 비쌀 때 파는&apos; 원리를 코인으로 연습해보는
                거예요. 재미있게, 그리고 조심스럽게 즐겨봐요!
              </p>
              <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={(e) => setAgreeChecked(e.target.checked)}
                  className="w-4 h-4"
                />
                위 내용을 이해했어요
              </label>
              <button
                disabled={!agreeChecked || agreeing}
                onClick={handleAgreeInvest}
                className="btn-3d btn-3d-navy w-full bg-navy text-white font-display rounded-xl py-3 text-sm disabled:opacity-40"
              >
                {agreeing ? '처리 중...' : '동의하고 시작하기'}
              </button>
            </div>
          ) : (
            <>
              {stocks === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
              {stocks && stocks.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center">아직 등록된 종목이 없어요.</p>
              )}
              {stocks?.map((s) => {
            const up = s.changePct >= 0;
            const isTrading = tradeStockId === s.id;
            return (
              <div key={s.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">
                      {s.emoji} {s.name}
                    </div>
                    <div className={`text-xs font-bold ${up ? 'text-mint-deep' : 'text-coral-deep'}`}>
                      {s.price} GC ({up ? '+' : ''}
                      {s.changePct}%)
                    </div>
                    {s.myShares > 0 && (
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        보유 {s.myShares}주 · 평가 {s.myShares * s.price} GC ·{' '}
                        <span className={s.plAmount >= 0 ? 'text-mint-deep' : 'text-coral-deep'}>
                          {s.plAmount >= 0 ? '+' : ''}
                          {s.plAmount} GC ({s.plPct >= 0 ? '+' : ''}
                          {s.plPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                  <Sparkline values={s.history} color={up ? '#3FB68B' : '#E2574C'} />
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button
                    onClick={() => openTrade(s, 'buy')}
                    className="btn-3d btn-3d-mint flex-1 text-xs bg-mint text-white rounded-lg py-1.5"
                  >
                    매수
                  </button>
                  <button
                    disabled={s.myShares === 0}
                    onClick={() => openTrade(s, 'sell')}
                    className="btn-3d btn-3d-coral flex-1 text-xs bg-coral text-white rounded-lg py-1.5 disabled:opacity-30"
                  >
                    매도
                  </button>
                </div>
                {isTrading && (() => {
                  const qty = Math.max(0, parseInt(tradeQty, 10) || 0);
                  const subtotal = s.price * qty;
                  const fee = Math.round(subtotal * TRADE_FEE_RATE);
                  const total = tradeMode === 'buy' ? subtotal + fee : subtotal - fee;
                  const overBalance = tradeMode === 'buy' && qty > 0 && total > kid.balance;
                  return (
                    <div className="mt-2 bg-paper rounded-lg p-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="1"
                          value={tradeQty}
                          onChange={(e) => setTradeQty(e.target.value)}
                          placeholder="주식 수"
                          className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                        />
                        <button
                          disabled={trading || qty === 0 || overBalance}
                          onClick={confirmTrade}
                          className="btn-3d btn-3d-navy shrink-0 text-xs bg-navy text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                        >
                          확인
                        </button>
                        <button onClick={cancelTrade} className="shrink-0 text-xs text-gray-400 underline px-1">
                          취소
                        </button>
                      </div>
                      {qty === 0 ? (
                        <p className="text-[10.5px] text-gray-400 mt-1.5">수수료 {TRADE_FEE_RATE * 100}%가 붙어요</p>
                      ) : (
                        <div className="text-[11px] text-gray-500 mt-1.5 space-y-0.5">
                          <div className="flex justify-between">
                            <span>
                              {s.price} GC × {qty}주
                            </span>
                            <span>{subtotal} GC</span>
                          </div>
                          <div className="flex justify-between">
                            <span>수수료 ({TRADE_FEE_RATE * 100}%)</span>
                            <span>
                              {tradeMode === 'buy' ? '+' : '-'}
                              {fee} GC
                            </span>
                          </div>
                          <div className="flex justify-between font-bold text-navy pt-1 mt-0.5 border-t border-gray-200">
                            <span>{tradeMode === 'buy' ? '총 결제 금액' : '총 입금 금액'}</span>
                            <span>{total} GC</span>
                          </div>
                          {overBalance && <p className="text-coral-deep font-bold mt-0.5">코인이 부족해요</p>}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
                );
              })}
            </>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-badge icon-badge-grape w-7 h-7 rounded-lg text-sm">🎯</div>
            <div className="font-display text-base text-navy">진행 중인 이벤트</div>
          </div>
          {events === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {events && events.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">지금 진행 중인 이벤트가 없어요.</p>
          )}
          {events?.map((ev) => {
            const isPending = ev.myStatus === 'pending';
            return (
              <div key={ev.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{ev.title}</div>
                    {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                    <div className="text-xs text-gold-deep font-bold mt-1">+{ev.reward} GC</div>
                  </div>
                  <button
                    disabled={isPending || completing === ev.id}
                    onClick={() => handleCompleteEvent(ev)}
                    className={`shrink-0 text-xs font-display px-3.5 py-2 rounded-lg whitespace-nowrap ${
                      isPending ? 'border-2 border-gray-200 text-gray-300' : 'btn-3d btn-3d-mint bg-mint text-white'
                    }`}
                  >
                    {isPending ? '승인 대기 중' : completing === ev.id ? '처리 중...' : '완료했어요'}
                  </button>
                </div>
                {ev.myStatus === 'approved' && (
                  <p className="text-[11px] text-mint-deep mt-1">이전에 승인되어 코인을 받았어요.</p>
                )}
                {ev.myStatus === 'rejected' && (
                  <p className="text-[11px] text-coral-deep mt-1">이전 완료 표시는 거절됐어요.</p>
                )}
              </div>
            );
          })}
        </div>

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
          {menu === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {menu && menu.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">등록된 메뉴가 없어요.</p>
          )}
          {!ordersOpen && menu && menu.length > 0 && (
            <p className="text-xs text-gray-400 py-2 text-center">지금은 주문을 받지 않고 있어요.</p>
          )}
          {menu?.map((item) => {
            const canAfford = ordersOpen && kid.balance >= item.price;
            return (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-dashed border-gray-200 last:border-0">
                <div>
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
                </div>
                <button
                  disabled={!canAfford || ordering === item.id}
                  onClick={() => handleOrder(item)}
                  className={`text-xs font-display px-3.5 py-2 rounded-lg ${
                    canAfford ? 'btn-3d btn-3d-gold bg-gold text-navy-deep' : 'border-2 border-gray-200 text-gray-300'
                  }`}
                >
                  {ordering === item.id ? '주문 중...' : '주문하기'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-badge icon-badge-navy w-7 h-7 rounded-lg text-sm">📜</div>
            <div className="font-display text-base text-navy">내 사용 내역</div>
          </div>
          {history === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {history && history.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">아직 내역이 없어요.</p>}
          {history?.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
              <div>
                <div className="font-medium">{t.reason || (t.type === 'spend' ? '구매' : '지급')}</div>
                <div className="text-[11px] text-gray-400">
                  {fmtDate(t.tx_date)} {fmtTime(t.created_at)}
                </div>
              </div>
              <div className={`font-bold ${t.type === 'spend' ? 'text-coral-deep' : 'text-mint-deep'}`}>
                {t.type === 'spend' ? '-' : '+'}
                {t.amount} GC
              </div>
            </div>
          ))}
        </div>
      </div>

      {celebration && (
        <Celebration
          type={celebration.type}
          amount={celebration.amount}
          level={celebration.level}
          onClose={closeCelebration}
        />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
