import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { getActiveTitle } from '@/lib/titles';
import { calcLevel } from '@/lib/level';
import { findShopItem } from '@/lib/shop';
import { roomDims } from '@/lib/room';
import { getEarnedBadges } from '@/lib/badges';

export async function GET(_req, { params }) {
  const viewerId = getKidId();
  if (!viewerId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select(
        'id, name, balance, total_earned, invest_realized_profit, room_balance_public, room_expansions, attendance_count, purchase_count, invest_trade_count'
      )
      .eq('id', params.id)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생을 찾을 수 없어요.' }, { status: 404 });

    let { data: equippedRow, error: eqErr } = await sb
      .from('kid_equipped')
      .select('avatar_key, accessory_head_key, accessory_face_key, accessory_neck_key, sticker_key, theme_key, wing_key, pet_key')
      .eq('kid_id', kid.id)
      .maybeSingle();
    if (eqErr) {
      // 새 슬롯 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 예전 컬럼들로 재시도.
      const fallback = await sb
        .from('kid_equipped')
        .select('avatar_key, sticker_key, theme_key')
        .eq('kid_id', kid.id)
        .maybeSingle();
      equippedRow = fallback.data;
    }

    const { data: placements, error: placeErr } = await sb
      .from('kid_room_items')
      .select('item_key, grid_x, grid_y')
      .eq('kid_id', kid.id);
    if (placeErr) throw placeErr;

    const items = placements
      .map((p) => {
        const item = findShopItem('furniture', p.item_key);
        if (!item) return null;
        return { ...item, x: p.grid_x, y: p.grid_y };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      name: kid.name,
      title: getActiveTitle(kid),
      level: calcLevel(kid.total_earned).level,
      avatarEmoji: findShopItem('avatar', equippedRow?.avatar_key)?.emoji || null,
      accessoryEmoji: findShopItem('accessory_head', equippedRow?.accessory_head_key)?.emoji || null,
      accessoryHeadEmoji: findShopItem('accessory_head', equippedRow?.accessory_head_key)?.emoji || null,
      accessoryFaceEmoji: findShopItem('accessory_face', equippedRow?.accessory_face_key)?.emoji || null,
      accessoryNeckEmoji: findShopItem('accessory_neck', equippedRow?.accessory_neck_key)?.emoji || null,
      wingEmoji: findShopItem('wing', equippedRow?.wing_key)?.emoji || null,
      petEmoji: findShopItem('pet', equippedRow?.pet_key)?.emoji || null,
      stickerEmoji: findShopItem('sticker', equippedRow?.sticker_key)?.emoji || null,
      balance: kid.room_balance_public ? kid.balance : null,
      balancePublic: kid.room_balance_public,
      theme: findShopItem('theme', equippedRow?.theme_key),
      badges: getEarnedBadges(kid),
      ...roomDims(kid.room_expansions),
      items,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
