import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActiveTitle } from '@/lib/titles';
import { findShopItem } from '@/lib/shop';
import { calcLevel } from '@/lib/level';

// 상점 착용 정보(kid_equipped/kid_inventory)는 아직 마이그레이션 전일 수 있으니
// 실패해도 기본 목록 응답 자체는 막지 않도록 별도로 조회합니다.
async function loadCustomization(sb) {
  try {
    const [{ data: equippedRows, error: eqErr }, { data: glowRows, error: glowErr }] = await Promise.all([
      sb.from('kid_equipped').select('kid_id, avatar_key, accessory_key, sticker_key'),
      sb.from('kid_inventory').select('kid_id').eq('item_key', 'name_glow'),
    ]);
    if (eqErr || glowErr) throw eqErr || glowErr;
    return {
      equippedMap: new Map(equippedRows.map((e) => [e.kid_id, e])),
      glowSet: new Set(glowRows.map((r) => r.kid_id)),
    };
  } catch (e) {
    return { equippedMap: new Map(), glowSet: new Set() };
  }
}

export async function GET() {
  noStore();
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from('kids')
      .select('id, name, pin, total_earned, invest_realized_profit')
      .order('name', { ascending: true });

    if (error) {
      // invest_realized_profit 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니
      // 이름 목록만이라도 정상 표시되도록 기본 컬럼으로 한 번 더 시도합니다.
      const fallback = await sb.from('kids').select('id, name, pin, total_earned').order('name', { ascending: true });
      if (fallback.error) throw fallback.error;
      const kids = fallback.data.map((k) => ({
        id: k.id,
        name: k.name,
        hasPin: !!k.pin,
        title: null,
        level: calcLevel(k.total_earned).level,
      }));
      return NextResponse.json({ ok: true, kids });
    }

    const { equippedMap, glowSet } = await loadCustomization(sb);

    const kids = data.map((k) => {
      const eq = equippedMap.get(k.id);
      const avatarItem = eq ? findShopItem('avatar', eq.avatar_key) : null;
      const accessoryItem = eq ? findShopItem('accessory', eq.accessory_key) : null;
      const stickerItem = eq ? findShopItem('sticker', eq.sticker_key) : null;
      return {
        id: k.id,
        name: k.name,
        hasPin: !!k.pin,
        title: getActiveTitle(k),
        level: calcLevel(k.total_earned).level,
        avatarEmoji: avatarItem?.emoji || null,
        accessoryEmoji: accessoryItem?.emoji || null,
        stickerEmoji: stickerItem?.emoji || null,
        nameGlow: glowSet.has(k.id),
      };
    });
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
