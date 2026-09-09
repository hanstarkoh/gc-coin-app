import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();

    // 마감 시각이 지난 열린 질문은 조회 시점에 자동으로 마감 처리합니다(주식 시세 갱신과 같은 방식).
    const nowIso = new Date().toISOString();
    const { error: autoCloseErr } = await sb
      .from('predictions')
      .update({ status: 'closed' })
      .eq('status', 'open')
      .not('closes_at', 'is', null)
      .lte('closes_at', nowIso);
    if (autoCloseErr) throw autoCloseErr;

    const { data: predictions, error } = await sb
      .from('predictions')
      .select('id, question, option_a, option_b, status, resolved_option, created_at, closes_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    const { data: bets, error: betsErr } = await sb
      .from('prediction_bets')
      .select('prediction_id, kid_id, option, amount, payout');
    if (betsErr) throw betsErr;

    const list = predictions.map((p) => {
      const relevant = bets.filter((b) => b.prediction_id === p.id);
      const mine = relevant.find((b) => b.kid_id === kidId) || null;
      return {
        ...p,
        poolA: relevant.filter((b) => b.option === 'a').reduce((s, b) => s + b.amount, 0),
        poolB: relevant.filter((b) => b.option === 'b').reduce((s, b) => s + b.amount, 0),
        myBet: mine ? { option: mine.option, amount: mine.amount, payout: mine.payout } : null,
      };
    });

    return NextResponse.json({ ok: true, predictions: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
