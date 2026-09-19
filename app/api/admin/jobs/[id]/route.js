import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { JOB_HEADCOUNT_MAX } from '@/lib/jobs';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};
    if ('isActive' in body) update.is_active = !!body.isActive;
    if ('headcount' in body) {
      const h = Number(body.headcount);
      if (!h || h <= 0 || h > JOB_HEADCOUNT_MAX) {
        return NextResponse.json({ ok: false, error: `정원은 1~${JOB_HEADCOUNT_MAX}명 사이로 정해주세요.` }, { status: 400 });
      }
      update.headcount = h;
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('job_postings').update(update).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('job_postings').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
