import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { calcPoolPayouts } from '@/lib/predictions';

export async function POST(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { winner } = await req.json();
    if (winner !== 'a' && winner !== 'b') {
      return NextResponse.json({ ok: false, error: '결과를 선택해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: pred, error: predErr } = await sb
      .from('predictions')
      .select('id, question, option_a, option_b, status')
      .eq('id', params.id)
      .single();
    if (predErr || !pred) throw predErr || new Error('질문을 찾을 수 없어요.');
    if (pred.status === 'resolved') {
      return NextResponse.json({ ok: false, error: '이미 결과가 발표됐어요.' }, { status: 400 });
    }

    const { data: bets, error: betsErr } = await sb
      .from('prediction_bets')
      .select('id, kid_id, kid_name, option, amount')
      .eq('prediction_id', pred.id);
    if (betsErr) throw betsErr;

    const payouts = calcPoolPayouts(bets, winner);
    const winnerLabel = winner === 'a' ? pred.option_a : pred.option_b;

    for (const p of payouts) {
      const bet = bets.find((b) => b.id === p.id);
      const { error: betUpdErr } = await sb.from('prediction_bets').update({ payout: p.payout }).eq('id', p.id);
      if (betUpdErr) throw betUpdErr;
      if (p.payout <= 0) continue;

      const { data: kid, error: kidErr } = await sb.from('kids').select('balance').eq('id', bet.kid_id).single();
      if (kidErr || !kid) continue;
      const { error: balErr } = await sb.from('kids').update({ balance: kid.balance + p.payout }).eq('id', bet.kid_id);
      if (balErr) throw balErr;

      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: bet.kid_id,
        kid_name: bet.kid_name,
        type: 'earn',
        amount: p.payout,
        reason: `🎲 예측 성공: ${pred.question} (${winnerLabel})`,
        tx_date: new Date().toISOString().slice(0, 10),
      });
      if (txErr) throw txErr;
    }

    const { error: updErr } = await sb
      .from('predictions')
      .update({ status: 'resolved', resolved_option: winner, resolved_at: new Date().toISOString() })
      .eq('id', pred.id);
    if (updErr) throw updErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
