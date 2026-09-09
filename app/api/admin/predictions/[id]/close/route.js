import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function POST(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data: pred, error: predErr } = await sb.from('predictions').select('status').eq('id', params.id).single();
    if (predErr || !pred) throw predErr || new Error('질문을 찾을 수 없어요.');
    if (pred.status !== 'open') {
      return NextResponse.json({ ok: false, error: '이미 마감됐어요.' }, { status: 400 });
    }

    const { error } = await sb.from('predictions').update({ status: 'closed' }).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
