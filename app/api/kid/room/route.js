import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { findShopItem } from '@/lib/shop';
import { ROOM_COLS, ROOM_ROWS } from '@/lib/room';
import { getEarnedBadges } from '@/lib/badges';

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select(
        'room_balance_public, attendance_count, total_earned, purchase_count, invest_trade_count, invest_realized_profit'
      )
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) throw kidErr || new Error('학생 정보를 찾을 수 없어요.');

    const { data: owned, error: ownedErr } = await sb
      .from('kid_inventory')
      .select('item_key')
      .eq('kid_id', kidId)
      .eq('category', 'furniture');
    if (ownedErr) throw ownedErr;

    const { data: placements, error: placeErr } = await sb
      .from('kid_room_items')
      .select('item_key, grid_x, grid_y')
      .eq('kid_id', kidId);
    if (placeErr) throw placeErr;

    const { data: equippedRow } = await sb
      .from('kid_equipped')
      .select('theme_key')
      .eq('kid_id', kidId)
      .maybeSingle();

    const placedMap = new Map(placements.map((p) => [p.item_key, { x: p.grid_x, y: p.grid_y }]));
    const furniture = owned
      .map((o) => {
        const item = findShopItem('furniture', o.item_key);
        if (!item) return null;
        return { ...item, placed: placedMap.get(o.item_key) || null };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      cols: ROOM_COLS,
      rows: ROOM_ROWS,
      furniture,
      balancePublic: kid.room_balance_public,
      theme: findShopItem('theme', equippedRow?.theme_key),
      badges: getEarnedBadges(kid),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
