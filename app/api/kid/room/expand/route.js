import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { nextExpansionCost, ROOM_MAX_EXPANSIONS } from '@/lib/room';

export async function POST() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, room_expansions')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

    const cost = nextExpansionCost(kid.room_expansions);
    if (cost === null) {
      return NextResponse.json({ ok: false, error: '이미 최대로 넓혔어요.' }, { status: 400 });
    }
    if (kid.balance < cost) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const nextLevel = kid.room_expansions + 1;
    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: kid.balance - cost, room_expansions: nextLevel })
      .eq('id', kidId);
    if (updErr) throw updErr;

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: cost,
      reason: `🏠 마이룸 확장 (${nextLevel}/${ROOM_MAX_EXPANSIONS}단계)`,
      tx_date: new Date().toISOString().slice(0, 10),
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
