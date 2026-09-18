import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: postings, error } = await sb
      .from('job_postings')
      .select('id, title, description, reward, headcount, is_active, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const postingIds = postings.map((p) => p.id);
    let applications = [];
    if (postingIds.length > 0) {
      const { data, error: appErr } = await sb
        .from('job_applications')
        .select('posting_id, kid_id, status')
        .in('posting_id', postingIds);
      if (appErr) throw appErr;
      applications = data;
    }

    const items = postings.map((p) => {
      const forThisPosting = applications.filter((a) => a.posting_id === p.id);
      const hiredCount = forThisPosting.filter((a) => a.status === 'hired' || a.status === 'completed').length;
      const mine = forThisPosting.find((a) => a.kid_id === kidId);
      return {
        ...p,
        hiredCount,
        myStatus: mine?.status || null,
      };
    });

    return NextResponse.json({ ok: true, postings: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
