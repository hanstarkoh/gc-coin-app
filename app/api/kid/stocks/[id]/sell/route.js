import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { shares } = await req.json();
    const qty = Number(shares);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return NextResponse.json({ ok: false, error: '주식 수를 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: stock, error: stockErr } = await sb
      .from('stocks')
      .select('id, name, price')
      .eq('id', params.id)
      .single();
    if (stockErr || !stock) return NextResponse.json({ ok: false, error: '종목을 찾을 수 없어요.' }, { status: 404 });

    const { data: holding, error: holdingErr } = await sb
      .from('stock_holdings')
      .select('id, shares')
      .eq('kid_id', kidId)
      .eq('stock_id', stock.id)
      .maybeSingle();
    if (holdingErr) throw holdingErr;
    if (!holding || holding.shares < qty) {
      return NextResponse.json({ ok: false, error: '보유한 주식보다 많이 팔 수 없어요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, name, balance').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const amount = stock.price * qty;

    const { error: updErr } = await sb.from('kids').update({ balance: kid.balance + amount }).eq('id', kid.id);
    if (updErr) throw updErr;

    const { error: holdingUpdErr } = await sb
      .from('stock_holdings')
      .update({ shares: holding.shares - qty })
      .eq('id', holding.id);
    if (holdingUpdErr) throw holdingUpdErr;

    const { error: orderErr } = await sb.from('stock_orders').insert({
      kid_id: kid.id,
      kid_name: kid.name,
      stock_id: stock.id,
      stock_name: stock.name,
      type: 'sell',
      shares: qty,
      price: stock.price,
      amount,
    });
    if (orderErr) throw orderErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
