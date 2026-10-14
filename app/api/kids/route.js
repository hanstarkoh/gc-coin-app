import { NextResponse } from 'next/server';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getActiveTitle } from '@/lib/titles';
import { findShopItem } from '@/lib/shop';
import { calcLevel } from '@/lib/level';
import { isAdmin } from '@/lib/session';

// 상점 착용 정보(kid_equipped/kid_inventory)는 아직 마이그레이션 전일 수 있으니
// 실패해도 기본 목록 응답 자체는 막지 않도록 별도로 조회합니다.
async function loadCustomization(sb) {
  try {
    const nowIso = new Date().toISOString();
    let [{ data: equippedRows, error: eqErr }, { data: specialRows, error: specErr }] = await Promise.all([
      sb
        .from('kid_equipped')
        .select('kid_id, avatar_key, accessory_head_key, accessory_face_key, accessory_neck_key, sticker_key, theme_key, wing_key, pet_key'),
      sb
        .from('kid_inventory')
        .select('kid_id, item_key')
        .eq('category', 'special')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);
    if (eqErr) {
      // 머리/얼굴/목·날개·펫 슬롯 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니,
      // 그때는 예전 컬럼들만으로 재시도(새 슬롯은 전부 비어있는 것으로 처리됨).
      const fallback = await sb.from('kid_equipped').select('kid_id, avatar_key, sticker_key, theme_key');
      if (fallback.error) throw fallback.error;
      equippedRows = fallback.data;
      eqErr = null;
    }
    if (specErr) throw specErr;

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

export async function GET(req) {
  noStore();
  try {
    // 관리자가 ?preview=1로 보면 테스트 계정도 같이 보여줌(상점에서 산 효과가 이름 선택
    // 화면에 실제로 어떻게 보이는지 확인할 방법이 없었어서). 일반 청소년은 admin 쿠키가
    // 없어서 이 파라미터를 붙여도 테스트 계정이 안 보임.
    const { searchParams } = new URL(req.url);
    const showTest = searchParams.get('preview') === '1' && isAdmin();

    const sb = supabaseAdmin();
    const { data: rawData, error } = await sb
      .from('kids')
      .select('id, name, pin, total_earned, invest_realized_profit, total_donated, is_test')
      .order('name', { ascending: true });
    // 테스트 계정은 실제 청소년이 보는 이름 선택 화면에 안 보이게 함(관리자 미리보기 때는 보여줌).
    const data = rawData ? (showTest ? rawData : rawData.filter((k) => !k.is_test)) : rawData;

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
      const accessoryHeadItem = eq ? findShopItem('accessory_head', eq.accessory_head_key) : null;
      const accessoryFaceItem = eq ? findShopItem('accessory_face', eq.accessory_face_key) : null;
      const accessoryNeckItem = eq ? findShopItem('accessory_neck', eq.accessory_neck_key) : null;
      const stickerItem = eq ? findShopItem('sticker', eq.sticker_key) : null;
      const themeItem = eq ? findShopItem('theme', eq.theme_key) : null;
      const wingItem = eq ? findShopItem('wing', eq.wing_key) : null;
      const petItem = eq ? findShopItem('pet', eq.pet_key) : null;
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
        isTest: !!k.is_test,
        title,
        isDonationKing,
        isInvestKing,
        level: calcLevel(k.total_earned).level,
        avatarEmoji: avatarItem?.emoji || null,
        // 머리/얼굴/목 3슬롯 동시 착용(2026-10) — 예전 accessoryEmoji는 하위호환용으로
        // 머리 슬롯을 그대로 내려줌(헤더/목록 등 아직 안 고친 곳이 있어도 안 깨지게).
        accessoryEmoji: accessoryHeadItem?.emoji || null,
        accessoryHeadEmoji: accessoryHeadItem?.emoji || null,
        accessoryFaceEmoji: accessoryFaceItem?.emoji || null,
        accessoryNeckEmoji: accessoryNeckItem?.emoji || null,
        wingEmoji: wingItem?.emoji || null,
        petEmoji: petItem?.emoji || null,
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
        avatarRingDiamond: specials.has('avatar_ring_diamond') || specials.has('avatar_ring_diamond_2w'),
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
