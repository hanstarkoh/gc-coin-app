import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { EQUIPPABLE_CATEGORIES, findShopItem } from '@/lib/shop';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { category, key } = await req.json();
    if (!EQUIPPABLE_CATEGORIES.includes(category)) {
      return NextResponse.json({ ok: false, error: '착용할 수 없는 종류예요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();

    if (key !== null) {
      const item = findShopItem(category, key);
      if (!item) return NextResponse.json({ ok: false, error: '존재하지 않는 아이템이에요.' }, { status: 400 });
      const { data: owned, error: ownedErr } = await sb
        .from('kid_inventory')
        .select('id')
        .eq('kid_id', kidId)
        .eq('item_key', key)
        .maybeSingle();
      if (ownedErr) throw ownedErr;
      if (!owned) return NextResponse.json({ ok: false, error: '보유하지 않은 아이템이에요.' }, { status: 400 });
    }

    const { error } = await sb
      .from('kid_equipped')
      .upsert({ kid_id: kidId, [`${category}_key`]: key }, { onConflict: 'kid_id' });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
