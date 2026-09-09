// 청소년 한 명의 코인 입출 내역을 한 곳에 모아서 보여주기 위한 헬퍼.
// transactions(출석/보너스/간식주문/기부)뿐 아니라 stock_orders(주식 매수/매도),
// kid_inventory(상점 구매)도 같은 모양으로 합쳐서 시간순으로 정렬해 반환합니다.
// 잔액에는 이미 각 라우트에서 반영돼 있으므로, 여기서는 "보여주기용" 조회만 합니다.

import { findShopItem } from './shop';

export async function loadKidHistory(sb, kidId, limit = 500) {
  const [{ data: tx, error: txErr }, { data: stockOrders, error: stockErr }, { data: inv, error: invErr }] =
    await Promise.all([
      sb
        .from('transactions')
        .select('id, type, amount, reason, tx_date, created_at, quantity, fulfilled, ready_at, pickup_location')
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false })
        .limit(limit),
      sb
        .from('stock_orders')
        .select('id, type, shares, price, amount, fee, stock_name, created_at')
        .eq('kid_id', kidId)
        .order('created_at', { ascending: false })
        .limit(limit),
      sb
        .from('kid_inventory')
        .select('id, category, item_key, purchased_at')
        .eq('kid_id', kidId)
        .order('purchased_at', { ascending: false })
        .limit(limit),
    ]);
  if (txErr) throw txErr;

  const txEntries = (tx || []).map((t) => ({ ...t, source: 'transaction' }));

  const stockEntries = (stockErr ? [] : stockOrders || []).map((s) => {
    const fee = s.fee || 0;
    const net = s.type === 'buy' ? s.amount + fee : s.amount - fee;
    return {
      id: `stock-${s.id}`,
      type: s.type === 'buy' ? 'spend' : 'earn',
      amount: net,
      reason: `📈 ${s.stock_name} ${s.shares}주 ${s.type === 'buy' ? '매수' : '매도'}${fee ? ` (수수료 ${fee}GC)` : ''}`,
      tx_date: (s.created_at || '').slice(0, 10),
      created_at: s.created_at,
      quantity: null,
      fulfilled: true,
      ready_at: null,
      pickup_location: null,
      source: 'stock',
    };
  });

  const invEntries = (invErr ? [] : inv || []).map((i) => {
    const item = findShopItem(i.category, i.item_key);
    return {
      id: `inv-${i.id}`,
      type: 'spend',
      amount: item?.price ?? 0,
      reason: `🛍️ ${item?.name || i.item_key} 구매`,
      tx_date: (i.purchased_at || '').slice(0, 10),
      created_at: i.purchased_at,
      quantity: null,
      fulfilled: true,
      ready_at: null,
      pickup_location: null,
      source: 'shop',
    };
  });

  return [...txEntries, ...stockEntries, ...invEntries]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit);
}
