import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

// 테스트 계정 전용 코인 자유 조정(지급/차감). 화면에는 테스트 계정 목록에서만 노출되지만,
// 실제 청소년 데이터에 잘못 쓰이는 걸 막기 위해 서버에서도 is_test를 한 번 더 확인함.
// 레벨 잠금 사치템 테스트를 위해 양수 입력 시 total_earned도 같이 올려서 레벨이 오르게 함
// (음수=차감은 balance만 줄이고 total_earned은 안 건드림 — 다른 "사용" 흐름과 동일).
export async function POST(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { amount } = await req.json();
    const amt = Number(amount);
    if (!amt || !Number.isFinite(amt)) {
      return NextResponse.json({ ok: false, error: '조정할 코인을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned, is_test')
      .eq('id', params.id)
      .single();
    if (kidErr) throw kidErr;
    if (!kid.is_test) {
      return NextResponse.json({ ok: false, error: '테스트 계정만 코인을 자유롭게 조정할 수 있어요.' }, { status: 403 });
    }

    const newBalance = Math.max(0, kid.balance + amt);
    const newTotalEarned = amt > 0 ? kid.total_earned + amt : kid.total_earned;

    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: newBalance, total_earned: newTotalEarned })
      .eq('id', kid.id);
    if (updErr) throw updErr;

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      type: amt > 0 ? 'bonus' : 'spend',
      amount: Math.abs(amt),
      reason: '🧪 테스트용 코인 조정',
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
