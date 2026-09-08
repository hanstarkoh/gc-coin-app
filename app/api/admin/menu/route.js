import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('menu_items')
      .select('id, name, price, stock')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, price, stock } = await req.json();
    const trimmed = (name || '').trim();
    const p = Number(price);
    if (!trimmed || !p || p <= 0) {
      return NextResponse.json({ ok: false, error: '메뉴 이름과 가격을 확인해주세요.' }, { status: 400 });
    }
    const hasStock = stock !== '' && stock !== null && stock !== undefined;
    const stockValue = hasStock ? Number(stock) : null;
    if (hasStock && (!Number.isInteger(stockValue) || stockValue < 0)) {
      return NextResponse.json({ ok: false, error: '수량을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('menu_items')
      .insert({ name: trimmed, price: p, stock: stockValue })
      .select('id, name, price, stock')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
