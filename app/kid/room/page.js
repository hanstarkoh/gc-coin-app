'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TopBar from '@/components/TopBar';
import BadgeGrid from '@/components/BadgeGrid';
import { ToastProvider, useToast } from '@/components/Toast';

function RoomInner() {
  const router = useRouter();
  const showToast = useToast();
  const [room, setRoom] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/kid/room');
    if (res.status === 401) {
      router.push('/kid');
      return;
    }
    const data = await res.json();
    if (data.ok) setRoom(data);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const cellItem = (x, y) =>
    room?.furniture.find((f) => f.placed && f.placed.x === x && f.placed.y === y);

  const handleCellClick = async (x, y) => {
    const existing = cellItem(x, y);
    if (existing) {
      if (!confirm(`${existing.name}을(를) 치울까요?`)) return;
      setBusy(true);
      try {
        const res = await fetch('/api/kid/room/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemKey: existing.key }),
        });
        const data = await res.json();
        if (data.ok) await load();
        else showToast(data.error || '실패했어요.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!selectedItem) {
      showToast('아래 보유 가구에서 배치할 걸 먼저 골라주세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/kid/room/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: selectedItem, x, y }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedItem(null);
        await load();
      } else {
        showToast(data.error || '실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const expandRoom = async () => {
    if (room.nextExpansionCost === null) return;
    if (!confirm(`${room.nextExpansionCost} GC를 내고 방을 한 줄 넓힐까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch('/api/kid/room/expand', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        showToast('방이 넓어졌어요!');
        await load();
      } else {
        showToast(data.error || '실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleBalancePublic = async () => {
    const next = !room.balancePublic;
    const res = await fetch('/api/kid/room/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balancePublic: next }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(next ? '잔액을 공개했어요.' : '잔액을 비공개로 바꿨어요.');
      await load();
    }
  };

  if (!room) return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;

  const roomStyle = room.theme
    ? { background: `linear-gradient(180deg, ${room.theme.wall} 0%, ${room.theme.wall} 40%, ${room.theme.floor} 40%, ${room.theme.floor} 100%)` }
    : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="내 마이룸" sub="가구를 사서 방을 꾸며보세요" onExit={() => router.push('/kid/dashboard')} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-5 space-y-4">
        <Link
          href="/kid/room/friends"
          className="btn-3d btn-3d-navy block bg-navy text-white rounded-2xl py-3 text-center font-display text-sm"
        >
          👥 친구 마이룸 구경하기
        </Link>

        <div className="rounded-3xl p-4 room-scene" style={roomStyle}>
          <div className="grid gap-2 relative" style={{ gridTemplateColumns: `repeat(${room.cols}, 1fr)` }}>
            {Array.from({ length: room.rows }).map((_, y) =>
              Array.from({ length: room.cols }).map((_, x) => {
                const item = cellItem(x, y);
                return (
                  <button
                    key={`${x}-${y}`}
                    disabled={busy}
                    onClick={() => handleCellClick(x, y)}
                    className={`aspect-square rounded-xl flex items-center justify-center disabled:opacity-60 ${
                      !item && selectedItem ? 'room-slot-empty' : ''
                    }`}
                  >
                    {item && <span className="room-slot text-4xl">{item.emoji}</span>}
                  </button>
                );
              })
            )}
          </div>
          {selectedItem && (
            <p className="text-xs text-white font-bold text-center mt-2 drop-shadow">
              {room.furniture.find((f) => f.key === selectedItem)?.name} 선택됨 - 빈 칸을 눌러 배치하세요
            </p>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-base text-navy">🏠 방 넓히기</div>
            <p className="text-xs text-gray-500 mt-1">
              지금 {room.cols}×{room.rows}칸 · {room.expansions}/4단계 확장
            </p>
          </div>
          {room.nextExpansionCost !== null ? (
            <button
              disabled={busy}
              onClick={expandRoom}
              className="btn-3d btn-3d-gold shrink-0 text-xs font-display px-4 py-2 rounded-lg bg-gold text-navy-deep disabled:opacity-40"
            >
              {room.nextExpansionCost} GC로 넓히기
            </button>
          ) : (
            <span className="text-xs text-mint-deep font-bold shrink-0">최대로 넓혔어요</span>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="font-display text-base text-navy mb-2">보유 가구</div>
          {room.furniture.length === 0 && (
            <p className="text-xs text-gray-400 py-3 text-center">
              아직 가구가 없어요. 대시보드 &apos;상점&apos;에서 가구를 사보세요!
            </p>
          )}
          <div className="grid grid-cols-4 gap-2">
            {room.furniture.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedItem(f.key === selectedItem ? null : f.key)}
                className={`rounded-xl border-2 p-2 text-center ${
                  selectedItem === f.key
                    ? 'border-gold bg-gold/10'
                    : f.placed
                    ? 'border-mint bg-mint/10'
                    : 'border-gray-100'
                }`}
              >
                <div className="text-2xl mb-1">{f.emoji}</div>
                <div className="text-[10px] font-medium text-navy leading-tight">{f.name}</div>
                <div className="text-[9.5px] text-gray-400 mt-0.5">{f.placed ? '배치됨' : '미배치'}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="font-display text-base text-navy mb-3">내 도전과제</div>
          <BadgeGrid earnedKeys={room.badges.map((b) => b.key)} />
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-display text-base text-navy">잔액 공개</div>
              <p className="text-xs text-gray-500 mt-1">켜두면 친구가 내 마이룸에서 내 코인 잔액을 볼 수 있어요.</p>
            </div>
            <button
              onClick={toggleBalancePublic}
              className={`btn-3d shrink-0 text-xs font-display px-4 py-2 rounded-lg ${
                room.balancePublic ? 'btn-3d-mint bg-mint text-white' : 'btn-3d-outline border-2 border-navy text-navy'
              }`}
            >
              {room.balancePublic ? '공개 중' : '비공개'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RoomPage() {
  return (
    <ToastProvider>
      <RoomInner />
    </ToastProvider>
  );
}
