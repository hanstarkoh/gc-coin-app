import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { JOB_TITLE_MAX_LENGTH, JOB_DESCRIPTION_MAX_LENGTH, JOB_HEADCOUNT_MAX } from '@/lib/jobs';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: postings, error } = await sb.from('job_postings').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const postingIds = postings.map((p) => p.id);
    let applications = [];
    if (postingIds.length > 0) {
      const { data, error: appErr } = await sb
        .from('job_applications')
        .select('id, posting_id, kid_id, kid_name, status, created_at')
        .in('posting_id', postingIds)
        .order('created_at', { ascending: true });
      if (appErr) throw appErr;
      applications = data;
    }

    const items = postings.map((p) => ({
      ...p,
      applications: applications.filter((a) => a.posting_id === p.id),
    }));

    return NextResponse.json({ ok: true, postings: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { title, description, reward, headcount } = await req.json();
    const trimmedTitle = (title || '').trim().slice(0, JOB_TITLE_MAX_LENGTH);
    const r = Number(reward);
    const h = Number(headcount);
    if (!trimmedTitle) return NextResponse.json({ ok: false, error: '공고 제목을 입력해주세요.' }, { status: 400 });
    if (!r || r <= 0) return NextResponse.json({ ok: false, error: '보상 코인을 확인해주세요.' }, { status: 400 });
    if (!h || h <= 0 || h > JOB_HEADCOUNT_MAX) {
      return NextResponse.json({ ok: false, error: `정원은 1~${JOB_HEADCOUNT_MAX}명 사이로 정해주세요.` }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('job_postings').insert({
      title: trimmedTitle,
      description: (description || '').trim().slice(0, JOB_DESCRIPTION_MAX_LENGTH) || null,
      reward: r,
      headcount: h,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
