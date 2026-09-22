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
      sb.from('kid_equipped').select('kid_id, avatar_key, accessory_key, sticker_key'),
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
    const { data, error } = await sb
      .from('kids')
      .select('id, name, pin, total_earned, invest_realized_profit, total_donated')
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
        nameGlow: specials.has('name_glow'),
        rainbowName: specials.has('rainbow_name'),
        neonName: specials.has('neon_name'),
        shakeName: specials.has('shake_name'),
        avatarRing: specials.has('avatar_ring'),
        avatarRingRainbow: specials.has('avatar_ring_rainbow'),
        avatarRingFire: specials.has('avatar_ring_fire'),
        starTrail: specials.has('star_trail'),
        vipBadge: specials.has('vip_badge'),
      };
    });
    return NextResponse.json({ ok: true, kids });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
