import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { amount } = await req.json();
    const amt = Number(amount);
    if (!amt || amt <= 0 || !Number.isInteger(amt)) {
      return NextResponse.json({ ok: false, error: '기부할 코인 수를 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: goal, error: goalErr } = await sb
      .from('group_goals')
      .select('id, title, current, target, achieved_at, is_active')
      .eq('id', params.id)
      .single();
    if (goalErr || !goal || !goal.is_active) {
      return NextResponse.json({ ok: false, error: '기부할 수 없는 목표예요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_donated, total_spent')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < amt) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const { error: updKidErr } = await sb
      .from('kids')
      .update({
        balance: kid.balance - amt,
        total_donated: (kid.total_donated || 0) + amt,
        total_spent: (kid.total_spent || 0) + amt,
      })
      .eq('id', kid.id);
    if (updKidErr) throw updKidErr;

    const newCurrent = goal.current + amt;
    const goalUpdate = { current: newCurrent };
    if (!goal.achieved_at && newCurrent >= goal.target) {
      goalUpdate.achieved_at = new Date().toISOString();
    }
    const { error: updGoalErr } = await sb.from('group_goals').update(goalUpdate).eq('id', goal.id);
    if (updGoalErr) throw updGoalErr;

    const { error: donationErr } = await sb.from('group_goal_donations').insert({
      goal_id: goal.id,
      kid_id: kid.id,
      kid_name: kid.name,
      amount: amt,
    });
    if (donationErr) throw donationErr;

    // 거래 내역(transactions)에도 남겨야 관리자 화면에서 "쓴 돈"으로 보임.
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      type: 'spend',
      amount: amt,
      reason: `💝 기부(${goal.title})`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, achieved: newCurrent >= goal.target });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
