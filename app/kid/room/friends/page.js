'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';

// 아바타를 아직 안 산 청소년은 전부 이 흰색 실루엣으로 통일해서 보여줍니다.
const DEFAULT_AVATAR = { emoji: '👤', color: 'gray' };

export default function FriendsRoomListPage() {
  const router = useRouter();
  const [kids, setKids] = useState(null);

  useEffect(() => {
    fetch('/api/kids')
      .then((r) => r.json())
      .then((d) => setKids(d.ok ? d.kids : []))
      .catch(() => setKids([]));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="친구 마이룸 구경" sub="구경할 친구를 선택하세요" onExit={() => router.push('/kid/room')} />
      <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-6">
        {kids === null && <p className="text-center text-gray-400 text-sm mt-10">불러오는 중...</p>}
        <div className="grid grid-cols-3 gap-3">
          {kids?.map((k) => {
            const fallback = DEFAULT_AVATAR;
            const emoji = k.avatarEmoji || fallback.emoji;
            return (
              <button
                key={k.id}
                onClick={() => router.push(`/kid/room/${k.id}`)}
                className="btn-3d btn-3d-white bg-white border-[1.5px] border-gray-200 rounded-2xl py-3.5 px-1 flex flex-col items-center gap-1.5 hover:border-gold transition"
              >
                <div className="relative">
                  <div className={`icon-badge icon-badge-${fallback.color} w-12 h-12 rounded-full text-2xl`}>
                    {emoji}
                  </div>
                  {k.accessoryEmoji && (
                    <span className="absolute -top-1.5 -right-1.5 text-base leading-none">{k.accessoryEmoji}</span>
                  )}
                  <span className="icon-badge icon-badge-grape absolute -bottom-1 -left-1 w-5 h-5 rounded-full text-[8.5px] font-display text-white">
                    {k.level}
                  </span>
                </div>
                <span className="text-sm font-medium text-navy flex items-center gap-0.5">
                  {k.stickerEmoji && <span className="text-xs">{k.stickerEmoji}</span>}
                  {k.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
