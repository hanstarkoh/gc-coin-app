'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { ToastProvider, useToast } from '@/components/Toast';

const TABS = [
  { key: 'attendance', label: '출석 · 코인 지급' },
  { key: 'menu', label: '메뉴 관리' },
  { key: 'events', label: '이벤트' },
  { key: 'kids', label: '청소년 관리' },
  { key: 'history', label: '전체 현황' },
  { key: 'settings', label: '설정' },
];

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

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/');
  };

  if (!ready) return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;

  const attendedTodaySet = new Set(todayTx.filter((t) => t.reason === '출석').map((t) => t.kid_id));
  const earnedToday = todayTx.filter((t) => t.type !== 'spend').reduce((s, t) => s + t.amount, 0);
  const spentToday = todayTx.filter((t) => t.type === 'spend').reduce((s, t) => s + t.amount, 0);

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
              {t.key === 'events' && pendingEventCount > 0 ? `${t.label} (${pendingEventCount})` : t.label}
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
        {tab === 'events' && (
          <EventsTab showToast={showToast} onPendingCountChange={setPendingEventCount} />
        )}
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

      <Card title="오늘 출석 코인 지급 (+5 GC)">
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

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/menu');
    const data = await res.json();
    if (data.ok) setItems(data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) return showToast('메뉴 이름과 가격을 확인해주세요.');
    const res = await fetch('/api/admin/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price: p }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast('메뉴를 추가했어요.');
      setName('');
      setPrice('');
      await load();
    } else {
      showToast(data.error || '추가에 실패했어요.');
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

  return (
    <>
      <Card title={`오늘의 메뉴 (${fmtDate(todayStr())})`}>
        {items === null && <p className="text-xs text-gray-400 text-center py-4">불러오는 중...</p>}
        {items && items.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">등록된 메뉴가 없어요. 아래에서 추가해주세요.</p>
        )}
        {items?.map((it) => (
          <div key={it.id} className="flex items-center justify-between py-2.5 border-b border-dashed border-gray-200 last:border-0">
            <div>
              <div className="font-bold text-sm">{it.name}</div>
              <div className="text-xs text-gold-deep font-bold">{it.price} GC</div>
            </div>
            <button onClick={() => del(it.id)} className="btn-3d btn-3d-coral text-xs bg-coral text-white rounded-lg px-3 py-1.5">
              삭제
            </button>
          </div>
        ))}
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
        <button onClick={add} className="btn-3d btn-3d-gold w-full bg-gold text-navy-deep font-display rounded-xl py-3 text-sm">
          메뉴에 추가
        </button>
      </Card>
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
