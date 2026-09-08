import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: settings, error: settingsErr } = await sb.from('settings').select('orders_open').eq('id', 1).single();
    if (settingsErr) throw settingsErr;

    const { data, error } = await sb
      .from('menu_items')
      .select('id, name, price, stock')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, items: data, ordersOpen: settings.orders_open });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
