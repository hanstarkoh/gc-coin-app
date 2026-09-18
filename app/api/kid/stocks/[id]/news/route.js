import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { STOCK_NEWS_KEEP } from '@/lib/stocks';

export async function GET(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stock_news')
      .select('id, headline, pct, created_at')
      .eq('stock_id', params.id)
      .order('created_at', { ascending: false })
      .limit(STOCK_NEWS_KEEP);
    if (error) throw error;
    return NextResponse.json({ ok: true, news: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
