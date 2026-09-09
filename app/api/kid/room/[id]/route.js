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

    const { data: equippedRow } = await sb
      .from('kid_equipped')
      .select('avatar_key, accessory_key, sticker_key, theme_key')
      .eq('kid_id', kid.id)
      .maybeSingle();

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
      accessoryEmoji: findShopItem('accessory', equippedRow?.accessory_key)?.emoji || null,
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
