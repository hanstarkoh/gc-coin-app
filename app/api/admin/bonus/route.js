import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const amt = Number(body.amount);
    const kidIds = Array.isArray(body.kidIds) ? body.kidIds : body.kidId ? [body.kidId] : [];
    const reason = (body.reason || '').trim() || '보너스';

    if (kidIds.length === 0 || !amt || amt <= 0) {
      return NextResponse.json({ ok: false, error: '학생과 지급 코인을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: kids, error: kidsErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned')
      .in('id', kidIds);
    if (kidsErr) throw kidsErr;
    if (kids.length === 0) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    for (const kid of kids) {
      const { error: updErr } = await sb
        .from('kids')
        .update({ balance: kid.balance + amt, total_earned: kid.total_earned + amt })
        .eq('id', kid.id);
      if (updErr) throw updErr;

      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: kid.id,
        kid_name: kid.name,
        type: 'bonus',
        amount: amt,
        reason,
        tx_date: today,
      });
      if (txErr) throw txErr;
    }

    return NextResponse.json({ ok: true, given: kids.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
