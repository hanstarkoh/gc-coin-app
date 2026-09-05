import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { itemId } = await req.json();
    if (!itemId) return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });

    const sb = supabaseAdmin();
    const today = new Date().toISOString().slice(0, 10);

    const { data: item, error: itemErr } = await sb
      .from('menu_items')
      .select('id, name, price, item_date')
      .eq('id', itemId)
      .single();
    if (itemErr || !item || item.item_date !== today) {
      return NextResponse.json({ ok: false, error: '오늘 판매하는 메뉴가 아니에요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_spent, purchase_count')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    if (kid.balance < item.price) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const newBalance = kid.balance - item.price;
    const { error: updErr } = await sb
      .from('kids')
      .update({
        balance: newBalance,
        total_spent: kid.total_spent + item.price,
        purchase_count: kid.purchase_count + 1,
      })
      .eq('id', kidId);
    if (updErr) throw updErr;

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: item.price,
      reason: item.name,
      tx_date: today,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, newBalance, item });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
