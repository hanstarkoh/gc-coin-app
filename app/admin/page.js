'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import PinPad from '@/components/PinPad';
import { ToastProvider, useToast } from '@/components/Toast';

function AdminLoginInner() {
  const router = useRouter();
  const showToast = useToast();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length === 4) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const submit = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/admin/dashboard');
      } else {
        setShake(true);
        setPin('');
        showToast(data.error || '비밀번호가 올바르지 않아요.');
        setTimeout(() => setShake(false), 350);
      }
    } catch (e) {
      showToast('네트워크 오류가 발생했어요.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar title="관리자 로그인" onExit={() => router.push('/')} />
      <div className="flex-1 max-w-[340px] w-full mx-auto px-4 py-10">
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-6 text-center">
          <div className="font-display text-lg text-navy">비밀번호 4자리 입력</div>
          <PinPad value={pin} onChange={setPin} shake={shake} />
          <p className="text-xs text-gray-400 mt-4">기본 비밀번호: 1234 (설정 탭에서 변경 가능)</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <ToastProvider>
      <AdminLoginInner />
    </ToastProvider>
  );
}
