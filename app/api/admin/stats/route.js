import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdmin } from '@/lib/session';
import { findShopItem } from '@/lib/shop';
import { TRADE_FEE_RATE, calcFee } from '@/lib/stocks';

// transactions.reason에 카테고리별로 이모지 접두사를 붙여온 기존 관례를 이용해서
// (🏦=예금, 🏠=마이룸 확장, 🎲=예측 시장) 어떤 소비인지 나눕니다.
function categorizeTx(t) {
  if (t.type === 'earn' && t.reason === '출석') return 'attendance';
  if (t.type === 'bonus') return 'bonus';
  if (t.type === 'event') return 'event';
  if (t.reason && t.reason.startsWith('🏦')) return 'deposit';
  if (t.reason && t.reason.startsWith('🏠')) return 'room_expand';
  if (t.reason && t.reason.startsWith('🎲')) return 'prediction';
  if (t.type === 'spend') return 'snack';
  return 'other';
}

function median(nums) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function distinctKidIds(rows) {
  return new Set(rows.map((r) => r.kid_id));
}

// from/to가 있으면 그 기간(created_at 기준)으로만 좁힙니다. 잔액/실현손익처럼
// kids 테이블에 누적으로만 저장된 값은 기간 필터링이 안 되고 항상 "현재 누적 기준"입니다.
function applyPeriod(query, column, from, to) {
  let q = query;
  if (from) q = q.gte(column, from);
  if (to) q = q.lt(column, to);
  return q;
}

export async function GET(req) {
  if (!isAdmin()) return NextResponse.json({ ok: false, error: '관리자 로그인이 필요해요.' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const kidId = searchParams.get('kidId');
    const scope = searchParams.get('scope') || 'all';
    const from = searchParams.get('from') || null;
    const to = searchParams.get('to') || null;

    const sb = supabaseAdmin();
    const { data: allKids, error: kidsErr } = await sb
      .from('kids')
      .select('id, name, gender, balance, invest_realized_profit, invest_trade_count, total_donated')
      .order('name', { ascending: true });
    if (kidsErr) throw kidsErr;

    let scopeKids;
    if (kidId) {
      scopeKids = allKids.filter((k) => k.id === kidId);
    } else if (scope === 'male' || scope === 'female') {
      scopeKids = allKids.filter((k) => k.gender === scope);
    } else {
      scopeKids = allKids;
    }
    const scopeIds = scopeKids.map((k) => k.id);
    const kidCount = scopeKids.length;

    if (kidCount === 0) {
      return NextResponse.json({ ok: true, kidCount: 0 });
    }

    const [
      { data: txs, error: txErr },
      { data: stockOrders, error: soErr },
      { data: deposits, error: depErr },
      { data: bets, error: betErr },
      { data: donations, error: donErr },
      { data: announcements, error: annErr },
      { data: inventory, error: invErr },
    ] = await Promise.all([
      applyPeriod(
        sb.from('transactions').select('kid_id, type, amount, reason, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('stock_orders').select('kid_id, type, amount, fee, valuation_at_trade, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('kid_deposits').select('kid_id, principal, term_days, claimed, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('prediction_bets').select('kid_id, amount, payout, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('group_goal_donations').select('kid_id, amount, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('announcements').select('kid_id, created_at').in('kid_id', scopeIds),
        'created_at',
        from,
        to
      ),
      applyPeriod(
        sb.from('kid_inventory').select('kid_id, category, item_key, purchased_at').in('kid_id', scopeIds),
        'purchased_at',
        from,
        to
      ),
    ]);
    if (txErr) throw txErr;
    if (soErr) throw soErr;
    if (depErr) throw depErr;
    if (betErr) throw betErr;
    if (donErr) throw donErr;
    if (annErr) throw annErr;
    if (invErr) throw invErr;

    const snackTx = txs.filter((t) => categorizeTx(t) === 'snack');
    const shopRows = inventory
      .map((i) => ({ ...i, item: findShopItem(i.category, i.item_key) }))
      .filter((i) => i.item);
    const buyOrders = stockOrders.filter((o) => o.type === 'buy');
    const sellOrders = stockOrders.filter((o) => o.type === 'sell');
    // calcFee의 "최소 1GC" 바닥 처리 때문에 소액 거래는 기본 수수료여도 반올림값보다 커서
    // 전부 추격매수로 오분류되던 문제가 있었음 — calcFee로 기준선을 다시 계산해서 비교.
    const chaseBuys = buyOrders.filter((o) => o.fee > calcFee(o.amount, TRADE_FEE_RATE));
    const overBuys = buyOrders.filter((o) => o.valuation_at_trade === 'over');
    const underBuys = buyOrders.filter((o) => o.valuation_at_trade === 'under');
    const underSells = sellOrders.filter((o) => o.valuation_at_trade === 'under');

    const spendBreakdown = {
      snack: snackTx.reduce((s, t) => s + t.amount, 0),
      shop: shopRows.reduce((s, r) => s + (r.item.price || 0), 0),
      roomExpand: txs.filter((t) => categorizeTx(t) === 'room_expand').reduce((s, t) => s + t.amount, 0),
      donation: donations.reduce((s, d) => s + d.amount, 0),
      deposit: deposits.reduce((s, d) => s + d.principal, 0),
      stockBuy: buyOrders.reduce((s, o) => s + o.amount + (o.fee || 0), 0),
      predictionBet: bets.reduce((s, b) => s + b.amount, 0),
    };

    const resolvedBets = bets.filter((b) => b.payout !== null);
    const wonBets = resolvedBets.filter((b) => b.payout > 0);

    const balances = scopeKids.map((k) => k.balance);

    const participation = {
      snack: distinctKidIds(snackTx).size,
      shop: distinctKidIds(shopRows).size,
      deposit: distinctKidIds(deposits).size,
      stock: distinctKidIds(stockOrders).size,
      prediction: distinctKidIds(bets).size,
      donation: distinctKidIds(donations).size,
      megaphone: distinctKidIds(announcements).size,
    };

    return NextResponse.json({
      ok: true,
      kidCount,
      participation,
      spendBreakdown,
      investing: {
        buyCount: buyOrders.length,
        sellCount: sellOrders.length,
        chaseBuyCount: chaseBuys.length,
        chaseBuyPct: buyOrders.length > 0 ? Math.round((chaseBuys.length / buyOrders.length) * 1000) / 10 : 0,
        overBuyPct: buyOrders.length > 0 ? Math.round((overBuys.length / buyOrders.length) * 1000) / 10 : 0,
        underBuyPct: buyOrders.length > 0 ? Math.round((underBuys.length / buyOrders.length) * 1000) / 10 : 0,
        underSellPct: sellOrders.length > 0 ? Math.round((underSells.length / sellOrders.length) * 1000) / 10 : 0,
        totalRealizedProfit: scopeKids.reduce((s, k) => s + (k.invest_realized_profit || 0), 0),
        avgRealizedProfit: Math.round(
          scopeKids.reduce((s, k) => s + (k.invest_realized_profit || 0), 0) / kidCount
        ),
        avgTradeCount: Math.round((scopeKids.reduce((s, k) => s + (k.invest_trade_count || 0), 0) / kidCount) * 10) / 10,
      },
      deposits: {
        count: deposits.length,
        claimedCount: deposits.filter((d) => d.claimed).length,
        totalPrincipal: deposits.reduce((s, d) => s + d.principal, 0),
        avgTermDays: deposits.length > 0 ? Math.round(deposits.reduce((s, d) => s + d.term_days, 0) / deposits.length) : 0,
      },
      predictions: {
        totalBets: bets.length,
        resolvedCount: resolvedBets.length,
        winCount: wonBets.length,
        winRatePct: resolvedBets.length > 0 ? Math.round((wonBets.length / resolvedBets.length) * 1000) / 10 : 0,
        avgBetAmount: bets.length > 0 ? Math.round(bets.reduce((s, b) => s + b.amount, 0) / bets.length) : 0,
      },
      balance: {
        sum: balances.reduce((s, b) => s + b, 0),
        avg: Math.round(balances.reduce((s, b) => s + b, 0) / kidCount),
        median: median(balances),
        min: Math.min(...balances),
        max: Math.max(...balances),
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
