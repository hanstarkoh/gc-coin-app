import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { applyNewsPriceChange, randomNewsPct } from '@/lib/stocks';

export async function POST(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { headline, direction } = await req.json();
    const trimmed = (headline || '').trim();
    if (!trimmed) return NextResponse.json({ ok: false, error: '헤드라인을 입력해주세요.' }, { status: 400 });
    if (direction !== 'up' && direction !== 'down') {
      return NextResponse.json({ ok: false, error: '호재/악재를 선택해주세요.' }, { status: 400 });
    }
    const p = randomNewsPct(direction);

    const sb = supabaseAdmin();
    const { data: stock, error: stockErr } = await sb
      .from('stocks')
      .select('id, name, price')
      .eq('id', params.id)
      .single();
    if (stockErr || !stock) return NextResponse.json({ ok: false, error: '종목을 찾을 수 없어요.' }, { status: 404 });

    const newPrice = applyNewsPriceChange(stock.price, p);

    // 뉴스 기록부터 먼저 남겨서, 이게 실패하면(예: 마이그레이션 전) 가격은 건드리지 않습니다.
    const { error: newsErr } = await sb.from('stock_news').insert({
      stock_id: stock.id,
      stock_name: stock.name,
      headline: trimmed,
      pct: p,
      old_price: stock.price,
      new_price: newPrice,
    });
    if (newsErr) throw newsErr;

    const { error: updErr } = await sb.from('stocks').update({ price: newPrice }).eq('id', stock.id);
    if (updErr) throw updErr;

    const { error: histErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: newPrice });
    if (histErr) throw histErr;

    return NextResponse.json({ ok: true, newPrice, pct: p });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
