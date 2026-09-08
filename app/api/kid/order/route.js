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

    const { data: settings, error: settingsErr } = await sb.from('settings').select('orders_open').eq('id', 1).single();
    if (settingsErr) throw settingsErr;
    if (!settings.orders_open) {
      return NextResponse.json({ ok: false, error: '지금은 주문을 받지 않고 있어요.' }, { status: 400 });
    }

    const { data: item, error: itemErr } = await sb
      .from('menu_items')
      .select('id, name, price, stock')
      .eq('id', itemId)
      .single();
    if (itemErr || !item) {
      return NextResponse.json({ ok: false, error: '판매하지 않는 메뉴예요.' }, { status: 400 });
    }
    if (item.stock !== null && item.stock <= 0) {
      return NextResponse.json({ ok: false, error: '품절된 메뉴예요.' }, { status: 400 });
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

    if (item.stock !== null) {
      const { error: stockErr } = await sb.from('menu_items').update({ stock: item.stock - 1 }).eq('id', item.id);
      if (stockErr) throw stockErr;
    }

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: item.price,
      reason: item.name,
      tx_date: today,
      fulfilled: false,
    });
    if (txErr) throw txErr;

    return NextResponse.json({ ok: true, newBalance, item });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
