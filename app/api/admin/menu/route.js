import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from('menu_items')
      .select('id, name, price')
      .eq('item_date', today)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data, date: today });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { name, price } = await req.json();
    const trimmed = (name || '').trim();
    const p = Number(price);
    if (!trimmed || !p || p <= 0) {
      return NextResponse.json({ ok: false, error: '메뉴 이름과 가격을 확인해주세요.' }, { status: 400 });
    }
    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await sb
      .from('menu_items')
      .insert({ name: trimmed, price: p, item_date: today })
      .select('id, name, price')
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, item: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
