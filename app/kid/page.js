'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PinPad from '@/components/PinPad';
import { ToastProvider, useToast } from '@/components/Toast';

function KidLoginInner() {
  const router = useRouter();
  const showToast = useToast();
  const [kids, setKids] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/kids')
      .then((r) => r.json())
      .then((d) => setKids(d.ok ? d.kids : []))
      .catch(() => setKids([]));
  }, []);

  useEffect(() => {
    if (pin.length === 4 && selected) submitPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const submitPin = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kid/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kidId: selected.id, pin }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/kid/dashboard');
      } else {
        setShake(true);
        setPin('');
        showToast(data.error || 'PIN이 올바르지 않아요.');
        setTimeout(() => setShake(false), 350);
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  if (!selected) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopBar title="청소년 화면" sub="내 이름을 선택하세요" onExit={() => router.push('/')} />
        <div className="flex-1 max-w-[480px] w-full mx-auto px-4 py-6">
          {kids === null && <p className="text-center text-gray-400 text-sm mt-10">불러오는 중...</p>}
          {kids && kids.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-10">
              아직 등록된 청소년이 없어요.
              <br />
              관리자에게 등록을 요청해주세요.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2.5">
            {kids?.map((k) => (
              <button
                key={k.id}
                onClick={() => setSelected(k)}
                className="bg-white border-[1.5px] border-gray-200 rounded-xl py-3.5 px-1 text-sm font-medium text-navy hover:border-gold transition"
              >
                {k.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isNew = !selected.hasPin;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title={isNew ? 'PIN 설정' : 'PIN 입력'} onExit={() => router.push('/')} />
      <div className="flex-1 max-w-[340px] w-full mx-auto px-4 py-8">
        <button onClick={() => { setSelected(null); setPin(''); }} className="text-xs text-navy underline mb-4">
          ← 이름 다시 선택
        </button>
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 text-center">
          <div className="font-display text-lg text-navy">
            {selected.name}님, {isNew ? '사용할 PIN 4자리를 만들어주세요' : 'PIN을 입력하세요'}
          </div>
          {isNew && <p className="text-xs text-gray-500 mt-2">다음에 로그인할 때 필요해요. 잊지 않게 기억해두세요!</p>}
          <PinPad value={pin} onChange={setPin} shake={shake} />
          {loading && <p className="text-xs text-gray-400 mt-2">확인 중...</p>}
        </div>
      </div>
    </div>
  );
}

export default function KidLoginPage() {
  return (
    <ToastProvider>
      <KidLoginInner />
    </ToastProvider>
  );
}
