import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { count, error: cntErr } = await sb
      .from('prediction_bets')
      .select('id', { count: 'exact', head: true })
      .eq('prediction_id', params.id);
    if (cntErr) throw cntErr;
    if (count > 0) {
      return NextResponse.json({ ok: false, error: '이미 베팅이 있어서 삭제할 수 없어요.' }, { status: 400 });
    }

    const { error } = await sb.from('predictions').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
