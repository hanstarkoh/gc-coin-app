import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

const ATTENDANCE_COIN = 2;

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { kidIds } = await req.json();
    if (!Array.isArray(kidIds) || kidIds.length === 0) {
      return NextResponse.json({ ok: false, error: '선택된 학생이 없어요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    // 오늘 이미 출석 지급받은 학생 제외
    const { data: already, error: alreadyErr } = await sb
      .from('transactions')
      .select('kid_id')
      .eq('tx_date', today)
      .eq('reason', '출석')
      .in('kid_id', kidIds);
    if (alreadyErr) throw alreadyErr;
    const alreadySet = new Set(already.map((t) => t.kid_id));
    const targetIds = kidIds.filter((id) => !alreadySet.has(id));

    if (targetIds.length === 0) {
      return NextResponse.json({ ok: true, given: 0, message: '이미 모두 오늘 지급받았어요.' });
    }

    const { data: kids, error: kidsErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned, attendance_count')
      .in('id', targetIds);
    if (kidsErr) throw kidsErr;

    // 성장 지표용: 출석 코인을 더하기 "직전" 자산 상태(잔액/예금 원금/주식 평가액)를 한 줄
    // 기록해둡니다. 이 스냅샷이 실패해도 출석 지급 자체는 절대 막지 않아요(로그만 남김).
    try {
      const [{ data: deposits }, { data: holdings }, { data: allStocks }] = await Promise.all([
        sb.from('kid_deposits').select('kid_id, principal').eq('claimed', false).in('kid_id', targetIds),
        sb.from('stock_holdings').select('kid_id, stock_id, shares').in('kid_id', targetIds),
        sb.from('stocks').select('id, price'),
      ]);

      const depositMap = new Map();
      for (const d of deposits || []) depositMap.set(d.kid_id, (depositMap.get(d.kid_id) || 0) + d.principal);

      const priceMap = new Map((allStocks || []).map((s) => [s.id, s.price]));
      const stockMap = new Map();
      for (const h of holdings || []) {
        const price = priceMap.get(h.stock_id) || 0;
        stockMap.set(h.kid_id, (stockMap.get(h.kid_id) || 0) + h.shares * price);
      }

      const snapshotRows = kids.map((kid) => ({
        kid_id: kid.id,
        visit_date: today,
        balance: kid.balance,
        deposit_principal: depositMap.get(kid.id) || 0,
        stock_value: stockMap.get(kid.id) || 0,
      }));

      const { error: snapErr } = await sb
        .from('kid_visit_snapshots')
        .upsert(snapshotRows, { onConflict: 'kid_id,visit_date', ignoreDuplicates: true });
      if (snapErr) console.error('kid_visit_snapshots insert failed:', snapErr.message);
    } catch (snapErr) {
      console.error('kid_visit_snapshots insert failed:', snapErr);
    }

    for (const kid of kids) {
      const { error: updErr } = await sb
        .from('kids')
        .update({
          balance: kid.balance + ATTENDANCE_COIN,
          total_earned: kid.total_earned + ATTENDANCE_COIN,
          attendance_count: kid.attendance_count + 1,
        })
        .eq('id', kid.id);
      if (updErr) throw updErr;

      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: kid.id,
        kid_name: kid.name,
        type: 'earn',
        amount: ATTENDANCE_COIN,
        reason: '출석',
        tx_date: today,
      });
      if (txErr) throw txErr;
    }

    return NextResponse.json({ ok: true, given: kids.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
