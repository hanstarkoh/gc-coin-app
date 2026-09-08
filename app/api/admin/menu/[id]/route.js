import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { stock } = await req.json();
    const hasStock = stock !== '' && stock !== null && stock !== undefined;
    const stockValue = hasStock ? Number(stock) : null;
    if (hasStock && (!Number.isInteger(stockValue) || stockValue < 0)) {
      return NextResponse.json({ ok: false, error: '수량을 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('menu_items').update({ stock: stockValue }).eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const { error } = await sb.from('menu_items').delete().eq('id', params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
