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
    const nowIso = new Date().toISOString();
    const [{ data: equippedRows, error: eqErr }, { data: specialRows, error: specErr }] = await Promise.all([
      sb.from('kid_equipped').select('kid_id, avatar_key, accessory_key, sticker_key, theme_key'),
      sb
        .from('kid_inventory')
        .select('kid_id, item_key')
        .eq('category', 'special')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);
    if (eqErr || specErr) throw eqErr || specErr;

    const specialMap = new Map();
    for (const r of specialRows) {
      if (!specialMap.has(r.kid_id)) specialMap.set(r.kid_id, new Set());
      specialMap.get(r.kid_id).add(r.item_key);
    }
    return {
      equippedMap: new Map(equippedRows.map((e) => [e.kid_id, e])),
      specialMap,
    };
  } catch (e) {
    return { equippedMap: new Map(), specialMap: new Map() };
  }
}

export async function GET() {
  noStore();
  try {
    const sb = supabaseAdmin();
    const { data: rawData, error } = await sb
      .from('kids')
      .select('id, name, pin, total_earned, invest_realized_profit, total_donated, is_test')
      .order('name', { ascending: true });
    // 테스트 계정은 실제 청소년이 보는 이름 선택 화면에 안 보이게 함.
    const data = rawData ? rawData.filter((k) => !k.is_test) : rawData;

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

    const { equippedMap, specialMap } = await loadCustomization(sb);

    // 기부/투자 1등은 살 수 없는 "지금 1등"인 랭킹 칭호라, 살 수 있는 상점 칭호보다
    // 우선해서 보여줍니다. 1등이 바뀌면 자동으로 다른 아이에게 넘어가요.
    const donationMax = Math.max(0, ...data.map((k) => k.total_donated || 0));
    const investMax = Math.max(0, ...data.map((k) => k.invest_realized_profit || 0));

    const kids = data.map((k) => {
      const eq = equippedMap.get(k.id);
      const avatarItem = eq ? findShopItem('avatar', eq.avatar_key) : null;
      const accessoryItem = eq ? findShopItem('accessory', eq.accessory_key) : null;
      const stickerItem = eq ? findShopItem('sticker', eq.sticker_key) : null;
      const themeItem = eq ? findShopItem('theme', eq.theme_key) : null;
      const specials = specialMap.get(k.id) || new Set();

      const isDonationKing = donationMax > 0 && (k.total_donated || 0) === donationMax;
      const isInvestKing = investMax > 0 && (k.invest_realized_profit || 0) === investMax;
      let title = getActiveTitle(k);
      if (isInvestKing) title = { icon: '💰', name: '투자왕' };
      if (isDonationKing) title = { icon: '💝', name: '기부왕' };

      return {
        id: k.id,
        name: k.name,
        hasPin: !!k.pin,
        title,
        isDonationKing,
        isInvestKing,
        level: calcLevel(k.total_earned).level,
        avatarEmoji: avatarItem?.emoji || null,
        accessoryEmoji: accessoryItem?.emoji || null,
        stickerEmoji: stickerItem?.emoji || null,
        theme: themeItem ? { from: themeItem.from, mid: themeItem.mid, to: themeItem.to } : null,
        // 같은 효과의 30일/2주 버전 중 하나라도 유효하면 효과가 보이게 함.
        nameGlow: specials.has('name_glow') || specials.has('name_glow_2w'),
        rainbowName: specials.has('rainbow_name') || specials.has('rainbow_name_2w'),
        neonName: specials.has('neon_name') || specials.has('neon_name_2w'),
        shakeName: specials.has('shake_name') || specials.has('shake_name_2w'),
        avatarRing: specials.has('avatar_ring') || specials.has('avatar_ring_2w'),
        avatarRingRainbow: specials.has('avatar_ring_rainbow') || specials.has('avatar_ring_rainbow_2w'),
        avatarRingFire: specials.has('avatar_ring_fire') || specials.has('avatar_ring_fire_2w'),
        starTrail: specials.has('star_trail') || specials.has('star_trail_2w'),
        vipBadge: specials.has('vip_badge') || specials.has('vip_badge_2w'),
        avatarBounce: specials.has('avatar_bounce'),
        avatarSpin: specials.has('avatar_spin'),
        avatarPulse: specials.has('avatar_pulse'),
        avatarWiggle: specials.has('avatar_wiggle'),
        avatarShimmer: specials.has('avatar_shimmer'),
      };
    });
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
