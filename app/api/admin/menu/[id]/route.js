import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { isValidMenuCategory, MENU_DESCRIPTION_MAX_LENGTH } from '@/lib/menuCategories';

export async function PATCH(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const body = await req.json();
    const update = {};

    if ('price' in body) {
      const p = Number(body.price);
      if (!p || p <= 0) {
        return NextResponse.json({ ok: false, error: '가격을 확인해주세요.' }, { status: 400 });
      }
      update.price = p;
    }

    if ('stock' in body) {
      const hasStock = body.stock !== '' && body.stock !== null && body.stock !== undefined;
      const stockValue = hasStock ? Number(body.stock) : null;
      if (hasStock && (!Number.isInteger(stockValue) || stockValue < 0)) {
        return NextResponse.json({ ok: false, error: '수량을 확인해주세요.' }, { status: 400 });
      }
      update.stock = stockValue;
    }

    if ('category' in body) {
      if (!isValidMenuCategory(body.category)) {
        return NextResponse.json({ ok: false, error: '소분류를 확인해주세요.' }, { status: 400 });
      }
      update.category = body.category;
    }

    if ('description' in body) {
      const trimmed = (body.description || '').trim().slice(0, MENU_DESCRIPTION_MAX_LENGTH);
      update.description = trimmed || null;
    }

    const sb = supabaseAdmin();
    const { error } = await sb.from('menu_items').update(update).eq('id', params.id);
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
