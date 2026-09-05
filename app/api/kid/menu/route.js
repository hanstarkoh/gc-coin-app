import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

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
