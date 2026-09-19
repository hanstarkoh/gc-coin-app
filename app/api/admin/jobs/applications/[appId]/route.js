import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { status } = await req.json();
    if (status !== 'hired' && status !== 'completed' && status !== 'applied') {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: app, error: appErr } = await sb
      .from('job_applications')
      .select('id, posting_id, kid_id, kid_name, status')
      .eq('id', params.appId)
      .single();
    if (appErr || !app) return NextResponse.json({ ok: false, error: '지원 정보를 찾을 수 없어요.' }, { status: 404 });

    if (status === 'applied') {
      // 선발 취소 — 채용됐다가 실제로는 못 하게 된 경우 지원 상태로 되돌려서 정원을 다시 비웁니다.
      // 이미 코인이 지급된 완료 건은 되돌리지 않습니다.
      if (app.status !== 'hired') {
        return NextResponse.json({ ok: false, error: '채용된 지원만 취소할 수 있어요.' }, { status: 400 });
      }
      const { data: updRows, error: updErr } = await sb
        .from('job_applications')
        .update({ status: 'applied', resolved_at: null })
        .eq('id', app.id)
        .eq('status', 'hired')
        .select('id');
      if (updErr) throw updErr;
      if (!updRows || updRows.length === 0) {
        return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    if (status === 'hired') {
      if (app.status !== 'applied') {
        return NextResponse.json({ ok: false, error: '이미 처리된 지원이에요.' }, { status: 400 });
      }
      const { data: posting, error: postingErr } = await sb
        .from('job_postings')
        .select('id, headcount')
        .eq('id', app.posting_id)
        .single();
      if (postingErr || !posting) return NextResponse.json({ ok: false, error: '공고를 찾을 수 없어요.' }, { status: 404 });

      const { count, error: countErr } = await sb
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('posting_id', app.posting_id)
        .in('status', ['hired', 'completed']);
      if (countErr) throw countErr;
      if ((count || 0) >= posting.headcount) {
        return NextResponse.json({ ok: false, error: '정원이 다 찼어요.' }, { status: 400 });
      }

      // 동시에 여러 명을 채용 처리해도 한 지원자당 한 번만 바뀌게(더블탭/동시요청 방지).
      const { data: updRows, error: updErr } = await sb
        .from('job_applications')
        .update({ status: 'hired', resolved_at: new Date().toISOString() })
        .eq('id', app.id)
        .eq('status', 'applied')
        .select('id');
      if (updErr) throw updErr;
      if (!updRows || updRows.length === 0) {
        return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }

    // status === 'completed'
    if (app.status !== 'hired') {
      return NextResponse.json({ ok: false, error: '채용된 지원만 완료 처리할 수 있어요.' }, { status: 400 });
    }
    const { data: posting, error: postingErr } = await sb
      .from('job_postings')
      .select('id, title, reward')
      .eq('id', app.posting_id)
      .single();
    if (postingErr || !posting) return NextResponse.json({ ok: false, error: '공고를 찾을 수 없어요.' }, { status: 404 });

    const { data: updRows, error: updErr } = await sb
      .from('job_applications')
      .update({ status: 'completed', resolved_at: new Date().toISOString() })
      .eq('id', app.id)
      .eq('status', 'hired')
      .select('id');
    if (updErr) throw updErr;
    if (!updRows || updRows.length === 0) {
      return NextResponse.json({ ok: false, error: '이미 처리된 요청이에요.' }, { status: 409 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_earned')
      .eq('id', app.kid_id)
      .single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

    const { error: balErr } = await sb
      .from('kids')
      .update({ balance: kid.balance + posting.reward, total_earned: kid.total_earned + posting.reward })
      .eq('id', kid.id);
    if (balErr) throw balErr;

    const today = new Date().toISOString().slice(0, 10);
    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      type: 'job',
      amount: posting.reward,
      reason: posting.title,
      tx_date: today,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
