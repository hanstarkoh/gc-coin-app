import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { DEPOSIT_PLANS, MIN_DEPOSIT_AMOUNT, findDepositPlan, calcPayout } from '@/lib/deposits';

// 만기가 지난 예금을 찾아서 원금+이자를 잔액에 넣어주고 claimed 처리합니다.
// 주식 시세 갱신과 같은 "조회 시점에 지연 처리" 방식이라 별도 크론이 필요 없습니다.
async function claimMatured(sb, kidId) {
  const now = new Date().toISOString();
  const { data: matured, error } = await sb
    .from('kid_deposits')
    .select('id, principal, rate_pct, term_days')
    .eq('kid_id', kidId)
    .eq('claimed', false)
    .lte('matures_at', now);
  if (error) throw error;
  if (!matured || matured.length === 0) return false;

  const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance').eq('id', kidId).single();
  if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

  let balance = kid.balance;
  for (const d of matured) {
    const payout = calcPayout(d.principal, d.rate_pct);
    balance += payout;
    const { error: updErr } = await sb
      .from('kid_deposits')
      .update({ claimed: true, payout })
      .eq('id', d.id);
    if (updErr) throw updErr;
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'earn',
      amount: payout,
      reason: `🏦 예금 만기 (${d.term_days}일, +${d.rate_pct}%) 원금+이자`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;
  }
  const { error: balErr } = await sb.from('kids').update({ balance }).eq('id', kidId);
  if (balErr) throw balErr;
  return true;
}

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const claimed = await claimMatured(sb, kidId);

    const { data: deposits, error } = await sb
      .from('kid_deposits')
      .select('id, principal, rate_pct, term_days, created_at, matures_at, claimed, payout')
      .eq('kid_id', kidId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ ok: true, plans: DEPOSIT_PLANS, minAmount: MIN_DEPOSIT_AMOUNT, deposits, claimed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { days, amount } = await req.json();
    const plan = findDepositPlan(days);
    if (!plan) return NextResponse.json({ ok: false, error: '존재하지 않는 상품이에요.' }, { status: 400 });

    const principal = Number(amount);
    if (!Number.isInteger(principal) || principal < MIN_DEPOSIT_AMOUNT) {
      return NextResponse.json({ ok: false, error: `최소 ${MIN_DEPOSIT_AMOUNT} GC부터 넣을 수 있어요.` }, { status: 400 });
    }

    const sb = supabaseAdmin();
    await claimMatured(sb, kidId);

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance').eq('id', kidId).single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');
    if (kid.balance < principal) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const { error: updErr } = await sb.from('kids').update({ balance: kid.balance - principal }).eq('id', kidId);
    if (updErr) throw updErr;

    const maturesAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();
    const { error: insErr } = await sb.from('kid_deposits').insert({
      kid_id: kidId,
      principal,
      rate_pct: plan.ratePct,
      term_days: plan.days,
      matures_at: maturesAt,
    });
    if (insErr) throw insErr;

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: principal,
      reason: `🏦 예금 가입 (${plan.days}일, +${plan.ratePct}%)`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
