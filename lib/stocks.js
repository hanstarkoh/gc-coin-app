const MAX_DAILY_CHANGE = 0.08; // ±8%
export const TRADE_FEE_RATE = 0.02; // 매수/매도 수수료 2%

export function calcFee(amount) {
  return Math.round(amount * TRADE_FEE_RATE);
}

export function randomizePrice(price) {
  const pct = (Math.random() * 2 - 1) * MAX_DAILY_CHANGE;
  const next = Math.round(price * (1 + pct));
  return Math.max(1, next);
}

// 활성 종목의 시세를 갱신합니다.
// force=false: 오늘 이미 갱신된(=오늘자 이력이 있는) 종목은 건너뜁니다. (cron 중복 실행 방지)
// force=true: 무조건 새 시세로 갱신합니다. (관리자 수동 갱신용)
export async function updateStockPrices(sb, { force = false } = {}) {
  const { data: stocks, error: stocksErr } = await sb
    .from('stocks')
    .select('id, price')
    .eq('is_active', true);
  if (stocksErr) throw stocksErr;

  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;

  for (const stock of stocks) {
    if (!force) {
      const { data: todayHistory, error: histErr } = await sb
        .from('stock_price_history')
        .select('id')
        .eq('stock_id', stock.id)
        .gte('recorded_at', `${today}T00:00:00Z`)
        .limit(1);
      if (histErr) throw histErr;
      if (todayHistory.length > 0) continue;
    }

    const nextPrice = randomizePrice(stock.price);
    const { error: updErr } = await sb.from('stocks').update({ price: nextPrice }).eq('id', stock.id);
    if (updErr) throw updErr;

    const { error: histInsErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: nextPrice });
    if (histInsErr) throw histInsErr;

    updated++;
  }

  return { updated, total: stocks.length };
}
