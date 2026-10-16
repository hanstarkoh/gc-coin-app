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

    // balance가 읽은 값 그대로일 때만 갱신해서, 두 요청이 거의 동시에 들어와도(더블탭 등)
    // 하나만 성공하게 함 — 안 그러면 코인은 두 번 깎이는데 기부는 한 번만 기록돼요.
    const { data: updKidRows, error: updKidErr } = await sb
      .from('kids')
      .update({
        balance: kid.balance - amt,
        total_donated: (kid.total_donated || 0) + amt,
        total_spent: (kid.total_spent || 0) + amt,
      })
      .eq('id', kid.id)
      .eq('balance', kid.balance)
      .select('id');
    if (updKidErr) throw updKidErr;
    if (!updKidRows || updKidRows.length === 0) {
      return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    // goal.current는 여러 청소년이 동시에 기부할 수 있는 공유 값이라(위 balance 가드와 달리
    // "같은 청소년의 중복 요청"만 막는 걸로는 부족함), 매번 최신값을 다시 읽어서 그 값
    // 그대로일 때만 갱신하는 걸 최대 5번 재시도합니다 — 이미 코인은 빠지고 기부 기록도
    // 남은 뒤라, 여기서 실패해도 그냥 포기하면 기부가 목표 진행률에서 누락돼버려요.
    let achieved = false;
    let goalUpdated = false;
    for (let attempt = 0; attempt < 5 && !goalUpdated; attempt++) {
      const { data: freshGoal, error: freshErr } = await sb
        .from('group_goals')
        .select('current, target, achieved_at')
        .eq('id', goal.id)
        .single();
      if (freshErr) throw freshErr;
      const newCurrent = freshGoal.current + amt;
      const willAchieve = !freshGoal.achieved_at && newCurrent >= freshGoal.target;
      const goalUpdate = { current: newCurrent };
      if (willAchieve) goalUpdate.achieved_at = new Date().toISOString();
      const { data: updGoalRows, error: updGoalErr } = await sb
        .from('group_goals')
        .update(goalUpdate)
        .eq('id', goal.id)
        .eq('current', freshGoal.current)
        .select('id');
      if (updGoalErr) throw updGoalErr;
      if (updGoalRows && updGoalRows.length > 0) {
        achieved = willAchieve;
        goalUpdated = true;
      }
    }
    if (!goalUpdated) throw new Error('목표 갱신이 너무 몰려서 실패했어요. 잠시 후 목표 진행률을 확인해주세요.');

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

    return NextResponse.json({ ok: true, achieved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
