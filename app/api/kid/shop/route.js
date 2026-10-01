import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { SHOP_CATEGORIES, activeSeasonalItems } from '@/lib/shop';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: inv, error: invErr } = await sb
      .from('kid_inventory')
      .select('item_key, expires_at')
      .eq('kid_id', kidId);
    if (invErr) throw invErr;
    const now = new Date();
    // expires_at이 null이면 영구 보유, 지났으면 만료된 것으로 간주해 다시 구매 가능하게 둡니다.
    const activeMap = new Map();
    for (const i of inv) {
      const active = i.expires_at === null || new Date(i.expires_at) > now;
      if (active) activeMap.set(i.item_key, i.expires_at);
    }

    const { data: equippedRow, error: eqErr } = await sb
      .from('kid_equipped')
      .select('avatar_key, accessory_key, sticker_key, theme_key')
      .eq('kid_id', kidId)
      .maybeSingle();
    if (eqErr) throw eqErr;

    const categories = Object.fromEntries(
      Object.entries(SHOP_CATEGORIES).map(([cat, items]) => {
        // 시즌 코스튬은 accessory 탭에 기간 안일 때만 같이 노출(평소엔 안 보임).
        const list = cat === 'accessory' ? [...items, ...activeSeasonalItems()] : items;
        return [
          cat,
          list.map((it) => ({
            ...it,
            owned: activeMap.has(it.key),
            expiresAt: activeMap.get(it.key) || null,
          })),
        ];
      })
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
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
