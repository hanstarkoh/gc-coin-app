'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import LevelBar from '@/components/LevelBar';
import BadgeGrid from '@/components/BadgeGrid';
import Celebration from '@/components/Celebration';
import { ToastProvider, useToast } from '@/components/Toast';

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
  const [history, setHistory] = useState(null);
  const [ordering, setOrdering] = useState(null);
  const [celebration, setCelebration] = useState(null);

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
    if (data.ok) setMenu(data.items);
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/kid/history');
    const data = await res.json();
    if (data.ok) setHistory(data.transactions);
    return data.ok ? data.transactions : [];
  }, []);

  useEffect(() => {
    (async () => {
      const meData = await loadMe();
      await loadMenu();
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

  const handleLogout = async () => {
    await fetch('/api/kid/logout', { method: 'POST' });
    router.push('/');
  };

  if (!me) {
    return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;
  }

  const { kid, level, badges } = me;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="금정코인" sub={`${kid.name}님`} onExit={handleLogout} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-5 space-y-4">
        <div className="bg-navy text-white rounded-2xl p-6 text-center">
          <div className="text-xs text-white/60">현재 보유 코인</div>
          <div className="font-display text-5xl text-gold my-1">{kid.balance} GC</div>
          <div className="text-sm">{kid.name}님</div>
        </div>

        <LevelBar level={level} />

        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4">
          <div className="font-display text-base text-navy mb-3">내 뱃지</div>
          <BadgeGrid earnedKeys={badges.map((b) => b.key)} />
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4">
          <div className="font-display text-base text-navy mb-1">오늘의 메뉴 ({fmtDate(today)})</div>
          {menu === null && <p className="text-xs text-gray-400 py-4 text-center">불러오는 중...</p>}
          {menu && menu.length === 0 && (
            <p className="text-xs text-gray-400 py-4 text-center">오늘은 아직 메뉴가 올라오지 않았어요.</p>
          )}
          {menu?.map((item) => {
            const canAfford = kid.balance >= item.price;
            return (
              <div key={item.id} className="flex items-center justify-between py-3 border-b border-dashed border-gray-200 last:border-0">
                <div>
                  <div className="font-bold text-sm">{item.name}</div>
                  <div className="text-xs text-gold-deep font-bold">{item.price} GC</div>
                </div>
                <button
                  disabled={!canAfford || ordering === item.id}
                  onClick={() => handleOrder(item)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-lg ${
                    canAfford ? 'bg-gold text-navy-deep' : 'border-2 border-gray-200 text-gray-300'
                  }`}
                >
                  {ordering === item.id ? '주문 중...' : '주문하기'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4">
          <div className="font-display text-base text-navy mb-1">내 사용 내역</div>
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
