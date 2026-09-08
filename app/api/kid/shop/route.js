import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { SHOP_CATEGORIES } from '@/lib/shop';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: inv, error: invErr } = await sb.from('kid_inventory').select('item_key').eq('kid_id', kidId);
    if (invErr) throw invErr;
    const ownedSet = new Set(inv.map((i) => i.item_key));

    const { data: equippedRow, error: eqErr } = await sb
      .from('kid_equipped')
      .select('avatar_key, accessory_key, sticker_key, theme_key')
      .eq('kid_id', kidId)
      .maybeSingle();
    if (eqErr) throw eqErr;

    const categories = Object.fromEntries(
      Object.entries(SHOP_CATEGORIES).map(([cat, items]) => [
        cat,
        items.map((it) => ({ ...it, owned: ownedSet.has(it.key) })),
      ])
    );

    return NextResponse.json({
      ok: true,
      categories,
      equipped: {
        avatar: equippedRow?.avatar_key || null,
        accessory: equippedRow?.accessory_key || null,
        sticker: equippedRow?.sticker_key || null,
        theme: equippedRow?.theme_key || null,
      },
      hasNameGlow: ownedSet.has('name_glow'),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
