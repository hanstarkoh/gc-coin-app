import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';

export async function POST(req) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { itemId, quantity } = await req.json();
    const qty = Number(quantity) || 1;
    if (!itemId || !Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json({ ok: false, error: '잘못된 요청이에요.' }, { status: 400 });
    }

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
    if (item.stock !== null && item.stock < qty) {
      return NextResponse.json({ ok: false, error: '재고보다 많이 주문할 수 없어요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, total_spent, purchase_count')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const total = item.price * qty;
    if (kid.balance < total) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요.' }, { status: 400 });
    }

    const newBalance = kid.balance - total;
    // balance가 읽은 값 그대로일 때만 갱신해서, 두 요청이 거의 동시에 들어와도(더블탭 등)
    // 하나만 성공하게 함 — 안 그러면 코인은 두 번 깎이는데 주문은 한 번만 들어가요.
    const { data: updRows, error: updErr } = await sb
      .from('kids')
      .update({
        balance: newBalance,
        total_spent: kid.total_spent + total,
        purchase_count: kid.purchase_count + 1,
      })
      .eq('id', kidId)
      .eq('balance', kid.balance)
      .select('id');
    if (updErr) throw updErr;
    if (!updRows || updRows.length === 0) {
      return NextResponse.json({ ok: false, error: '잠시 후 다시 시도해주세요.' }, { status: 409 });
    }

    if (item.stock !== null) {
      // stock도 같은 이유로 "읽은 값 그대로일 때만" 깎음 — 서로 다른 두 청소년이 마지막
      // 1개를 동시에 주문하면 재고가 음수로 내려가거나 둘 다 받은 셈 치는 걸 막기 위함.
      // 재고 경쟁에서 지면 이미 뺀 코인을 그대로 되돌려줍니다(결제는 재고 확정 이후에만 완료).
      const { data: stockRows, error: stockErr } = await sb
        .from('menu_items')
        .update({ stock: item.stock - qty })
        .eq('id', item.id)
        .eq('stock', item.stock)
        .select('id');
      if (stockErr) throw stockErr;
      if (!stockRows || stockRows.length === 0) {
        await sb
          .from('kids')
          .update({ balance: kid.balance, total_spent: kid.total_spent, purchase_count: kid.purchase_count })
          .eq('id', kidId);
        return NextResponse.json({ ok: false, error: '방금 품절됐어요. 다시 확인해주세요.' }, { status: 409 });
      }
    }

    const { error: txErr } = await sb.from('transactions').insert({
      kid_id: kidId,
      kid_name: kid.name,
      type: 'spend',
      amount: total,
      quantity: qty,
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
