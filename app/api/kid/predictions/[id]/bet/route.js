import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { option, amount } = await req.json();
    if (option !== 'a' && option !== 'b') {
      return NextResponse.json({ ok: false, error: '선택지를 골라주세요.' }, { status: 400 });
    }
    const betAmount = Number(amount);
    if (!Number.isInteger(betAmount) || betAmount <= 0) {
      return NextResponse.json({ ok: false, error: '베팅 금액을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: pred, error: predErr } = await sb
      .from('predictions')
      .select('id, question, option_a, option_b, status, closes_at')
      .eq('id', params.id)
      .single();
    if (predErr || !pred) return NextResponse.json({ ok: false, error: '질문을 찾을 수 없어요.' }, { status: 404 });
    const closed = pred.status !== 'open' || (pred.closes_at && new Date(pred.closes_at) <= new Date());
    if (closed) return NextResponse.json({ ok: false, error: '이미 마감된 질문이에요.' }, { status: 400 });

    const { data: existing, error: existingErr } = await sb
      .from('prediction_bets')
      .select('id')
      .eq('prediction_id', pred.id)
      .eq('kid_id', kidId)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return NextResponse.json({ ok: false, error: '이미 이 질문에 베팅했어요.' }, { status: 400 });

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance').eq('id', kidId).single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');
    if (kid.balance < betAmount) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const { error: updErr } = await sb.from('kids').update({ balance: kid.balance - betAmount }).eq('id', kidId);
    if (updErr) throw updErr;

    const { error: betErr } = await sb.from('prediction_bets').insert({
      prediction_id: pred.id,
      kid_id: kidId,
      kid_name: kid.name,
      option,
      amount: betAmount,
    });
    if (betErr) throw betErr;

    const optionLabel = option === 'a' ? pred.option_a : pred.option_b;
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: betAmount,
      reason: `🎲 예측 베팅: ${pred.question} (${optionLabel})`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
