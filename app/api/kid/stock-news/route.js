import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { todayStartUtcIso } from '@/lib/stocks';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stock_news')
      .select('id, stock_id, stock_name, headline, pct, created_at')
      .gte('created_at', todayStartUtcIso())
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    // 종목별로 오늘 가장 최근 뉴스 1건만 상단 배너에 띄웁니다(같은 종목 뉴스가 여러 번 겹쳐 뜨지 않도록).
    const seen = new Set();
    const latestPerStock = [];
    for (const n of data) {
      if (seen.has(n.stock_id)) continue;
      seen.add(n.stock_id);
      latestPerStock.push(n);
    }
    return NextResponse.json({ ok: true, news: latestPerStock });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
