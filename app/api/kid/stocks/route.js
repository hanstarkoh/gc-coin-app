import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { maybeUpdateStockPrices, getLiveSentiments, momentumFromHistory, buyFeeRate } from '@/lib/stocks';

const HISTORY_POINTS = 14;

export async function GET() {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const sb = supabaseAdmin();
    await maybeUpdateStockPrices(sb);
    const { data: stocks, error: stocksErr } = await sb
      .from('stocks')
      .select('id, name, emoji, price')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (stocksErr) throw stocksErr;

    const { data: holdings, error: holdingsErr } = await sb
      .from('stock_holdings')
      .select('stock_id, shares, avg_price')
      .eq('kid_id', kidId);
    if (holdingsErr) throw holdingsErr;
    const holdingsMap = new Map(holdings.map((h) => [h.stock_id, h]));
    const sentiments = await getLiveSentiments(sb, stocks.map((s) => s.id));

    const items = await Promise.all(
      stocks.map(async (s) => {
        const { data: history, error: histErr } = await sb
          .from('stock_price_history')
          .select('price, recorded_at')
          .eq('stock_id', s.id)
          .order('recorded_at', { ascending: false })
          .limit(HISTORY_POINTS);
        if (histErr) throw histErr;
        const prices = history.map((h) => h.price).reverse();
        const prevClose = prices.length > 1 ? prices[prices.length - 2] : s.price;
        const holding = holdingsMap.get(s.id);
        const myShares = holding?.shares || 0;
        const avgPrice = holding?.avg_price || 0;
        return {
          ...s,
          history: prices,
          changePct: prevClose ? Math.round(((s.price - prevClose) / prevClose) * 1000) / 10 : 0,
          myShares,
          avgPrice,
          plPct: avgPrice > 0 ? Math.round(((s.price - avgPrice) / avgPrice) * 1000) / 10 : 0,
          plAmount: avgPrice > 0 ? (s.price - avgPrice) * myShares : 0,
          sentiment: sentiments[s.id] || null,
          buyFeeRate: buyFeeRate(momentumFromHistory(prices)),
        };
      })
    );

    return NextResponse.json({ ok: true, stocks: items });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
