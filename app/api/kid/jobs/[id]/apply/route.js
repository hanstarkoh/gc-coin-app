import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(_req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: posting, error: postingErr } = await sb
      .from('job_postings')
      .select('id, is_active')
      .eq('id', params.id)
      .single();
    if (postingErr || !posting || !posting.is_active) {
      return NextResponse.json({ ok: false, error: '모집 중인 공고가 아니에요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { error: insErr } = await sb.from('job_applications').insert({
      posting_id: posting.id,
      kid_id: kid.id,
      kid_name: kid.name,
      status: 'applied',
    });
    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ ok: false, error: '이미 지원했어요.' }, { status: 400 });
      }
      throw insErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
