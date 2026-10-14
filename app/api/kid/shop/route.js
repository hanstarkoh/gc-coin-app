import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { SHOP_CATEGORIES, EQUIPPABLE_CATEGORIES, activeSeasonalItems } from '@/lib/shop';

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

    let { data: equippedRow, error: eqErr } = await sb
      .from('kid_equipped')
      .select('avatar_key, accessory_head_key, accessory_face_key, accessory_neck_key, sticker_key, theme_key, wing_key, pet_key')
      .eq('kid_id', kidId)
      .maybeSingle();
    if (eqErr) {
      // accessory_head_key 등 새 슬롯 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니,
      // 그때는 예전 컬럼들만으로 재시도(새 슬롯은 전부 비어있는 것으로 처리됨).
      const fallback = await sb
        .from('kid_equipped')
        .select('avatar_key, accessory_key, sticker_key, theme_key')
        .eq('kid_id', kidId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      equippedRow = fallback.data;
      eqErr = null;
    }

    const categories = Object.fromEntries(
      Object.entries(SHOP_CATEGORIES).map(([cat, items]) => {
        // 시즌 코스튬은 머리 액세서리 탭에 기간 안일 때만 같이 노출(평소엔 안 보임).
        const list = cat === 'accessory_head' ? [...items, ...activeSeasonalItems()] : items;
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

    // 착용 가능한 카테고리마다 kid_equipped의 `${category}_key` 컬럼을 그대로 꺼내서 돌려줌
    // (카테고리를 새로 추가해도 여기 손댈 필요 없게 일반화함, 2026-10).
    const equipped = Object.fromEntries(
      EQUIPPABLE_CATEGORIES.map((cat) => [cat, equippedRow?.[`${cat}_key`] || null])
    );

    return NextResponse.json({ ok: true, categories, equipped });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
