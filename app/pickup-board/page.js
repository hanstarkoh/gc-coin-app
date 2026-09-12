'use client';
import { useEffect, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';

const POLL_MS = 4000;

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 태블릿 브라우저는 사용자가 화면을 한 번 눌러주기 전엔 소리를 자동 재생 못 하게 막아둬서,
// 처음에 "탭해서 켜기" 안내를 보여주고 그때 오디오 컨텍스트를 만들어둡니다.
function beep(audioCtx) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

export default function PickupBoardPage() {
  const [orders, setOrders] = useState(null);
  const [soundOn, setSoundOn] = useState(false);
  const audioCtxRef = useRef(null);
  const knownIdsRef = useRef(new Set());
  const [flashIds, setFlashIds] = useState(new Set());

  useEffect(() => {
    let stopped = false;

    const load = async () => {
      try {
        const res = await fetch('/api/pickup-board');
        const data = await res.json();
        if (stopped || !data.ok) return;

        const nextIds = new Set(data.orders.map((o) => o.id));
        const newlyReady = data.orders.filter((o) => !knownIdsRef.current.has(o.id));
        if (knownIdsRef.current.size > 0 && newlyReady.length > 0) {
          beep(audioCtxRef.current);
          setFlashIds(new Set(newlyReady.map((o) => o.id)));
          setTimeout(() => setFlashIds(new Set()), 4000);
        }
        knownIdsRef.current = nextIds;
        setOrders(data.orders);
      } catch (e) {
        // 네트워크 오류는 다음 폴링에서 다시 시도
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  const enableSound = () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new Ctx();
    beep(audioCtxRef.current);
    setSoundOn(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="🔔 픽업 현황판" sub="준비된 주문을 가져가세요" />

      {!soundOn && (
        <button
          onClick={enableSound}
          className="btn-3d btn-3d-gold bg-gold text-navy-deep font-display text-lg py-4 mx-4 mt-4 rounded-2xl"
        >
          🔊 탭해서 알림 소리 켜기
        </button>
      )}

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-6">
        {orders === null && <p className="text-center text-gray-400 mt-16">불러오는 중...</p>}
        {orders && orders.length === 0 && (
          <div className="text-center mt-24">
            <div className="text-6xl mb-4">🍪</div>
            <p className="text-gray-400 text-lg">지금 픽업 대기 중인 주문이 없어요</p>
          </div>
        )}
        <div className="grid gap-3">
          {orders?.map((o) => (
            <div
              key={o.id}
              className={`bg-white border-2 rounded-3xl p-5 flex items-center justify-between transition-colors ${
                flashIds.has(o.id) ? 'border-gold bg-gold/10' : 'border-gray-100'
              }`}
            >
              <div>
                <div className="font-display text-2xl text-navy">{o.kid_name}</div>
                <div className="text-base text-gray-600 mt-1">
                  {o.reason}
                  {o.quantity > 1 ? ` × ${o.quantity}` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-1">{fmtTime(o.ready_at)}부터 대기 중</div>
              </div>
              <div className="icon-badge icon-badge-gold w-16 h-16 rounded-2xl text-center px-2">
                <span className="font-display text-navy-deep text-sm leading-tight">
                  {o.pickup_location || '사무실'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
