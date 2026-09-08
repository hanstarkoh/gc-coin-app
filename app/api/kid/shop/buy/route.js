import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { findShopItem } from '@/lib/shop';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { category, key } = await req.json();
    const item = findShopItem(category, key);
    if (!item) return NextResponse.json({ ok: false, error: '존재하지 않는 아이템이에요.' }, { status: 400 });

    const sb = supabaseAdmin();
    const { data: existing, error: existingErr } = await sb
      .from('kid_inventory')
      .select('id')
      .eq('kid_id', kidId)
      .eq('item_key', key)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing) return NextResponse.json({ ok: false, error: '이미 보유하고 있어요.' }, { status: 400 });

    const { data: kid, error: kidErr } = await sb.from('kids').select('id, balance').eq('id', kidId).single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });
    if (kid.balance < item.price) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const { error: updErr } = await sb.from('kids').update({ balance: kid.balance - item.price }).eq('id', kidId);
    if (updErr) throw updErr;

    const { error: invErr } = await sb.from('kid_inventory').insert({ kid_id: kidId, category, item_key: key });
    if (invErr) throw invErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
