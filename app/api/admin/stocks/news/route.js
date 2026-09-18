import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stock_news')
      .select('id, stock_id, stock_name, headline, pct, old_price, new_price, created_at, source')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      // source 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 그때는 없이 조회합니다.
      const fallback = await sb
        .from('stock_news')
        .select('id, stock_id, stock_name, headline, pct, old_price, new_price, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (fallback.error) throw fallback.error;
      const news = fallback.data.map((n) => ({ ...n, source: 'admin' }));
      return NextResponse.json({ ok: true, news });
    }
    return NextResponse.json({ ok: true, news: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
