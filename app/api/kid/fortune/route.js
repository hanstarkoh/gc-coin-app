import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { FORTUNE_PRICE, randomFortune } from '@/lib/fortunes';

export async function POST() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance, total_spent').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < FORTUNE_PRICE) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const newBalance = kid.balance - FORTUNE_PRICE;
    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: newBalance, total_spent: kid.total_spent + FORTUNE_PRICE })
      .eq('id', kidId);
    if (updErr) throw updErr;

    const today = new Date().toISOString().slice(0, 10);
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: FORTUNE_PRICE,
      reason: '🔮 오늘의 운세',
      tx_date: today,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, newBalance, fortune: randomFortune() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
