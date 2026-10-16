import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { calcLevel } from '@/lib/level';
import { getEarnedBadges, getNextBadge } from '@/lib/badges';
import { getActiveTitle } from '@/lib/titles';
import { findShopItem } from '@/lib/shop';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: kid, error } = await sb.from('kids').select('*').eq('id', kidId).single();
    if (error || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { data: feeRows } = await sb.from('stock_orders').select('fee').eq('kid_id', kidId);
    const investTotalFees = (feeRows || []).reduce((s, r) => s + (r.fee || 0), 0);

    const levelInfo = calcLevel(kid.total_earned);
    const badges = getEarnedBadges(kid);
    const nextBadge = getNextBadge(kid);
    const title = getActiveTitle(kid);

    // 내 화면 상단(현재 보유 코인 카드)에 내 캐릭터를 보여주기 위한 꾸미기 정보.
    // 마이룸/친구목록과 같은 방식(아바타+머리/얼굴/목+날개+펫+테두리+움직임 효과)으로
    // 맞춰서 AvatarBadge 하나로 통일되게 보이도록 함(2026-10, "내 화면에서도 내가 꾸민
    // 모습을 보고 싶다"는 요청으로 추가).
    let themeItem = null;
    let customization = {};
    try {
      let { data: equippedRow, error: eqErr } = await sb
        .from('kid_equipped')
        .select(
          'theme_key, avatar_key, accessory_head_key, accessory_face_key, accessory_neck_key, wing_key, pet_key'
        )
        .eq('kid_id', kidId)
        .maybeSingle();
      if (eqErr) {
        // 새 슬롯 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 예전 컬럼들로 재시도.
        const fallback = await sb.from('kid_equipped').select('theme_key, avatar_key').eq('kid_id', kidId).maybeSingle();
        equippedRow = fallback.data;
      }
      themeItem = findShopItem('theme', equippedRow?.theme_key);

      const nowIso = new Date().toISOString();
      const { data: specialRows } = await sb
        .from('kid_inventory')
        .select('item_key')
        .eq('kid_id', kidId)
        .eq('category', 'special')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
      const specials = new Set((specialRows || []).map((r) => r.item_key));

      customization = {
        avatarEmoji: findShopItem('avatar', equippedRow?.avatar_key)?.emoji || null,
        accessoryHeadEmoji: findShopItem('accessory_head', equippedRow?.accessory_head_key)?.emoji || null,
        accessoryFaceEmoji: findShopItem('accessory_face', equippedRow?.accessory_face_key)?.emoji || null,
        accessoryNeckEmoji: findShopItem('accessory_neck', equippedRow?.accessory_neck_key)?.emoji || null,
        wingEmoji: findShopItem('wing', equippedRow?.wing_key)?.emoji || null,
        petEmoji: findShopItem('pet', equippedRow?.pet_key)?.emoji || null,
        // 같은 효과의 30일/2주 버전 중 하나라도 유효하면 효과가 보이게 함.
        avatarRing: specials.has('avatar_ring') || specials.has('avatar_ring_2w'),
        avatarRingRainbow: specials.has('avatar_ring_rainbow') || specials.has('avatar_ring_rainbow_2w'),
        avatarRingFire: specials.has('avatar_ring_fire') || specials.has('avatar_ring_fire_2w'),
        avatarRingDiamond: specials.has('avatar_ring_diamond') || specials.has('avatar_ring_diamond_2w'),
        starTrail: specials.has('star_trail') || specials.has('star_trail_2w'),
        avatarBounce: specials.has('avatar_bounce'),
        avatarSpin: specials.has('avatar_spin'),
        avatarPulse: specials.has('avatar_pulse'),
        avatarWiggle: specials.has('avatar_wiggle'),
        avatarShimmer: specials.has('avatar_shimmer'),
      };
    } catch (e) {
      themeItem = null;
    }

    return NextResponse.json({
      ok: true,
      kid: {
        id: kid.id,
        name: kid.name,
        balance: kid.balance,
        totalEarned: kid.total_earned,
        totalSpent: kid.total_spent,
        attendanceCount: kid.attendance_count,
        purchaseCount: kid.purchase_count,
        investAgreedAt: kid.invest_agreed_at,
        investRealizedProfit: kid.invest_realized_profit || 0,
        investTradeCount: kid.invest_trade_count || 0,
        investTotalFees,
        ...customization,
      },
      level: levelInfo,
      badges,
      nextBadge,
      title,
      theme: themeItem,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
