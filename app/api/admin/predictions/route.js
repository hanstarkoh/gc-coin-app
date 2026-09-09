import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: predictions, error } = await sb
      .from('predictions')
      .select('id, question, option_a, option_b, status, resolved_option, created_at, closes_at, resolved_at')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const { data: bets, error: betsErr } = await sb
      .from('prediction_bets')
      .select('prediction_id, kid_name, option, amount, payout');
    if (betsErr) throw betsErr;

    const list = predictions.map((p) => {
      const myBets = bets.filter((b) => b.prediction_id === p.id);
      return {
        ...p,
        poolA: myBets.filter((b) => b.option === 'a').reduce((s, b) => s + b.amount, 0),
        poolB: myBets.filter((b) => b.option === 'b').reduce((s, b) => s + b.amount, 0),
        betCount: myBets.length,
        bets: myBets,
      };
    });

    return NextResponse.json({ ok: true, predictions: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { question, optionA, optionB, closesAt } = await req.json();
    if (!question?.trim()) return NextResponse.json({ ok: false, error: '질문을 입력해주세요.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { error } = await sb.from('predictions').insert({
      question: question.trim(),
      option_a: optionA?.trim() || '예',
      option_b: optionB?.trim() || '아니오',
      closes_at: closesAt || null,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
