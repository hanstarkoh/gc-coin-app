import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import { calcFee, movingAverage, valuationStatus, MEAN_REVERSION_WINDOW } from '@/lib/stocks';

export async function POST(req, { params }) {
  const kidId = getKidId();
  if (!kidId) return NextResponse.json({ ok: false, error: '로그인이 필요해요.' }, { status: 401 });

  try {
    const { shares } = await req.json();
    const qty = Number(shares);
    if (!qty || qty <= 0 || !Number.isInteger(qty)) {
      return NextResponse.json({ ok: false, error: '주식 수를 확인해주세요.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { data: stock, error: stockErr } = await sb
      .from('stocks')
      .select('id, name, price')
      .eq('id', params.id)
      .single();
    if (stockErr || !stock) return NextResponse.json({ ok: false, error: '종목을 찾을 수 없어요.' }, { status: 404 });

    const { data: holding, error: holdingErr } = await sb
      .from('stock_holdings')
      .select('id, shares, avg_price')
      .eq('kid_id', kidId)
      .eq('stock_id', stock.id)
      .maybeSingle();
    if (holdingErr) throw holdingErr;
    if (!holding || holding.shares < qty) {
      return NextResponse.json({ ok: false, error: '보유한 주식보다 많이 팔 수 없어요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, invest_realized_profit, invest_trade_count')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { data: recentHistory, error: histErr } = await sb
      .from('stock_price_history')
      .select('price')
      .eq('stock_id', stock.id)
      .order('recorded_at', { ascending: false })
      .limit(MEAN_REVERSION_WINDOW);
    if (histErr) throw histErr;
    const valuation = valuationStatus(stock.price, movingAverage((recentHistory || []).map((h) => h.price).reverse()));

    const amount = stock.price * qty;
    const fee = calcFee(amount);
    const netCredit = amount - fee;
    const realized = (stock.price - holding.avg_price) * qty - fee;

    const { error: updErr } = await sb
      .from('kids')
      .update({
        balance: kid.balance + netCredit,
        invest_realized_profit: (kid.invest_realized_profit || 0) + realized,
        invest_trade_count: (kid.invest_trade_count || 0) + 1,
      })
      .eq('id', kid.id);
    if (updErr) throw updErr;

    const { error: holdingUpdErr } = await sb
      .from('stock_holdings')
      .update({ shares: holding.shares - qty })
      .eq('id', holding.id);
    if (holdingUpdErr) throw holdingUpdErr;

    const orderRow = {
      kid_id: kid.id,
      kid_name: kid.name,
      stock_id: stock.id,
      stock_name: stock.name,
      type: 'sell',
      shares: qty,
      price: stock.price,
      amount,
      fee,
      valuation_at_trade: valuation,
    };
    const { error: orderErr } = await sb.from('stock_orders').insert(orderRow);
    if (orderErr) {
      // valuation_at_trade 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 잔액/보유
      // 주식은 이미 반영된 뒤라 기록 자체가 안 남는 걸 막기 위해 그 컬럼 없이 재시도합니다.
      const { valuation_at_trade, ...withoutValuation } = orderRow;
      const fallback = await sb.from('stock_orders').insert(withoutValuation);
      if (fallback.error) throw fallback.error;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
