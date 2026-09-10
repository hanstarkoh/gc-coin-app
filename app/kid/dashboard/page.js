'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import LevelBar from '@/components/LevelBar';
import BadgeGrid from '@/components/BadgeGrid';
import Celebration from '@/components/Celebration';
import Sparkline from '@/components/Sparkline';
import { ToastProvider, useToast } from '@/components/Toast';
import { TRADE_FEE_RATE } from '@/lib/stocks';
import { calcPayout } from '@/lib/deposits';
import { MEGAPHONE_PRICE, MESSAGE_MAX_LENGTH } from '@/lib/announcements';
import { MENU_CATEGORIES } from '@/lib/menuCategories';

function fmtDate(d) {
  return d.replaceAll('-', '.');
}
function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Collapsible({ icon, badgeColor = 'navy', title, right, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-2 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`icon-badge icon-badge-${badgeColor} w-7 h-7 rounded-lg text-sm shrink-0`}>{icon}</div>
          <div className="font-display text-base text-navy truncate">{title}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {right}
          <span className={`text-gray-400 text-[10px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function DashboardInner() {
  const router = useRouter();
  const showToast = useToast();
  const [me, setMe] = useState(null);
  const [menu, setMenu] = useState(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyMonth, setHistoryMonth] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
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
  const [goals, setGoals] = useState(null);
  const [donateAmount, setDonateAmount] = useState('');
  const [donating, setDonating] = useState(false);
  const [orderItemId, setOrderItemId] = useState(null);
  const [orderQty, setOrderQty] = useState('1');
  const [announceText, setAnnounceText] = useState('');
  const [announcing, setAnnouncing] = useState(false);

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

  const loadGoals = useCallback(async () => {
    const res = await fetch('/api/kid/goals');
    const data = await res.json();
    if (data.ok) setGoals(data);
  }, []);

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
      await loadGoals();
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

  const openOrder = (item) => {
    setOrderItemId(item.id);
    setOrderQty('1');
  };

  const cancelOrder = () => {
    setOrderItemId(null);
    setOrderQty('1');
  };

  const handleOrder = async (item) => {
    const qty = Math.max(1, parseInt(orderQty, 10) || 0);
    if (!qty) return showToast('수량을 확인해주세요.');
    if (!confirm(`${item.name} ${qty}개 (${item.price * qty} GC)를 주문할까요?`)) return;
    setOrdering(item.id);
    try {
      const res = await fetch('/api/kid/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, quantity: qty }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`${item.name} ${qty}개 주문 완료!`);
        cancelOrder();
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

  const handleAnnounce = async () => {
    const text = announceText.trim();
    if (!text) return showToast('메시지를 입력해주세요.');
    if (
      !confirm(
        '부적절한 글은 선생님에게 제재를 받을 수 있어요. 오늘 하루 동안 메인 화면에 표시되는데, 계속할까요?'
      )
    )
      return;
    setAnnouncing(true);
    try {
      const res = await fetch('/api/kid/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('확성기로 소식을 전했어요!');
        setAnnounceText('');
        await loadMe();
      } else {
        showToast(data.error || '전송에 실패했어요.');
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setAnnouncing(false);
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

  const handleDonate = async (goal) => {
    const amt = parseInt(donateAmount, 10);
    if (!amt || amt <= 0) return showToast('기부할 코인 수를 입력해주세요.');
    if (!confirm(`"${goal.title}"에 ${amt} GC를 기부할까요?`)) return;
    setDonating(true);
    try {
      const res = await fetch(`/api/kid/goals/${goal.id}/donate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.achieved ? '🎉 목표를 달성했어요!' : '기부 완료! 고마워요.');
        setDonateAmount('');
        await Promise.all([loadGoals(), loadMe()]);
      } else {
        showToast(data.error || '기부에 실패했어요.');
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setDonating(false);
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

  const { kid, level, badges, title, theme } = me;
  const nameLabel = title ? `${title.icon} ${title.name} ${kid.name}` : kid.name;
  const heroStyle = theme
    ? { background: `linear-gradient(165deg, ${theme.from} 0%, ${theme.mid} 55%, ${theme.to} 100%)` }
    : undefined;
  const readyOrders = (history || []).filter((t) => t.type === 'spend' && !t.fulfilled && t.ready_at);

  const HISTORY_PAGE_SIZE = 10;
  const historyMonths = [...new Set((history || []).map((t) => t.tx_date.slice(0, 7)))].sort().reverse();
  const currentHistoryMonth = historyMonth && historyMonths.includes(historyMonth) ? historyMonth : historyMonths[0];
  const historyForMonth = (history || []).filter((t) => t.tx_date.slice(0, 7) === currentHistoryMonth);
  const historyTotalPages = Math.max(1, Math.ceil(historyForMonth.length / HISTORY_PAGE_SIZE));
  const historyPageClamped = Math.min(historyPage, historyTotalPages);
  const pagedHistory = historyForMonth.slice(
    (historyPageClamped - 1) * HISTORY_PAGE_SIZE,
    historyPageClamped * HISTORY_PAGE_SIZE
  );
  const changeHistoryMonth = (m) => {
    setHistoryMonth(m);
    setHistoryPage(1);
  };
  const refreshHistory = async () => {
    setHistoryRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setHistoryRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="금정코인" sub={`${nameLabel}님`} onExit={handleLogout} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-5 space-y-4">
        {readyOrders.length > 0 && (
          <div className="bg-gold border-2 border-gold-deep rounded-2xl p-4 animate-popIn">
            <div className="font-display text-base text-navy-deep mb-1.5">🔔 픽업 준비 완료!</div>
            {readyOrders.map((o) => (
              <div key={o.id} className="text-sm text-navy-deep font-medium">
                {o.reason}
                {o.quantity > 1 ? ` × ${o.quantity}` : ''} — <span className="font-bold">{o.pickup_location || '사무실'}</span>로 받으러 오세요!
              </div>
            ))}
          </div>
        )}

        <div className="hero-coin-card text-white rounded-3xl p-6 text-center" style={heroStyle}>
          <div className="icon-badge icon-badge-gold w-14 h-14 rounded-full text-2xl mx-auto mb-2">🪙</div>
          <div className="text-xs text-white/60">현재 보유 코인</div>
          <div className="balance-glow font-display text-5xl text-gold my-1">{kid.balance} GC</div>
          <div className="text-sm">{nameLabel}님</div>
        </div>

        <LevelBar level={level} />

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/kid/room"
            className="btn-3d btn-3d-navy block bg-navy text-white rounded-2xl py-3 text-center font-display text-sm"
          >
            🏠 내 마이룸
          </Link>
          <Link
            href="/kid/room/friends"
            className="btn-3d btn-3d-grape block bg-grape text-white rounded-2xl py-3 text-center font-display text-sm"
          >
            👥 친구 마이룸
          </Link>
        </div>

        <Collapsible icon="🏅" badgeColor="gold" title="내 뱃지" defaultOpen={false}>
          <BadgeGrid earnedKeys={badges.map((b) => b.key)} />
        </Collapsible>

        <ShopCard kidBalance={kid.balance} onChange={loadMe} showToast={showToast} />

        <Collapsible icon="📈" badgeColor="navy" title="모의투자" defaultOpen={true}>
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
        </Collapsible>

        <DepositsCard kidBalance={kid.balance} onChange={loadMe} showToast={showToast} />

        <PredictionsCard kidBalance={kid.balance} onChange={loadMe} showToast={showToast} />

        <Collapsible icon="🎉" badgeColor="coral" title="기부함" defaultOpen={true}>
          {goals === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {goals && goals.goals.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">지금 진행 중인 공동 목표가 없어요.</p>
          )}
          {goals?.goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            return (
              <div key={g.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm">{g.title}</div>
                  <span className="text-xs text-gray-500">
                    {g.current} / {g.target} GC
                  </span>
                </div>
                {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-coral to-coral-deep rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {g.achieved_at && (
                  <p className="text-xs font-bold text-mint-deep mt-1.5">🎉 목표 달성! 관리자가 곧 진행해줄 거예요.</p>
                )}

                {g.topDonors.length > 0 && (
                  <div className="mt-2.5">
                    <div className="text-[11px] font-bold text-gray-500 mb-1">🏆 기부 랭킹</div>
                    {g.topDonors.map((d, i) => (
                      <div key={d.kidId} className="flex items-center justify-between text-xs py-0.5">
                        <span className={i === 0 ? 'font-bold text-gold-deep' : 'text-gray-600'}>
                          {i + 1}. {d.kidName}
                        </span>
                        <span className={i === 0 ? 'font-bold text-gold-deep' : 'text-gray-500'}>{d.amount} GC</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-2.5">
                  <input
                    type="number"
                    min="1"
                    value={donateAmount}
                    onChange={(e) => setDonateAmount(e.target.value)}
                    placeholder="기부할 GC"
                    className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                  />
                  <button
                    disabled={donating}
                    onClick={() => handleDonate(g)}
                    className="btn-3d btn-3d-coral shrink-0 text-xs bg-coral text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                  >
                    기부하기
                  </button>
                </div>
              </div>
            );
          })}
        </Collapsible>

        <Collapsible icon="📢" badgeColor="gold" title="확성기로 소식 전하기" defaultOpen={false}>
          <p className="text-xs text-gray-500 mb-2">
            {MEGAPHONE_PRICE} GC를 내면 오늘 하루 동안 홈 화면 위쪽에 내 한마디가 돌아가며 나와요. 부적절한 글은
            선생님에게 제재를 받을 수 있어요.
          </p>
          <textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
            placeholder="예: 오늘 급식 미역국 대박!"
            rows={2}
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10.5px] text-gray-400">
              {announceText.length} / {MESSAGE_MAX_LENGTH}자
            </span>
            <button
              disabled={announcing || !announceText.trim()}
              onClick={handleAnnounce}
              className="btn-3d btn-3d-gold text-xs bg-gold text-navy-deep font-display rounded-lg px-4 py-2 disabled:opacity-40"
            >
              {announcing ? '전송 중...' : `전하기 (${MEGAPHONE_PRICE} GC)`}
            </button>
          </div>
        </Collapsible>

        <Collapsible icon="🎯" badgeColor="grape" title="진행 중인 이벤트" defaultOpen={true}>
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
        </Collapsible>

        <Collapsible
          icon="🍪"
          badgeColor="mint"
          title="금청수 상점"
          defaultOpen={true}
          right={
            <span
              className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                ordersOpen ? 'bg-mint/15 text-mint-deep' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {ordersOpen ? '주문 가능' : '주문 마감'}
            </span>
          }
        >
          {menu === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {menu && menu.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">등록된 메뉴가 없어요.</p>
          )}
          {!ordersOpen && menu && menu.length > 0 && (
            <p className="text-xs text-gray-400 py-2 text-center">지금은 주문을 받지 않고 있어요.</p>
          )}
          {MENU_CATEGORIES.map((cat) => {
            const items = (menu || []).filter((item) => (item.category || 'snack') === cat.key);
            if (items.length === 0) return null;
            return (
              <div key={cat.key} className="pt-3 first:pt-0">
                <div className="text-[11px] font-bold text-gray-400 mb-0.5">{cat.label}</div>
                {items.map((item) => {
                  const soldOut = item.stock !== null && item.stock <= 0;
                  const canAfford = ordersOpen && !soldOut && kid.balance >= item.price;
                  const isOrdering = orderItemId === item.id;
                  const qty = Math.max(1, parseInt(orderQty, 10) || 0);
                  const maxQty = item.stock !== null ? item.stock : null;
                  return (
                    <div key={item.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-sm">{item.name}</div>
                          <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
                          {item.stock !== null && !soldOut && (
                            <div className="text-[11px] text-gray-400">재고 {item.stock}개</div>
                          )}
                        </div>
                        {soldOut ? (
                          <span className="text-xs font-bold px-3.5 py-2 rounded-lg bg-gray-100 text-gray-400">품절</span>
                        ) : (
                          <button
                            disabled={!canAfford || ordering === item.id}
                            onClick={() => (isOrdering ? cancelOrder() : openOrder(item))}
                            className={`text-xs font-display px-3.5 py-2 rounded-lg ${
                              canAfford
                                ? 'btn-3d btn-3d-gold bg-gold text-navy-deep'
                                : 'border-2 border-gray-200 text-gray-300'
                            }`}
                          >
                            {isOrdering ? '주문 취소' : '주문하기'}
                          </button>
                        )}
                      </div>
                      {isOrdering && (
                        <div className="flex items-center gap-1.5 mt-2 bg-paper rounded-lg p-2">
                          <input
                            type="number"
                            min="1"
                            max={maxQty || undefined}
                            value={orderQty}
                            onChange={(e) => setOrderQty(e.target.value)}
                            placeholder="수량"
                            className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                          />
                          <span className="text-xs text-gray-500 shrink-0">{item.price * qty} GC</span>
                          <button
                            disabled={
                              ordering === item.id || (maxQty !== null && qty > maxQty) || item.price * qty > kid.balance
                            }
                            onClick={() => handleOrder(item)}
                            className="btn-3d btn-3d-gold shrink-0 text-xs bg-gold text-navy-deep rounded-lg px-3 py-1.5 disabled:opacity-40"
                          >
                            {ordering === item.id ? '주문 중...' : '확인'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </Collapsible>

        <Collapsible
          icon="📜"
          badgeColor="navy"
          title="내 사용 내역"
          defaultOpen={false}
          right={
            <span
              role="button"
              aria-label="새로고침"
              onClick={(e) => {
                e.stopPropagation();
                if (!historyRefreshing) refreshHistory();
              }}
              className={`text-gray-400 text-sm px-1 ${historyRefreshing ? 'animate-spin' : ''}`}
            >
              🔄
            </span>
          }
        >
          {history === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {history && history.length === 0 && <p className="text-xs text-gray-400 py-4 text-center">아직 내역이 없어요.</p>}
          {history && history.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <button
                disabled={historyMonths.indexOf(currentHistoryMonth) >= historyMonths.length - 1}
                onClick={() => changeHistoryMonth(historyMonths[historyMonths.indexOf(currentHistoryMonth) + 1])}
                className="text-xs px-2 py-1 rounded-lg border-2 border-gray-200 text-gray-500 disabled:opacity-30"
              >
                ← 이전달
              </button>
              <span className="font-display text-sm text-navy">
                {currentHistoryMonth
                  ? `${currentHistoryMonth.slice(0, 4)}년 ${Number(currentHistoryMonth.slice(5, 7))}월`
                  : ''}
              </span>
              <button
                disabled={historyMonths.indexOf(currentHistoryMonth) <= 0}
                onClick={() => changeHistoryMonth(historyMonths[historyMonths.indexOf(currentHistoryMonth) - 1])}
                className="text-xs px-2 py-1 rounded-lg border-2 border-gray-200 text-gray-500 disabled:opacity-30"
              >
                다음달 →
              </button>
            </div>
          )}
          {pagedHistory.map((t) => (
            <div key={t.id} className="py-2 border-b border-gray-100 last:border-0 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {t.reason || (t.type === 'spend' ? '구매' : '지급')}
                    {t.type === 'spend' && t.quantity > 1 ? ` × ${t.quantity}` : ''}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {fmtDate(t.tx_date)} {fmtTime(t.created_at)}
                  </div>
                </div>
                <div className={`font-bold ${t.type === 'spend' ? 'text-coral-deep' : 'text-mint-deep'}`}>
                  {t.type === 'spend' ? '-' : '+'}
                  {t.amount} GC
                </div>
              </div>
              {t.type === 'spend' && !t.fulfilled && (
                <p className={`text-[11px] mt-1 font-bold ${t.ready_at ? 'text-gold-deep' : 'text-gray-400'}`}>
                  {t.ready_at ? `🔔 ${t.pickup_location || '사무실'}로 받으러 오세요!` : '준비 중이에요'}
                </p>
              )}
            </div>
          ))}
          {historyForMonth.length > 0 && historyTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                disabled={historyPageClamped <= 1}
                onClick={() => setHistoryPage(historyPageClamped - 1)}
                className="text-xs w-7 h-7 rounded-full border-2 border-gray-200 text-gray-500 disabled:opacity-30"
              >
                ‹
              </button>
              <span className="text-xs text-gray-400">
                {historyPageClamped} / {historyTotalPages}
              </span>
              <button
                disabled={historyPageClamped >= historyTotalPages}
                onClick={() => setHistoryPage(historyPageClamped + 1)}
                className="text-xs w-7 h-7 rounded-full border-2 border-gray-200 text-gray-500 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}
        </Collapsible>
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

const SHOP_SECTIONS = [
  { key: 'avatar', label: '아바타', icon: '🐻', equippable: true },
  { key: 'accessory', label: '액세서리', icon: '🎩', equippable: true },
  { key: 'sticker', label: '이름 스티커', icon: '⭐', equippable: true },
  { key: 'theme', label: '카드 테마', icon: '🎨', equippable: true },
  { key: 'furniture', label: '가구', icon: '🛋️', equippable: false },
  { key: 'special', label: '특별 효과', icon: '✨', equippable: false },
];

function ShopCard({ kidBalance, onChange, showToast }) {
  const [data, setData] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [activeCat, setActiveCat] = useState('avatar');

  const load = useCallback(async () => {
    const res = await fetch('/api/kid/shop');
    const json = await res.json();
    if (json.ok) setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const buy = async (category, key) => {
    setBusyKey(key);
    try {
      const res = await fetch('/api/kid/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, key }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('구매했어요!');
        await load();
        await onChange();
      } else {
        showToast(json.error || '구매에 실패했어요.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const equip = async (category, key) => {
    setBusyKey(key || `unequip-${category}`);
    try {
      const res = await fetch('/api/kid/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, key }),
      });
      const json = await res.json();
      if (json.ok) {
        await load();
        if (category === 'theme') await onChange();
      } else {
        showToast(json.error || '처리에 실패했어요.');
      }
    } finally {
      setBusyKey(null);
    }
  };

  const sec = SHOP_SECTIONS.find((s) => s.key === activeCat) || SHOP_SECTIONS[0];

  return (
    <Collapsible icon="🛍️" badgeColor="gold" title="상점" defaultOpen={false}>
      {data === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
      {data?.categories && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
            {SHOP_SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveCat(s.key)}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border-[1.5px] flex items-center gap-1 ${
                  activeCat === s.key ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-500'
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {data.categories[sec.key].map((item) => {
              const isEquipped = sec.equippable && data.equipped[sec.key] === item.key;
              const isBusy = busyKey === item.key;
              return (
                <div
                  key={item.key}
                  className={`rounded-xl border-2 p-2 text-center ${
                    isEquipped ? 'border-gold bg-gold/10' : 'border-gray-100'
                  }`}
                >
                  {sec.key === 'theme' ? (
                    <div
                      className="w-8 h-8 rounded-full mx-auto mb-1"
                      style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
                    />
                  ) : (
                    <div className="text-xl mb-1">{item.emoji}</div>
                  )}
                  <div className="text-[10px] font-medium text-navy leading-tight">{item.name}</div>
                  {!item.owned && <div className="text-[10px] text-gold-deep font-bold">{item.price} GC</div>}
                  {sec.key === 'special' && item.owned && item.expiresAt && (
                    <div className="text-[9px] text-gray-400">
                      {Math.max(1, Math.ceil((new Date(item.expiresAt) - Date.now()) / 86400000))}일 남음
                    </div>
                  )}
                  {!item.owned ? (
                    <button
                      disabled={isBusy || kidBalance < item.price}
                      onClick={() => buy(sec.key, item.key)}
                      className="btn-3d btn-3d-gold mt-1 w-full text-[10px] bg-gold text-navy-deep rounded-lg py-1 disabled:opacity-40"
                    >
                      구매
                    </button>
                  ) : sec.equippable ? (
                    <button
                      disabled={isBusy}
                      onClick={() => equip(sec.key, isEquipped ? null : item.key)}
                      className={`mt-1 w-full text-[10px] rounded-lg py-1 ${
                        isEquipped
                          ? 'bg-gold text-navy-deep font-bold'
                          : 'btn-3d btn-3d-outline border-2 border-navy text-navy'
                      }`}
                    >
                      {isEquipped ? '착용 중' : '착용'}
                    </button>
                  ) : (
                    <div className="mt-1 text-[10px] text-mint-deep font-bold">보유 중</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Collapsible>
  );
}

function DepositsCard({ kidBalance, onChange, showToast }) {
  const [data, setData] = useState(null);
  const [selectedDays, setSelectedDays] = useState(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/kid/deposits');
    const json = await res.json();
    if (json.ok) {
      setData(json);
      if (json.claimed) await onChange();
    }
  }, [onChange]);

  useEffect(() => {
    load();
  }, [load]);

  const subscribe = async () => {
    const amt = parseInt(amount, 10);
    if (!selectedDays || !amt || amt <= 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/kid/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: selectedDays, amount: amt }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('예금에 가입했어요!');
        setAmount('');
        setSelectedDays(null);
        await load();
        await onChange();
      } else {
        showToast(json.error || '가입에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const activeDeposits = (data?.deposits || []).filter((d) => !d.claimed);

  return (
    <Collapsible icon="🏦" badgeColor="mint" title="예금" defaultOpen={false}>
      {data === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
      {data && (
        <>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            정해진 기간 동안 코인을 넣어두면 이자를 더해 돌려받아요. 주식보다 안전한 대신 적게 벌어요.
          </p>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {data.plans.map((p) => (
              <button
                key={p.days}
                onClick={() => setSelectedDays(p.days === selectedDays ? null : p.days)}
                className={`rounded-xl border-2 p-2 text-center ${
                  selectedDays === p.days ? 'border-gold bg-gold/10' : 'border-gray-100'
                }`}
              >
                <div className="text-xs font-bold text-navy">{p.weeks}주</div>
                <div className="text-[10px] text-mint-deep font-bold">+{p.ratePct}%</div>
              </button>
            ))}
          </div>
          {selectedDays && (
            <div className="flex items-center gap-1.5 mb-3 bg-paper rounded-lg p-2">
              <input
                type="number"
                min={data.minAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`최소 ${data.minAmount} GC`}
                className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
              <button
                disabled={busy || !amount || Number(amount) > kidBalance}
                onClick={subscribe}
                className="btn-3d btn-3d-mint shrink-0 text-xs bg-mint text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                가입하기
              </button>
            </div>
          )}

          {activeDeposits.length === 0 ? (
            <p className="text-xs text-gray-400 py-2 text-center border-t border-gray-100 pt-3">
              가입한 예금이 없어요.
            </p>
          ) : (
            activeDeposits.map((d) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(d.matures_at) - Date.now()) / 86400000));
              return (
                <div key={d.id} className="flex items-center justify-between py-2 border-t border-gray-100 text-sm">
                  <div>
                    <div className="font-medium">
                      {d.principal} GC · {d.term_days}일 (+{Number(d.rate_pct)}%)
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {daysLeft === 0 ? '오늘 만기' : `만기까지 ${daysLeft}일`}
                    </div>
                  </div>
                  <div className="text-xs text-gold-deep font-bold">
                    만기 시 {calcPayout(d.principal, Number(d.rate_pct))} GC
                  </div>
                </div>
              );
            })
          )}
        </>
      )}
    </Collapsible>
  );
}

function PredictionsCard({ kidBalance, onChange, showToast }) {
  const [predictions, setPredictions] = useState(null);
  const [betId, setBetId] = useState(null);
  const [betOption, setBetOption] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/kid/predictions');
    const json = await res.json();
    if (json.ok) setPredictions(json.predictions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openBet = (p) => {
    setBetId(p.id === betId ? null : p.id);
    setBetOption(null);
    setBetAmount('');
  };

  const confirmBet = async (p) => {
    const amt = parseInt(betAmount, 10);
    if (!betOption || !amt || amt <= 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kid/predictions/${p.id}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option: betOption, amount: amt }),
      });
      const json = await res.json();
      if (json.ok) {
        showToast('베팅했어요!');
        setBetId(null);
        await load();
        await onChange();
      } else {
        showToast(json.error || '베팅에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Collapsible icon="🎲" badgeColor="grape" title="예측 시장" defaultOpen={false}>
      {predictions === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
      {predictions && predictions.length === 0 && (
        <p className="text-xs text-gray-400 py-4 text-center">아직 올라온 질문이 없어요.</p>
      )}
      {predictions?.map((p) => {
        const total = p.poolA + p.poolB;
        const pctA = total > 0 ? Math.round((p.poolA / total) * 100) : 50;
        const isBetting = betId === p.id;
        const isOpen = p.status === 'open';
        return (
          <div key={p.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm">{p.question}</div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  p.status === 'open'
                    ? 'bg-mint/15 text-mint-deep'
                    : p.status === 'closed'
                    ? 'bg-gray-100 text-gray-500'
                    : 'bg-gold/15 text-gold-deep'
                }`}
              >
                {p.status === 'open' ? '진행 중' : p.status === 'closed' ? '마감' : '결과 발표'}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-coral/20 overflow-hidden mt-2">
              <div className="h-full bg-mint" style={{ width: `${pctA}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
              <span>
                {p.option_a} {p.poolA} GC
              </span>
              <span>
                {p.option_b} {p.poolB} GC
              </span>
            </div>

            {p.status === 'resolved' && (
              <p className="text-xs font-bold text-gold-deep mt-1.5">
                정답: {p.resolved_option === 'a' ? p.option_a : p.option_b}
                {p.myBet && (
                  <span className={p.myBet.payout > 0 ? 'text-mint-deep' : 'text-coral-deep'}>
                    {' '}
                    · {p.myBet.payout > 0 ? `+${p.myBet.payout} GC 받음!` : '틀렸어요'}
                  </span>
                )}
              </p>
            )}

            {p.status !== 'resolved' && p.myBet && (
              <p className="text-xs text-gray-500 mt-1.5">
                내 베팅: {p.myBet.option === 'a' ? p.option_a : p.option_b} {p.myBet.amount} GC
              </p>
            )}

            {isOpen && !p.myBet && (
              <>
                <button
                  onClick={() => openBet(p)}
                  className="btn-3d btn-3d-grape mt-2 w-full text-xs bg-grape text-white rounded-lg py-1.5"
                >
                  {isBetting ? '접기' : '베팅하기'}
                </button>
                {isBetting && (
                  <div className="mt-2 bg-paper rounded-lg p-2">
                    <div className="flex gap-1.5 mb-1.5">
                      <button
                        onClick={() => setBetOption('a')}
                        className={`flex-1 text-xs rounded-lg py-1.5 ${
                          betOption === 'a' ? 'bg-mint text-white font-bold' : 'border-2 border-gray-200 text-gray-500'
                        }`}
                      >
                        {p.option_a}
                      </button>
                      <button
                        onClick={() => setBetOption('b')}
                        className={`flex-1 text-xs rounded-lg py-1.5 ${
                          betOption === 'b' ? 'bg-coral text-white font-bold' : 'border-2 border-gray-200 text-gray-500'
                        }`}
                      >
                        {p.option_b}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        placeholder="베팅할 GC"
                        className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-sm"
                      />
                      <button
                        disabled={busy || !betOption || !betAmount || Number(betAmount) > kidBalance}
                        onClick={() => confirmBet(p)}
                        className="btn-3d btn-3d-navy shrink-0 text-xs bg-navy text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                      >
                        확인
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </Collapsible>
  );
}

export default function DashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
