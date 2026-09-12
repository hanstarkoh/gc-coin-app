'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { ToastProvider, useToast } from '@/components/Toast';
import { MENU_CATEGORIES, DEFAULT_MENU_CATEGORY, MENU_DESCRIPTION_MAX_LENGTH } from '@/lib/menuCategories';

const TABS = [
  { key: 'attendance', label: '출석 · 코인 지급' },
  { key: 'menu', label: '메뉴 관리' },
  { key: 'orders', label: '주문 현황' },
  { key: 'events', label: '이벤트' },
  { key: 'stocks', label: '종목 관리' },
  { key: 'predictions', label: '예측 시장' },
  { key: 'goals', label: '기부함' },
  { key: 'announcements', label: '확성기' },
  { key: 'kids', label: '청소년 관리' },
  { key: 'history', label: '전체 현황' },
  { key: 'settings', label: '설정' },
];

const ORDER_POLL_MS = 15000;

function fmtDate(d) {
  return d.replaceAll('-', '.');
}
function fmtTime(ts) {
  const dt = new Date(ts);
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function DashboardInner() {
  const router = useRouter();
  const showToast = useToast();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('attendance');
  const [kids, setKids] = useState([]);
  const [todayTx, setTodayTx] = useState([]);
  const [pendingEventCount, setPendingEventCount] = useState(0);
  const [readyGoalCount, setReadyGoalCount] = useState(0);

  const checkAuth = useCallback(async () => {
    const res = await fetch('/api/admin/me');
    const data = await res.json();
    if (!data.ok || !data.isAdmin) {
      router.push('/admin');
      return false;
    }
    return true;
  }, [router]);

  const loadKids = useCallback(async () => {
    const res = await fetch('/api/admin/kids');
    const data = await res.json();
    if (data.ok) setKids(data.kids);
  }, []);

  const loadTodayTx = useCallback(async () => {
    const res = await fetch(`/api/admin/transactions?date=${todayStr()}`);
    const data = await res.json();
    if (data.ok) setTodayTx(data.transactions);
  }, []);

  const loadPendingEventCount = useCallback(async () => {
    const res = await fetch('/api/admin/events/submissions?status=pending');
    const data = await res.json();
    if (data.ok) setPendingEventCount(data.submissions.length);
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await checkAuth();
      if (!ok) return;
      await Promise.all([loadKids(), loadTodayTx(), loadPendingEventCount()]);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const id = setInterval(loadTodayTx, ORDER_POLL_MS);
    return () => clearInterval(id);
  }, [ready, loadTodayTx]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  if (!ready) return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;

  const attendedTodaySet = new Set(todayTx.filter((t) => t.reason === '출석').map((t) => t.kid_id));
  const earnedToday = todayTx.filter((t) => t.type !== 'spend').reduce((s, t) => s + t.amount, 0);
  const todayOrders = todayTx
    .filter((t) => t.type === 'spend')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const spentToday = todayOrders.reduce((s, t) => s + t.amount, 0);
  const unfulfilledOrderCount = todayOrders.filter((t) => !t.fulfilled).length;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="관리자 화면" sub={fmtDate(todayStr())} onExit={handleLogout} />
      <div className="flex-1 max-w-[920px] w-full mx-auto px-4 py-5">
        <div className="grid grid-cols-4 gap-2.5 mb-5">
          <StatBox icon="🧒" badge="navy" num={kids.length} label="전체 청소년" />
          <StatBox icon="✅" badge="mint" num={attendedTodaySet.size} label="오늘 출석" />
          <StatBox icon="🪙" badge="gold" num={`+${earnedToday}`} label="오늘 지급 GC" />
          <StatBox icon="🛍️" badge="grape" num={`-${spentToday}`} label="오늘 사용 GC" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap text-sm px-3.5 py-2 rounded-full border-[1.5px] ${
                tab === t.key ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-500'
              }`}
            >
              {t.key === 'events' && pendingEventCount > 0
                ? `${t.label} (${pendingEventCount})`
                : t.key === 'orders' && unfulfilledOrderCount > 0
                ? `${t.label} (${unfulfilledOrderCount})`
                : t.key === 'goals' && readyGoalCount > 0
                ? `${t.label} (${readyGoalCount})`
                : t.label}
            </button>
          ))}
        </div>

        {tab === 'attendance' && (
          <AttendanceTab
            kids={kids}
            attendedTodaySet={attendedTodaySet}
            reload={async () => {
              await Promise.all([loadKids(), loadTodayTx()]);
            }}
            showToast={showToast}
          />
        )}
        {tab === 'menu' && <MenuTab showToast={showToast} />}
        {tab === 'orders' && <OrdersTab orders={todayOrders} onRefresh={loadTodayTx} showToast={showToast} />}
        {tab === 'events' && (
          <EventsTab showToast={showToast} onPendingCountChange={setPendingEventCount} />
        )}
        {tab === 'stocks' && <StocksTab showToast={showToast} />}
        {tab === 'predictions' && <PredictionsTab showToast={showToast} />}
        {tab === 'goals' && <GoalsTab showToast={showToast} onReadyCountChange={setReadyGoalCount} />}
        {tab === 'announcements' && <AnnouncementsTab showToast={showToast} />}
        {tab === 'kids' && (
          <KidsTab kids={kids} reload={loadKids} showToast={showToast} />
        )}
        {tab === 'history' && <HistoryTab kids={kids} showToast={showToast} />}
        {tab === 'settings' && <SettingsTab showToast={showToast} />}
      </div>
    </div>
  );
}

function StatBox({ icon, badge, num, label }) {
  return (
    <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-3 text-center">
      <div className={`icon-badge icon-badge-${badge} w-9 h-9 rounded-full text-base mx-auto mb-1.5`}>{icon}</div>
      <div className="font-display text-xl text-navy">{num}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 mb-3.5">
      {title && <div className="font-display text-base text-navy mb-3">{title}</div>}
      {children}
    </div>
  );
}

/* ---------------- ATTENDANCE / BONUS TAB ---------------- */
function AttendanceTab({ kids, attendedTodaySet, reload, showToast }) {
  const [selected, setSelected] = useState(new Set());
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [giving, setGiving] = useState(false);
  const [givingBonus, setGivingBonus] = useState(false);

  if (kids.length === 0) {
    return <Card>등록된 청소년이 없어요. 먼저 &apos;청소년 관리&apos; 탭에서 추가해주세요.</Card>;
  }

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(kids.map((k) => k.id)));
  const selectNone = () => setSelected(new Set());

  const giveAttendance = async () => {
    if (selected.size === 0) return showToast('선택된 청소년이 없어요.');
    setGiving(true);
    try {
      const res = await fetch('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || '출석 코인을 지급했어요.');
        await reload();
      } else {
        showToast(data.error || '지급에 실패했어요.');
      }
    } finally {
      setGiving(false);
    }
  };

  const giveBonus = async () => {
    const amt = parseInt(bonusAmount, 10);
    if (selected.size === 0) return showToast('보너스를 받을 청소년을 선택해주세요.');
    if (!amt || amt <= 0) return showToast('지급 코인을 확인해주세요.');
    setGivingBonus(true);
    try {
      const res = await fetch('/api/admin/bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidIds: Array.from(selected), amount: amt, reason: bonusReason }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`${data.given}명에게 보너스 코인을 지급했어요.`);
        setBonusAmount('');
        setBonusReason('');
        await reload();
      } else {
        showToast(data.error || '지급에 실패했어요.');
      }
    } finally {
      setGivingBonus(false);
    }
  };

  return (
    <>
      <Card title={`청소년 선택 (${selected.size}명 선택됨)`}>
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          체크한 청소년에게 아래 출석 지급 · 보너스 지급을 한 번에 적용할 수 있어요.
        </p>
        <div className="flex gap-2 mb-2.5">
          <button onClick={selectAll} className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-3 py-1.5">
            전체 선택
          </button>
          <button onClick={selectNone} className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-3 py-1.5">
            선택 해제
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b-2 border-gray-100">
              <th className="py-1.5"></th>
              <th className="py-1.5">이름</th>
              <th className="py-1.5 text-right">현재 코인</th>
            </tr>
          </thead>
          <tbody>
            {kids.map((k) => {
              const done = attendedTodaySet.has(k.id);
              return (
                <tr key={k.id} className="border-b border-gray-50">
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px]"
                      checked={selected.has(k.id)}
                      onChange={() => toggle(k.id)}
                    />
                  </td>
                  <td className="py-1.5">
                    {k.name} {done && <span className="text-gray-400 text-xs">(오늘 출석지급됨)</span>}
                  </td>
                  <td className="py-1.5 text-right">{k.balance} GC</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="오늘 출석 코인 지급 (+2 GC)">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          선택된 청소년에게 출석 코인을 지급합니다. 이미 지급받은 청소년은 자동으로 제외돼요.
        </p>
        <button
          onClick={giveAttendance}
          disabled={giving}
          className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm disabled:opacity-40"
        >
          선택한 {selected.size}명 출석 지급
        </button>
      </Card>

      <Card title="보너스 코인 지급">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          잘한 일이 있을 때 선택된 청소년 전체에게 한 번에 추가 코인을 줄 수 있어요. 한 명만 선택해도 돼요.
        </p>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">지급 코인</label>
            <input
              type="number"
              min="1"
              value={bonusAmount}
              onChange={(e) => setBonusAmount(e.target.value)}
              placeholder="예: 3"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-xs text-gray-500 mb-1">사유</label>
            <input
              type="text"
              value={bonusReason}
              onChange={(e) => setBonusReason(e.target.value)}
              placeholder="예: 정리정돈 잘함"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <button
          onClick={giveBonus}
          disabled={givingBonus}
          className="btn-3d btn-3d-mint w-full bg-mint text-white font-display rounded-xl py-3 text-sm disabled:opacity-40"
        >
          선택한 {selected.size}명에게 보너스 지급
        </button>
      </Card>
    </>
  );
}

/* ---------------- MENU TAB ---------------- */
function MenuTab({ showToast }) {
  const [items, setItems] = useState(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [category, setCategory] = useState(DEFAULT_MENU_CATEGORY);
  const [description, setDescription] = useState('');
  const [ordersOpen, setOrdersOpen] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [restockDrafts, setRestockDrafts] = useState({});
  const [descDrafts, setDescDrafts] = useState({});
  const [priceDrafts, setPriceDrafts] = useState({});
  const [listCat, setListCat] = useState('snack');
  const [listPage, setListPage] = useState(1);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/menu');
    const data = await res.json();
    if (data.ok) setItems(data.items);
  }, []);

  const loadOrdersOpen = useCallback(async () => {
    const res = await fetch('/api/admin/settings/orders');
    const data = await res.json();
    if (data.ok) setOrdersOpen(data.ordersOpen);
  }, []);

  useEffect(() => {
    load();
    loadOrdersOpen();
  }, [load, loadOrdersOpen]);

  const toggleOrders = async () => {
    setToggling(true);
    try {
      const res = await fetch('/api/admin/settings/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: !ordersOpen }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(!ordersOpen ? '주문을 열었어요.' : '주문을 닫았어요.');
        await loadOrdersOpen();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setToggling(false);
    }
  };

  const add = async () => {
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) return showToast('메뉴 이름과 가격을 확인해주세요.');
    const res = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: p,
        stock: stock === '' ? null : parseInt(stock, 10),
        category,
        description,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('메뉴를 추가했어요.');
      setName('');
      setPrice('');
      setStock('');
      setCategory(DEFAULT_MENU_CATEGORY);
      setDescription('');
      await load();
    } else {
      showToast(data.error || '추가에 실패했어요.');
    }
  };

  const saveCategory = async (item, value) => {
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: value }),
    });
    const data = await res.json();
    if (data.ok) await load();
    else showToast(data.error || '변경에 실패했어요.');
  };

  const saveDescription = async (item) => {
    const draft = descDrafts[item.id];
    const value = draft === undefined ? item.description || '' : draft;
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: value }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('설명을 저장했어요.');
      setDescDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
    } else {
      showToast(data.error || '저장에 실패했어요.');
    }
  };

  const savePrice = async (item) => {
    const draft = priceDrafts[item.id];
    const value = parseInt(draft, 10);
    if (!value || value <= 0) return showToast('가격을 확인해주세요.');
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: value }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('가격을 저장했어요.');
      setPriceDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
    } else {
      showToast(data.error || '저장에 실패했어요.');
    }
  };

  const del = async (id) => {
    const res = await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('메뉴를 삭제했어요.');
      await load();
    }
  };

  const saveStock = async (item) => {
    const draft = restockDrafts[item.id];
    const value = draft === '' ? null : parseInt(draft, 10);
    const res = await fetch(`/api/admin/menu/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock: value }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('재고를 저장했어요.');
      setRestockDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
    } else {
      showToast(data.error || '저장에 실패했어요.');
    }
  };

  return (
    <>
      <Card title="주문 받기">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          주말에만 여는 등 필요할 때만 켜고 끄면 돼요. 날짜와 상관없이 이 상태를 그대로 따라가요.
        </p>
        <button
          onClick={toggleOrders}
          disabled={ordersOpen === null || toggling}
          className={`btn-3d ${ordersOpen ? 'btn-3d-coral bg-coral' : 'btn-3d-mint bg-mint'} w-full text-white font-display rounded-xl py-3 text-sm disabled:opacity-40`}
        >
          {ordersOpen === null ? '불러오는 중...' : ordersOpen ? '주문 닫기' : '주문 열기'}
        </button>
      </Card>

      <Card title="등록된 메뉴">
        {items === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {items && items.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">등록된 메뉴가 없어요. 아래에서 추가해주세요.</p>
        )}
        {items && items.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
            {MENU_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  setListCat(c.key);
                  setListPage(1);
                }}
                className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border-[1.5px] flex items-center gap-1 ${
                  listCat === c.key ? 'bg-navy border-navy text-white' : 'border-gray-200 text-gray-500'
                }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        )}
        {(() => {
          const MENU_LIST_PAGE_SIZE = 10;
          const listItems = (items || []).filter((it) => (it.category || 'snack') === listCat);
          if (items && items.length > 0 && listItems.length === 0) {
            return <p className="text-xs text-gray-400 text-center py-4">이 소분류엔 메뉴가 없어요.</p>;
          }
          const totalPages = Math.max(1, Math.ceil(listItems.length / MENU_LIST_PAGE_SIZE));
          const pageClamped = Math.min(listPage, totalPages);
          const pageItems = listItems.slice(
            (pageClamped - 1) * MENU_LIST_PAGE_SIZE,
            pageClamped * MENU_LIST_PAGE_SIZE
          );
          return (
            <>
              {pageItems.map((it) => {
          const soldOut = it.stock !== null && it.stock <= 0;
          const draft = restockDrafts[it.id];
          const draftValue = draft !== undefined ? draft : it.stock === null ? '' : String(it.stock);
          return (
            <div key={it.id} className="py-2.5 border-b border-dashed border-gray-200 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm">
                    {it.name} {soldOut && <span className="text-coral-deep text-xs">(품절)</span>}
                  </div>
                  <div className="text-xs text-gold-deep font-bold">{it.price} GC</div>
                </div>
                <button onClick={() => del(it.id)} className="btn-3d btn-3d-coral shrink-0 text-xs bg-coral text-white rounded-lg px-3 py-1.5">
                  삭제
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  type="number"
                  min="1"
                  value={priceDrafts[it.id] !== undefined ? priceDrafts[it.id] : String(it.price)}
                  onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                  placeholder="가격"
                  className="w-24 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => savePrice(it)}
                  className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
                >
                  가격 저장
                </button>
                <span className="text-[10.5px] text-gray-400">GC</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <select
                  value={it.category || 'snack'}
                  onChange={(e) => saveCategory(it, e.target.value)}
                  className="border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                >
                  {MENU_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  value={draftValue}
                  onChange={(e) =>
                    setRestockDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))
                  }
                  placeholder="무제한"
                  className="w-24 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => saveStock(it)}
                  className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
                >
                  재고 저장
                </button>
              </div>
              <p className="text-[10.5px] text-gray-400 mt-1">재고는 비워두면 무제한</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  value={descDrafts[it.id] !== undefined ? descDrafts[it.id] : it.description || ''}
                  onChange={(e) => setDescDrafts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                  maxLength={MENU_DESCRIPTION_MAX_LENGTH}
                  placeholder="짧은 설명 (예: 달콤한 딸기맛)"
                  className="flex-1 min-w-0 border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => saveDescription(it)}
                  className="btn-3d btn-3d-outline shrink-0 text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
                >
                  설명 저장
                </button>
              </div>
            </div>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-2">
                  <button
                    disabled={pageClamped <= 1}
                    onClick={() => setListPage(pageClamped - 1)}
                    className="text-xs w-7 h-7 rounded-full border-2 border-gray-200 text-gray-500 disabled:opacity-30"
                  >
                    ‹
                  </button>
                  <span className="text-xs text-gray-400">
                    {pageClamped} / {totalPages}
                  </span>
                  <button
                    disabled={pageClamped >= totalPages}
                    onClick={() => setListPage(pageClamped + 1)}
                    className="text-xs w-7 h-7 rounded-full border-2 border-gray-200 text-gray-500 disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </Card>
      <Card title="메뉴 추가">
        <div className="flex gap-2 mb-3">
          <div className="flex-[2]">
            <label className="block text-xs text-gray-500 mb-1">메뉴 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 아이스티"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">가격 (GC)</label>
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 3"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">소분류</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            >
              {MENU_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">수량 (선택, 비워두면 무제한)</label>
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="예: 10"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">짧은 설명 (선택, 사진 대신 한 줄 소개)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MENU_DESCRIPTION_MAX_LENGTH}
            placeholder="예: 달콤한 딸기맛"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <button onClick={add} className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm">
          메뉴에 추가
        </button>
      </Card>
    </>
  );
}

/* ---------------- ORDERS TAB ---------------- */
function OrdersTab({ orders, onRefresh, showToast }) {
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const patch = async (order, body) => {
    setUpdating(order.id);
    try {
      const res = await fetch(`/api/admin/transactions/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        await onRefresh();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setUpdating(null);
    }
  };

  const markReady = (order) => {
    const location = prompt('받으러 오라고 안내할 장소를 입력하세요.', '사무실');
    if (location === null) return;
    patch(order, { readyAt: new Date().toISOString(), pickupLocation: location.trim() || '사무실' });
  };

  const markDone = (order) => patch(order, { fulfilled: true });
  const revertToReady = (order) => patch(order, { fulfilled: false });

  const pending = orders.filter((o) => !o.fulfilled && !o.ready_at);
  const ready = orders.filter((o) => !o.fulfilled && o.ready_at);
  const done = orders.filter((o) => o.fulfilled);

  return (
    <>
      <Card title={`주문 접수 (${pending.length}건)`}>
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          청소년이 메뉴를 주문하면 여기 쌓여요. 준비되면 &apos;준비 완료&apos;를 눌러 받으러 올 장소를
          안내해주세요. 15초마다 자동 새로고침돼요.
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-3 py-1.5 mb-3 disabled:opacity-40"
        >
          {refreshing ? '새로고침 중...' : '지금 새로고침'}
        </button>
        {pending.length === 0 && <p className="text-xs text-gray-400 text-center py-6">접수된 주문이 없어요.</p>}
        {pending.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">
                {o.kid_name} · {o.reason || '구매'}
                {o.quantity > 1 ? ` × ${o.quantity}` : ''}
              </div>
              <div className="text-[11px] text-gray-400">
                {fmtTime(o.created_at)} · <span className="text-coral-deep font-bold">-{o.amount} GC</span>
              </div>
            </div>
            <button
              disabled={updating === o.id}
              onClick={() => markReady(o)}
              className="btn-3d btn-3d-gold shrink-0 text-xs bg-gold text-navy-deep rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              준비 완료
            </button>
          </div>
        ))}
      </Card>

      <Card title={`수령 대기 (${ready.length}건)`}>
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">청소년이 안내받은 장소로 와서 실제로 받아가면 완료 처리해주세요.</p>
        {ready.length === 0 && <p className="text-xs text-gray-400 text-center py-6">수령 대기 중인 주문이 없어요.</p>}
        {ready.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">
                {o.kid_name} · {o.reason || '구매'}
                {o.quantity > 1 ? ` × ${o.quantity}` : ''}
              </div>
              <div className="text-[11px] text-gray-400">
                📍 {o.pickup_location || '사무실'} · <span className="text-coral-deep font-bold">-{o.amount} GC</span>
              </div>
            </div>
            <button
              disabled={updating === o.id}
              onClick={() => markDone(o)}
              className="btn-3d btn-3d-mint shrink-0 text-xs bg-mint text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              수령 완료
            </button>
          </div>
        ))}
      </Card>

      {done.length > 0 && (
        <Card title={`지급 완료 (${done.length}건)`}>
          {done.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 last:border-0">
              <div>
                <div className="text-sm text-gray-400 line-through">
                  {o.kid_name} · {o.reason || '구매'}
                  {o.quantity > 1 ? ` × ${o.quantity}` : ''}
                </div>
                <div className="text-[11px] text-gray-300">{fmtTime(o.created_at)}</div>
              </div>
              <button
                disabled={updating === o.id}
                onClick={() => revertToReady(o)}
                className="shrink-0 text-xs text-gray-400 underline disabled:opacity-40"
              >
                되돌리기
              </button>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ---------------- EVENTS TAB ---------------- */
function EventsTab({ showToast, onPendingCountChange }) {
  const [events, setEvents] = useState(null);
  const [submissions, setSubmissions] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('');
  const [resolving, setResolving] = useState(null);

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/admin/events');
    const data = await res.json();
    if (data.ok) setEvents(data.events);
  }, []);

  const loadSubmissions = useCallback(async () => {
    const res = await fetch('/api/admin/events/submissions?status=pending');
    const data = await res.json();
    if (data.ok) {
      setSubmissions(data.submissions);
      onPendingCountChange(data.submissions.length);
    }
  }, [onPendingCountChange]);

  useEffect(() => {
    loadEvents();
    loadSubmissions();
  }, [loadEvents, loadSubmissions]);

  const add = async () => {
    const r = parseInt(reward, 10);
    if (!title.trim() || !r || r <= 0) return showToast('이벤트 제목과 보상 코인을 확인해주세요.');
    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, reward: r }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('이벤트를 등록했어요.');
      setTitle('');
      setDescription('');
      setReward('');
      await loadEvents();
    } else {
      showToast(data.error || '등록에 실패했어요.');
    }
  };

  const toggleActive = async (ev) => {
    const res = await fetch(`/api/admin/events/${ev.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !ev.is_active }),
    });
    const data = await res.json();
    if (data.ok) await loadEvents();
  };

  const del = async (ev) => {
    if (!confirm(`"${ev.title}" 이벤트를 정말 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/events/${ev.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('이벤트를 삭제했어요.');
      await loadEvents();
    }
  };

  const resolve = async (sub, action) => {
    setResolving(sub.id);
    try {
      const res = await fetch(`/api/admin/events/submissions/${sub.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(action === 'approve' ? '승인하고 코인을 지급했어요.' : '거절했어요.');
        await loadSubmissions();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setResolving(null);
    }
  };

  return (
    <>
      <Card title="완료 승인 대기">
        {submissions === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {submissions && submissions.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">대기 중인 완료 요청이 없어요.</p>
        )}
        {submissions?.map((sub) => (
          <div
            key={sub.id}
            className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0"
          >
            <div>
              <div className="font-bold text-sm">
                {sub.kid_name} · {sub.event_title}
              </div>
              <div className="text-xs text-gold-deep font-bold">+{sub.reward} GC</div>
              <div className="text-[11px] text-gray-400">
                {fmtDate(sub.created_at.slice(0, 10))} {fmtTime(sub.created_at)}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                disabled={resolving === sub.id}
                onClick={() => resolve(sub, 'approve')}
                className="btn-3d btn-3d-mint text-xs bg-mint text-white rounded-lg px-3 py-1.5"
              >
                승인
              </button>
              <button
                disabled={resolving === sub.id}
                onClick={() => resolve(sub, 'reject')}
                className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-3 py-1.5"
              >
                거절
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card title="등록된 이벤트">
        {events === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {events && events.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">등록된 이벤트가 없어요. 아래에서 추가해주세요.</p>
        )}
        {events?.map((ev) => (
          <div key={ev.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">
                {ev.title} {!ev.is_active && <span className="text-gray-400 text-xs">(비활성)</span>}
              </div>
              {ev.description && <p className="text-xs text-gray-500">{ev.description}</p>}
              <div className="text-xs text-gold-deep font-bold">+{ev.reward} GC</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => toggleActive(ev)}
                className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
              >
                {ev.is_active ? '비활성화' : '활성화'}
              </button>
              <button onClick={() => del(ev)} className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-2.5 py-1.5">
                삭제
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card title="이벤트 등록">
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 방 정리 도와주기"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">설명 (선택)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 활동 마친 뒤 자기 자리 정리하기"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">보상 코인</label>
          <input
            type="number"
            min="1"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            placeholder="예: 5"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <button onClick={add} className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm">
          이벤트 등록
        </button>
      </Card>
    </>
  );
}

/* ---------------- ANNOUNCEMENTS(확성기) TAB ---------------- */
function AnnouncementsTab({ showToast }) {
  const [items, setItems] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/announcements');
    const data = await res.json();
    if (data.ok) setItems(data.announcements);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (item) => {
    if (!confirm(`"${item.message}" 글을 지금 내릴까요?`)) return;
    setRemovingId(item.id);
    try {
      const res = await fetch(`/api/admin/announcements/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        showToast('글을 내렸어요.');
        await load();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setRemovingId(null);
    }
  };

  const now = Date.now();
  const active = items?.filter((a) => !a.removed_at && new Date(a.expires_at).getTime() > now) || [];
  const past = items?.filter((a) => a.removed_at || new Date(a.expires_at).getTime() <= now) || [];

  return (
    <>
      <Card title={`지금 홈 화면에 노출 중 (${active.length}건)`}>
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          부적절한 글이 있으면 바로 내릴 수 있어요.
        </p>
        {items === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {items && active.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">노출 중인 글이 없어요.</p>
        )}
        {active.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">{a.message}</div>
              <div className="text-[11px] text-gray-400">
                {a.kid_name} · {fmtTime(a.created_at)}
              </div>
            </div>
            <button
              disabled={removingId === a.id}
              onClick={() => remove(a)}
              className="btn-3d btn-3d-coral shrink-0 text-xs bg-coral text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
            >
              내리기
            </button>
          </div>
        ))}
      </Card>

      {past.length > 0 && (
        <Card title="지난 글">
          {past.map((a) => (
            <div key={a.id} className="py-2 border-b border-gray-100 last:border-0 text-sm">
              <div className={a.removed_at ? 'text-coral-deep line-through' : 'text-gray-500'}>{a.message}</div>
              <div className="text-[11px] text-gray-400">
                {a.kid_name} · {fmtTime(a.created_at)} {a.removed_at && '· 관리자가 내림'}
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ---------------- GOALS(기부함) TAB ---------------- */
function GoalsTab({ showToast, onReadyCountChange }) {
  const [goals, setGoals] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/goals');
    const data = await res.json();
    if (data.ok) {
      setGoals(data.goals);
      const ready = data.goals.filter((g) => g.achieved_at && !g.completed_at).length;
      onReadyCountChange(ready);
    }
  }, [onReadyCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const t = parseInt(target, 10);
    if (!title.trim() || !t || t <= 0) return showToast('목표 이름과 목표 금액을 확인해주세요.');
    const res = await fetch('/api/admin/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, target: t }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('목표를 등록했어요.');
      setTitle('');
      setDescription('');
      setTarget('');
      await load();
    } else {
      showToast(data.error || '등록에 실패했어요.');
    }
  };

  const toggleActive = async (goal) => {
    const res = await fetch(`/api/admin/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !goal.is_active }),
    });
    const data = await res.json();
    if (data.ok) await load();
  };

  const complete = async (goal) => {
    if (!confirm(`"${goal.title}"을(를) 완료 처리할까요? (실제로 진행한 뒤 눌러주세요)`)) return;
    setBusyId(goal.id);
    try {
      const res = await fetch(`/api/admin/goals/${goal.id}/complete`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('완료 처리했어요.');
        await load();
      } else {
        showToast(data.error || '처리에 실패했어요.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const del = async (goal) => {
    if (!confirm(`"${goal.title}" 목표를 정말 삭제할까요? 기부 내역도 함께 사라져요.`)) return;
    const res = await fetch(`/api/admin/goals/${goal.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('목표를 삭제했어요.');
      await load();
    }
  };

  const active = goals?.filter((g) => !g.completed_at) || [];
  const completed = goals?.filter((g) => g.completed_at) || [];

  return (
    <>
      <Card title="진행 중인 목표">
        {goals === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {goals && active.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">등록된 목표가 없어요. 아래에서 추가해주세요.</p>
        )}
        {active.map((g) => {
          const pct = Math.min(100, Math.round((g.current / g.target) * 100));
          return (
            <div key={g.id} className="py-3 border-b border-dashed border-gray-200 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-sm">
                  {g.title} {!g.is_active && <span className="text-gray-400 text-xs">(비활성)</span>}
                </div>
                <span className="text-xs text-gray-500">
                  {g.current} / {g.target} GC
                </span>
              </div>
              {g.description && <p className="text-xs text-gray-500 mt-0.5">{g.description}</p>}
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-coral to-coral-deep rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {g.topDonors.length > 0 && (
                <div className="mt-2 text-xs text-gray-500">
                  🏆 1등: <span className="font-bold text-gold-deep">{g.topDonors[0].kidName}</span> (
                  {g.topDonors[0].amount} GC)
                </div>
              )}
              {g.achieved_at && <p className="text-xs font-bold text-mint-deep mt-1">🎉 목표 달성!</p>}
              <div className="flex gap-1.5 mt-2.5">
                <button
                  disabled={busyId === g.id}
                  onClick={() => complete(g)}
                  className="btn-3d btn-3d-mint text-xs bg-mint text-white rounded-lg px-3 py-1.5 disabled:opacity-40"
                >
                  완료 처리
                </button>
                <button
                  onClick={() => toggleActive(g)}
                  className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
                >
                  {g.is_active ? '비활성화' : '활성화'}
                </button>
                <button onClick={() => del(g)} className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-2.5 py-1.5">
                  삭제
                </button>
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="목표 등록">
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">목표 이름</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 피자데이"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">설명 (선택)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="예: 다같이 목표를 모으면 피자를 시켜먹어요"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">목표 금액 (GC)</label>
          <input
            type="number"
            min="1"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="예: 300"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <button onClick={add} className="btn-3d btn-3d-coral w-full bg-coral text-white font-display rounded-xl py-3 text-sm">
          목표 등록
        </button>
      </Card>

      {completed.length > 0 && (
        <Card title="지난 목표">
          {completed.map((g) => (
            <div key={g.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 text-sm">
              <div>
                <div className="font-medium">{g.title}</div>
                <div className="text-[11px] text-gray-400">{g.target} GC 달성</div>
              </div>
              {g.topDonors[0] && (
                <div className="text-xs text-gold-deep font-bold">🏆 {g.topDonors[0].kidName}</div>
              )}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

/* ---------------- STOCKS TAB ---------------- */
function StocksTab({ showToast }) {
  const [stocks, setStocks] = useState(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [price, setPrice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [news, setNews] = useState(null);
  const [newsStockId, setNewsStockId] = useState('');
  const [newsHeadline, setNewsHeadline] = useState('');
  const [newsPct, setNewsPct] = useState('');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/stocks');
    const data = await res.json();
    if (data.ok) {
      setStocks(data.stocks);
      if (!newsStockId && data.stocks.length > 0) setNewsStockId(data.stocks[0].id);
    }
  }, [newsStockId]);

  const loadNews = useCallback(async () => {
    const res = await fetch('/api/admin/stocks/news');
    const data = await res.json();
    if (data.ok) setNews(data.news);
  }, []);

  useEffect(() => {
    load();
    loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) return showToast('종목 이름과 시작 가격을 확인해주세요.');
    const res = await fetch('/api/admin/stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, emoji, price: p }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('종목을 등록했어요.');
      setName('');
      setEmoji('');
      setPrice('');
      await load();
    } else {
      showToast(data.error || '등록에 실패했어요.');
    }
  };

  const toggleActive = async (stock) => {
    const res = await fetch(`/api/admin/stocks/${stock.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !stock.is_active }),
    });
    const data = await res.json();
    if (data.ok) await load();
  };

  const del = async (stock) => {
    if (!confirm(`"${stock.name}" 종목을 정말 삭제할까요? 청소년들의 보유 현황도 함께 사라져요.`)) return;
    const res = await fetch(`/api/admin/stocks/${stock.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('종목을 삭제했어요.');
      await load();
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/stocks/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast(`${data.updated}개 종목 시세를 갱신했어요.`);
        await load();
      } else {
        showToast(data.error || '갱신에 실패했어요.');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const publishNews = async () => {
    const p = parseInt(newsPct, 10);
    if (!newsStockId) return showToast('종목을 선택해주세요.');
    if (!newsHeadline.trim()) return showToast('헤드라인을 입력해주세요.');
    if (!p || Math.abs(p) > 40) return showToast('등락률을 -40~40 사이 숫자로 입력해주세요.');
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/stocks/${newsStockId}/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline: newsHeadline, pct: p }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('뉴스를 발표하고 시세에 반영했어요.');
        setNewsHeadline('');
        setNewsPct('');
        await Promise.all([load(), loadNews()]);
      } else {
        showToast(data.error || '발표에 실패했어요.');
      }
    } finally {
      setPublishing(false);
    }
  };

  const delNews = async (n) => {
    if (!confirm('이 뉴스를 지울까요? (이미 반영된 시세는 되돌리지 않아요)')) return;
    const res = await fetch(`/api/admin/stocks/news/${n.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) await loadNews();
    else showToast(data.error || '실패했어요.');
  };

  return (
    <>
      <Card title="시세 갱신">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          시세는 매일 낮 12시에 자동으로 바뀌어요(±8% 이내). 지금 바로 테스트하거나 수동으로 보정하고
          싶으면 아래 버튼을 눌러주세요.
        </p>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="btn-3d btn-3d-navy w-full bg-navy text-white font-display rounded-xl py-3 text-sm disabled:opacity-40"
        >
          {refreshing ? '갱신 중...' : '지금 시세 갱신'}
        </button>
      </Card>

      <Card title="등록된 종목">
        {stocks === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {stocks && stocks.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">등록된 종목이 없어요. 아래에서 추가해주세요.</p>
        )}
        {stocks?.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">
                {s.emoji} {s.name} {!s.is_active && <span className="text-gray-400 text-xs">(비활성)</span>}
              </div>
              <div className="text-xs text-gold-deep font-bold">{s.price} GC</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => toggleActive(s)}
                className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
              >
                {s.is_active ? '비활성화' : '활성화'}
              </button>
              <button onClick={() => del(s)} className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-2.5 py-1.5">
                삭제
              </button>
            </div>
          </div>
        ))}
      </Card>

      <Card title="뉴스 발표">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          "OO기업, 신제품 발표로 주가 급등!" 같은 헤드라인과 등락률을 정하면, 무작위 변동과
          별개로 그 자리에서 바로 시세에 반영되고 홈 화면·대시보드에 뉴스로 떠요.
        </p>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">종목</label>
          <select
            value={newsStockId}
            onChange={(e) => setNewsStockId(e.target.value)}
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          >
            {stocks?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name} ({s.price} GC)
              </option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">헤드라인</label>
          <input
            value={newsHeadline}
            onChange={(e) => setNewsHeadline(e.target.value)}
            placeholder="예: 신제품 출시 발표에 주가 급등!"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">등락률 (%) — 음수면 하락</label>
          <input
            type="number"
            value={newsPct}
            onChange={(e) => setNewsPct(e.target.value)}
            placeholder="예: 15 또는 -10"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <button
          onClick={publishNews}
          disabled={publishing}
          className="btn-3d btn-3d-coral w-full bg-coral text-white font-display rounded-xl py-3 text-sm disabled:opacity-40"
        >
          {publishing ? '발표 중...' : '뉴스 발표하기'}
        </button>

        {news && news.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs font-bold text-gray-500 mb-2">최근 뉴스</div>
            {news.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <div className="min-w-0">
                  <div className="truncate">{n.headline}</div>
                  <div className="text-gray-400">
                    {n.stock_name} · {n.pct > 0 ? '+' : ''}
                    {n.pct}% ({n.old_price}→{n.new_price} GC)
                  </div>
                </div>
                <button onClick={() => delNews(n)} className="text-gray-400 underline shrink-0">
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="종목 등록">
        <div className="flex gap-2 mb-3">
          <div className="w-16">
            <label className="block text-xs text-gray-500 mb-1">이모지</label>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder="📈"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-2 py-2.5 text-sm text-center"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-xs text-gray-500 mb-1">종목 이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 간식전자"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">시작가 (GC)</label>
            <input
              type="number"
              min="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="예: 100"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <button onClick={add} className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm">
          종목 등록
        </button>
      </Card>
    </>
  );
}

/* ---------------- PREDICTIONS TAB ---------------- */
function PredictionsTab({ showToast }) {
  const [predictions, setPredictions] = useState(null);
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('예');
  const [optionB, setOptionB] = useState('아니오');
  const [resolving, setResolving] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/predictions');
    const data = await res.json();
    if (data.ok) setPredictions(data.predictions);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!question.trim()) return showToast('질문을 입력해주세요.');
    const res = await fetch('/api/admin/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, optionA, optionB }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('예측 질문을 올렸어요.');
      setQuestion('');
      setOptionA('예');
      setOptionB('아니오');
      await load();
    } else {
      showToast(data.error || '등록에 실패했어요.');
    }
  };

  const close = async (p) => {
    const res = await fetch(`/api/admin/predictions/${p.id}/close`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) await load();
    else showToast(data.error || '실패했어요.');
  };

  const resolve = async (p, winner) => {
    const label = winner === 'a' ? p.option_a : p.option_b;
    if (!confirm(`"${label}"(을)를 정답으로 발표할까요? 맞춘 사람들에게 바로 코인이 지급돼요.`)) return;
    setResolving(p.id);
    try {
      const res = await fetch(`/api/admin/predictions/${p.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast('결과를 발표하고 코인을 지급했어요.');
        await load();
      } else {
        showToast(data.error || '실패했어요.');
      }
    } finally {
      setResolving(null);
    }
  };

  const del = async (p) => {
    const warning =
      p.status === 'resolved'
        ? '이 질문을 삭제할까요? (이미 정산이 끝나서 추가 환불은 없어요)'
        : p.betCount > 0
        ? `이 질문을 삭제할까요? 베팅한 ${p.betCount}명에게 걸었던 코인을 그대로 환불해요.`
        : '이 질문을 삭제할까요?';
    if (!confirm(warning)) return;
    const res = await fetch(`/api/admin/predictions/${p.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('삭제했어요.');
      await load();
    } else {
      showToast(data.error || '실패했어요.');
    }
  };

  return (
    <>
      <Card title="새 질문 올리기">
        <p className="text-xs text-gray-500 -mt-2 mb-2.5">
          애들끼리 코인을 걸고, 맞춘 사람들이 틀린 사람들의 판돈을 나눠 가져요. 코인이 새로 생기지
          않아서 경제에 부담이 없어요.
        </p>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">질문</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="예: 이번 주 출석 20명 넘을까?"
            className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">선택지 A</label>
            <input
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">선택지 B</label>
            <input
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <button
          onClick={add}
          className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm"
        >
          질문 올리기
        </button>
      </Card>

      <Card title="질문 목록">
        {predictions === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {predictions && predictions.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">올린 질문이 없어요.</p>
        )}
        {predictions?.map((p) => {
          const total = p.poolA + p.poolB;
          const pctA = total > 0 ? Math.round((p.poolA / total) * 100) : 50;
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
                  {p.status === 'open' ? '진행 중' : p.status === 'closed' ? '마감' : '결과 발표됨'}
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
              <p className="text-[11px] text-gray-400 mt-1">참여 {p.betCount}명</p>

              {p.status === 'resolved' && (
                <p className="text-xs font-bold text-gold-deep mt-1.5">
                  정답: {p.resolved_option === 'a' ? p.option_a : p.option_b}
                </p>
              )}

              {p.status !== 'resolved' && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {p.status === 'open' && (
                    <button
                      onClick={() => close(p)}
                      className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1.5"
                    >
                      베팅 마감
                    </button>
                  )}
                  <button
                    disabled={resolving === p.id}
                    onClick={() => resolve(p, 'a')}
                    className="btn-3d btn-3d-mint text-xs bg-mint text-white rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                  >
                    &quot;{p.option_a}&quot; 정답 발표
                  </button>
                  <button
                    disabled={resolving === p.id}
                    onClick={() => resolve(p, 'b')}
                    className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-2.5 py-1.5 disabled:opacity-40"
                  >
                    &quot;{p.option_b}&quot; 정답 발표
                  </button>
                </div>
              )}
              <button onClick={() => del(p)} className="text-xs text-gray-400 underline px-1.5 py-1.5 mt-1">
                삭제
              </button>
            </div>
          );
        })}
      </Card>
    </>
  );
}

/* ---------------- KIDS TAB ---------------- */
function KidsTab({ kids, reload, showToast }) {
  const [name, setName] = useState('');
  const [startBalance, setStartBalance] = useState('');

  const add = async () => {
    if (!name.trim()) return showToast('이름을 입력해주세요.');
    const res = await fetch('/api/admin/kids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, startBalance: startBalance ? parseInt(startBalance, 10) : 0 }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(`${name} 청소년을 추가했어요.`);
      setName('');
      setStartBalance('');
      await reload();
    } else {
      showToast(data.error || '추가에 실패했어요.');
    }
  };

  const del = async (k) => {
    if (!confirm(`${k.name} 청소년을 정말 삭제할까요? 거래 내역은 유지됩니다.`)) return;
    const res = await fetch(`/api/admin/kids/${k.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast('청소년을 삭제했어요.');
      await reload();
    }
  };

  const resetPin = async (k) => {
    const res = await fetch(`/api/admin/kids/${k.id}/reset-pin`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) {
      showToast(`${k.name}님의 PIN을 초기화했어요.`);
      await reload();
    }
  };

  return (
    <>
      <Card title="청소년 추가">
        <div className="flex gap-2 mb-3">
          <div className="flex-[2]">
            <label className="block text-xs text-gray-500 mb-1">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 김민준"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">시작 코인</label>
            <input
              type="number"
              min="0"
              value={startBalance}
              onChange={(e) => setStartBalance(e.target.value)}
              placeholder="0"
              className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm"
            />
          </div>
        </div>
        <button onClick={add} className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm">
          청소년 추가
        </button>
      </Card>
      <Card title={`전체 청소년 (${kids.length}명)`}>
        {kids.length === 0 && <p className="text-xs text-gray-400 text-center py-4">등록된 청소년이 없어요.</p>}
        {kids.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b-2 border-gray-100">
                <th className="py-1.5">이름</th>
                <th className="py-1.5">코인</th>
                <th className="py-1.5">PIN</th>
                <th className="py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {kids.map((k) => (
                <tr key={k.id} className="border-b border-gray-50">
                  <td className="py-2">{k.name}</td>
                  <td className="py-2">{k.balance} GC</td>
                  <td className="py-2">{k.hasPin ? '설정됨' : '미설정'}</td>
                  <td className="py-2 text-right space-x-1.5 whitespace-nowrap">
                    {k.hasPin && (
                      <button onClick={() => resetPin(k)} className="btn-3d btn-3d-outline text-xs border-2 border-navy text-navy rounded-lg px-2.5 py-1">
                        PIN 초기화
                      </button>
                    )}
                    <button onClick={() => del(k)} className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-2.5 py-1">
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

/* ---------------- HISTORY TAB ---------------- */
function HistoryTab({ kids, showToast }) {
  const [openId, setOpenId] = useState(null);
  const [txByKid, setTxByKid] = useState({});

  const toggle = async (kid) => {
    if (openId === kid.id) {
      setOpenId(null);
      return;
    }
    setOpenId(kid.id);
    if (!txByKid[kid.id]) {
      const res = await fetch(`/api/admin/transactions?kidId=${kid.id}`);
      const data = await res.json();
      if (data.ok) setTxByKid((prev) => ({ ...prev, [kid.id]: data.transactions }));
    }
  };

  if (kids.length === 0) return <Card>등록된 청소년이 없어요.</Card>;

  const sorted = [...kids].sort((a, b) => b.balance - a.balance);

  return (
    <>
      {sorted.map((k) => {
        const isOpen = openId === k.id;
        const tx = txByKid[k.id] || [];
        return (
          <div key={k.id} className="bg-white border-2 border-gray-100 rounded-2xl p-4 mb-2.5">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => toggle(k)}>
              <strong className="text-sm">{k.name}</strong>
              <div className="flex items-center gap-2.5 text-sm">
                <span className="text-gray-500">{k.balance} GC</span>
                <span>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {isOpen && (
              <div className="mt-2.5 pt-2 border-t border-gray-100">
                {tx.length === 0 && <p className="text-xs text-gray-400 py-1.5">거래 내역이 없어요.</p>}
                {tx.map((t) => (
                  <div key={t.id} className="flex justify-between items-center py-1.5 text-xs">
                    <div>
                      <div className="font-medium">{t.reason || (t.type === 'spend' ? '구매' : '지급')}</div>
                      <div className="text-gray-400 text-[10.5px]">
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
            )}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- SETTINGS TAB ---------------- */
function SettingsTab({ showToast }) {
  const [newPin, setNewPin] = useState('');

  const change = async () => {
    if (!/^\d{4}$/.test(newPin)) return showToast('4자리 숫자로 입력해주세요.');
    const res = await fetch('/api/admin/settings/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPin }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('비밀번호를 변경했어요.');
      setNewPin('');
    } else {
      showToast(data.error || '변경에 실패했어요.');
    }
  };

  return (
    <Card title="관리자 비밀번호 변경">
      <label className="block text-xs text-gray-500 mb-1">새 비밀번호 (4자리 숫자)</label>
      <input
        value={newPin}
        onChange={(e) => setNewPin(e.target.value)}
        maxLength={4}
        placeholder="예: 1234"
        className="w-full border-[1.5px] border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3"
      />
      <button onClick={change} className="btn-3d btn-3d-outline w-full border-2 border-navy text-navy font-display rounded-xl py-3 text-sm">
        비밀번호 변경
      </button>
    </Card>
  );
}

export default function AdminDashboardPage() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}
