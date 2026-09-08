import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { itemKey } = await req.json();
    if (!itemKey) return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { error } = await sb.from('kid_room_items').delete().eq('kid_id', kidId).eq('item_key', itemKey);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
