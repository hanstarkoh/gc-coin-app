'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import AvatarBadge from '@/components/AvatarBadge';

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
            return (
              <button
                key={k.id}
                onClick={() => router.push(`/kid/room/${k.id}`)}
                className="btn-3d btn-3d-white bg-white border-[1.5px] border-gray-200 rounded-2xl py-3.5 px-1 flex flex-col items-center gap-1.5 hover:border-gold transition"
              >
                <AvatarBadge kid={k} />
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
