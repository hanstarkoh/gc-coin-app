'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import BadgeGrid from '@/components/BadgeGrid';

export default function FriendRoomPage() {
  const router = useRouter();
  const params = useParams();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/kid/room/${params.id}`)
      .then((r) => {
        if (r.status === 401) {
          router.push('/kid');
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        if (d.ok) setRoom(d);
        else setError(d.error);
      });
  }, [params.id, router]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar title="마이룸" onExit={() => router.push('/kid/room/friends')} />
        <p className="text-center text-gray-400 text-sm mt-16">{error}</p>
      </div>
    );
  }

  if (!room) return <p className="text-center text-gray-400 text-sm mt-16">불러오는 중...</p>;

  const itemAt = (x, y) => room.items.find((it) => it.x === x && it.y === y);
  const roomStyle = room.theme
    ? { background: `linear-gradient(180deg, ${room.theme.wall} 0%, ${room.theme.wall} 40%, ${room.theme.floor} 40%, ${room.theme.floor} 100%)` }
    : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title={`${room.name}님의 마이룸`} onExit={() => router.push('/kid/room/friends')} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-5 space-y-4">
        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4 text-center">
          <div className="font-display text-lg text-navy">
            {room.avatarEmoji || '🙂'} {room.title ? `${room.title.icon} ${room.title.name} ` : ''}
            {room.name}
            {room.stickerEmoji ? ` ${room.stickerEmoji}` : ''}
          </div>
          <div className="text-xs text-gray-400 mt-1">Lv.{room.level}</div>
          <div className="mt-2 text-sm font-bold">
            {room.balancePublic ? (
              <span className="text-gold-deep">{room.balance} GC</span>
            ) : (
              <span className="text-gray-400">잔액 비공개</span>
            )}
          </div>
        </div>

        <div className="rounded-3xl p-4 room-scene" style={roomStyle}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${room.cols}, 1fr)` }}>
            {Array.from({ length: room.rows }).map((_, y) =>
              Array.from({ length: room.cols }).map((_, x) => {
                const item = itemAt(x, y);
                return (
                  <div key={`${x}-${y}`} className="aspect-square flex items-center justify-center">
                    {item && <span className="room-slot text-4xl">{item.emoji}</span>}
                  </div>
                );
              })
            )}
          </div>
          {room.items.length === 0 && (
            <p className="text-xs text-white font-bold text-center mt-2 drop-shadow">아직 꾸민 가구가 없어요.</p>
          )}
        </div>

        <div className="bg-white border-2 border-gray-100 rounded-3xl p-4">
          <div className="font-display text-base text-navy mb-3">{room.name}님의 도전과제</div>
          <BadgeGrid earnedKeys={room.badges.map((b) => b.key)} />
        </div>
      </div>
    </div>
  );
}
