import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { applyNewsPriceChange } from '@/lib/stocks';

export async function POST(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { headline, pct } = await req.json();
    const trimmed = (headline || '').trim();
    const p = Number(pct);
    if (!trimmed) return NextResponse.json({ ok: false, error: '헤드라인을 입력해주세요.' }, { status: 400 });
    if (!Number.isInteger(p) || p === 0 || Math.abs(p) > 40) {
      return NextResponse.json({ ok: false, error: '등락률은 -40~40 사이의 0이 아닌 정수로 입력해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: stock, error: stockErr } = await sb
      .from('stocks')
      .select('id, name, price')
      .eq('id', params.id)
      .single();
    if (stockErr || !stock) return NextResponse.json({ ok: false, error: '종목을 찾을 수 없어요.' }, { status: 404 });

    const newPrice = applyNewsPriceChange(stock.price, p);

    const { error: updErr } = await sb.from('stocks').update({ price: newPrice }).eq('id', stock.id);
    if (updErr) throw updErr;

    const { error: histErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: newPrice });
    if (histErr) throw histErr;

    const { error: newsErr } = await sb.from('stock_news').insert({
      stock_id: stock.id,
      stock_name: stock.name,
      headline: trimmed,
      pct: p,
      old_price: stock.price,
      new_price: newPrice,
    });
    if (newsErr) throw newsErr;

    return NextResponse.json({ ok: true, newPrice });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
