import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function POST(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { action } = await req.json();
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: sub, error: subErr } = await sb
      .from('event_submissions')
      .select('id, kid_id, event_title, reward, status')
      .eq('id', params.id)
      .single();
    if (subErr || !sub) return NextResponse.json({ ok: false, error: '제출 정보를 찾을 수 없어요.' }, { status: 404 });
    if (sub.status !== 'pending') {
      return NextResponse.json({ ok: false, error: '이미 처리된 요청이에요.' }, { status: 400 });
    }

    if (action === 'approve') {
      const { data: kid, error: kidErr } = await sb
        .from('kids')
        .select('id, name, balance, total_earned')
        .eq('id', sub.kid_id)
        .single();
      if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

      const { error: updErr } = await sb
        .from('kids')
        .update({ balance: kid.balance + sub.reward, total_earned: kid.total_earned + sub.reward })
        .eq('id', kid.id);
      if (updErr) throw updErr;

      const today = new Date().toISOString().slice(0, 10);
      const { error: txErr } = await sb.from('transactions').insert({
        kid_id: kid.id,
        kid_name: kid.name,
        type: 'event',
        amount: sub.reward,
        reason: sub.event_title,
        tx_date: today,
      });
      if (txErr) throw txErr;
    }

    const { error: resolveErr } = await sb
      .from('event_submissions')
      .update({ status: action === 'approve' ? 'approved' : 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', sub.id);
    if (resolveErr) throw resolveErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
