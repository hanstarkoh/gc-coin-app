import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getKidId } from '@/lib/session';
import {
  calcFee,
  buyFeeRate,
  momentumFromHistory,
  MOMENTUM_LOOKBACK,
  movingAverage,
  valuationStatus,
  MEAN_REVERSION_WINDOW,
} from '@/lib/stocks';

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
      .select('id, name, price, is_active')
      .eq('id', params.id)
      .single();
    if (stockErr || !stock || !stock.is_active) {
      return NextResponse.json({ ok: false, error: '거래할 수 없는 종목이에요.' }, { status: 400 });
    }

    const { data: kid, error: kidErr } = await sb
      .from('kids')
      .select('id, name, balance, invest_trade_count')
      .eq('id', kidId)
      .single();
    if (kidErr || !kid) return NextResponse.json({ ok: false, error: '학생 정보를 찾을 수 없어요.' }, { status: 404 });

    const { data: recentHistory, error: histErr } = await sb
      .from('stock_price_history')
      .select('price')
      .eq('stock_id', stock.id)
      .order('recorded_at', { ascending: false })
      .limit(Math.max(MOMENTUM_LOOKBACK + 1, MEAN_REVERSION_WINDOW));
    if (histErr) throw histErr;
    const prices = (recentHistory || []).map((h) => h.price).reverse();
    const momentum = momentumFromHistory(prices);
    const valuation = valuationStatus(stock.price, movingAverage(prices));

    const amount = stock.price * qty;
    const fee = calcFee(amount, buyFeeRate(momentum));
    const totalDebit = amount + fee;
    if (kid.balance < totalDebit) {
      return NextResponse.json({ ok: false, error: '코인이 부족해요. (수수료 포함)' }, { status: 400 });
    }

    const { error: updErr } = await sb
      .from('kids')
      .update({ balance: kid.balance - totalDebit, invest_trade_count: (kid.invest_trade_count || 0) + 1 })
      .eq('id', kid.id);
    if (updErr) throw updErr;

    const { data: holding, error: holdingErr } = await sb
      .from('stock_holdings')
      .select('id, shares, avg_price')
      .eq('kid_id', kid.id)
      .eq('stock_id', stock.id)
      .maybeSingle();
    if (holdingErr) throw holdingErr;

    if (holding) {
      const newShares = holding.shares + qty;
      const newAvgPrice = Math.round((holding.avg_price * holding.shares + stock.price * qty) / newShares);
      const { error: e1 } = await sb
        .from('stock_holdings')
        .update({ shares: newShares, avg_price: newAvgPrice })
        .eq('id', holding.id);
      if (e1) throw e1;
    } else {
      const { error: e2 } = await sb
        .from('stock_holdings')
        .insert({ kid_id: kid.id, stock_id: stock.id, shares: qty, avg_price: stock.price });
      if (e2) throw e2;
    }

    const orderRow = {
      kid_id: kid.id,
      kid_name: kid.name,
      stock_id: stock.id,
      stock_name: stock.name,
      type: 'buy',
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
