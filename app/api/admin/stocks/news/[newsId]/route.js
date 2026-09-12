import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

// 뉴스 기록(티커에 뜨는 것)만 지웁니다. 이미 반영된 시세는 되돌리지 않아요 —
// 잘못 눌렀을 때 헤드라인만 정리하는 용도입니다.
export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('stock_news').delete().eq('id', params.newsId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
