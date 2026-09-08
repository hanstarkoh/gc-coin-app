import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('stocks')
      .select('id, name, emoji, price, is_active, created_at')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, stocks: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, emoji, price } = await req.json();
    const p = Number(price);
    if (!name?.trim() || !p || p <= 0) {
      return NextResponse.json({ ok: false, error: '종목 이름과 시작 가격을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: stock, error } = await sb
      .from('stocks')
      .insert({ name: name.trim(), emoji: (emoji || '').trim() || '📈', price: p })
      .select('id')
      .single();
    if (error) throw error;

    const { error: histErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: p });
    if (histErr) throw histErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
