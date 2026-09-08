import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { isValidCell } from '@/lib/room';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { itemKey, x, y } = await req.json();
    if (!itemKey || !isValidCell(x, y)) {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const { data: owned, error: ownedErr } = await sb
      .from('kid_inventory')
      .select('id')
      .eq('kid_id', kidId)
      .eq('item_key', itemKey)
      .maybeSingle();
    if (ownedErr) throw ownedErr;
    if (!owned) return NextResponse.json({ ok: false, error: '보유하지 않은 가구예요.' }, { status: 400 });

    const { data: occupied, error: occErr } = await sb
      .from('kid_room_items')
      .select('item_key')
      .eq('kid_id', kidId)
      .eq('grid_x', x)
      .eq('grid_y', y)
      .maybeSingle();
    if (occErr) throw occErr;
    if (occupied && occupied.item_key !== itemKey) {
      return NextResponse.json({ ok: false, error: '이미 다른 가구가 놓여 있어요.' }, { status: 400 });
    }

    // 같은 아이템을 다른 칸으로 옮기는 경우를 위해 기존 배치를 먼저 지웁니다.
    const { error: delErr } = await sb.from('kid_room_items').delete().eq('kid_id', kidId).eq('item_key', itemKey);
    if (delErr) throw delErr;

    const { error: insErr } = await sb
      .from('kid_room_items')
      .insert({ kid_id: kidId, item_key: itemKey, grid_x: x, grid_y: y });
    if (insErr) throw insErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
