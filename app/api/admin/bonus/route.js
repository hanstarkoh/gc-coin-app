import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { kidId, amount, reason } = await req.json();
    const amt = Number(amount);
    if (!kidId || !amt || amt <= 0) {
      return NextResponse.json({ ok: false, error: '학생과 지급 코인을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: kid.balance + amt, total_earned: kid.total_earned + amt })
      .eq('id', kidId);
    if (updErr) throw updErr;

    const today = new Date().toISOString().slice(0, 10);
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'bonus',
      amount: amt,
      reason: (reason || '').trim() || '보너스',
      tx_date: today,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
