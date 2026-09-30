// 성장 지표(결과보고서용) 계산 모듈. 화면(관리자 탭)과 엑셀이 전부 이 파일의 함수만 쓰도록
// 만들어서, 계산 로직이 여기 한 곳에만 있게 합니다.
//
// 데이터 특성(청소년 약 30명, 대부분 주 1회 등원)을 반영한 원칙:
// 1) 개인 비교는 달력 월이 아니라 "등원 회차" 기준(첫 N회 vs 최근 N회 등원 구간).
// 2) 드문 행동(매수/예금)은 "건수" 기준으로 비교(첫 N건 vs 최근 N건).
// 3) 월별 전월 대비는 "집단 합산" 기준으로만 계산(개인별 월별 값은 참고용).
// 4) 표본이 기준(lib/growthConfig.js)에 못 미치면 값을 만들지 않고 insufficient/pending 표시.
// 5) 비율 지표 변화는 %p, 인원/금액은 증감 수치로 표시(작은 표본에서 "+100%" 같은 과장 방지).

import { calcFee, TRADE_FEE_RATE } from './stocks';
import { findShopItem } from './shop';
import { MEGAPHONE_PRICE } from './announcements';
import { GROWTH_THRESHOLDS, NEWS_REACTION_WINDOW_HOURS } from './growthConfig';

const INCOME_TYPES = ['earn', 'bonus', 'event', 'job'];

/* ---------------------------- 날짜 유틸 ---------------------------- */

function dateStr(iso) {
  return (iso || '').slice(0, 10);
}
function addDaysToDateStr(dateStrValue, days) {
  const d = new Date(`${dateStrValue}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function monthKey(dateStrValue) {
  return (dateStrValue || '').slice(0, 7); // 'YYYY-MM'
}
function addMonths(monthKeyValue, n) {
  const [y, m] = monthKeyValue.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}
function monthsBetween(fromMonth, toMonth) {
  const months = [];
  let cur = fromMonth;
  let guard = 0;
  while (cur <= toMonth && guard < 240) {
    months.push(cur);
    cur = addMonths(cur, 1);
    guard++;
  }
  return months;
}

/* ---------------------------- 판정 유틸 ---------------------------- */

// direction: 'up'이면 값이 커질수록 좋음, 'down'이면 값이 작아질수록 좋음.
export function compareDirection(firstValue, lastValue, direction) {
  if (firstValue == null || lastValue == null) return 'pending';
  const diff = lastValue - firstValue;
  if (Math.abs(diff) < 1e-9) return 'same';
  const better = direction === 'up' ? diff > 0 : diff < 0;
  return better ? 'improved' : 'worsened';
}

function safeRatio(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

/* ---------------------------- 원자료 로딩(한 번에 전부) ---------------------------- */
// 이 앱 규모(청소년 30명, 최대 수천 행)에서는 필요한 테이블을 통째로 불러와 메모리에서
// 계산하는 게, 함수마다 기간별로 쪼개서 반복 조회하는 것보다 훨씬 간단하고 충분히 빠릅니다.

async function loadRawData(sb) {
  const [
    kidsRes,
    attendanceRes,
    txRes,
    stockOrdersRes,
    stockNewsRes,
    depositsRes,
    donationsRes,
    jobAppsRes,
    inventoryRes,
    announcementsRes,
    visitSnapshotsRes,
  ] = await Promise.all([
    sb.from('kids').select('id, name, gender, invest_realized_profit'),
    sb.from('transactions').select('kid_id, tx_date').eq('reason', '출석').order('tx_date', { ascending: true }),
    sb.from('transactions').select('kid_id, type, amount, reason, tx_date, created_at'),
    sb
      .from('stock_orders')
      .select('kid_id, stock_id, type, shares, price, amount, fee, valuation_at_trade, memo, realized, created_at')
      .order('created_at', { ascending: true }),
    sb.from('stock_news').select('stock_id, pct, created_at'),
    sb.from('kid_deposits').select('kid_id, principal, rate_pct, term_days, created_at, claimed'),
    sb.from('group_goal_donations').select('kid_id, amount, created_at'),
    sb.from('job_applications').select('kid_id, status, created_at, resolved_at'),
    sb.from('kid_inventory').select('kid_id, category, item_key, purchased_at'),
    sb.from('announcements').select('kid_id, amount, created_at'),
    sb.from('kid_visit_snapshots').select('kid_id, visit_date, balance, deposit_principal, stock_value').order('visit_date', { ascending: true }),
  ]);

  // realized/amount 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 그때는 그 컬럼
  // 없이 재시도합니다(수수료/손익 비율, 확성기 소비 계산 정확도만 조금 떨어질 뿐 전체가
  // 막히진 않게).
  if (stockOrdersRes.error) {
    const fallback = await sb
      .from('stock_orders')
      .select('kid_id, stock_id, type, shares, price, amount, fee, valuation_at_trade, memo, created_at')
      .order('created_at', { ascending: true });
    if (fallback.error) throw fallback.error;
    stockOrdersRes.data = fallback.data.map((o) => ({ ...o, realized: null }));
    stockOrdersRes.error = null;
  }
  if (announcementsRes.error) {
    const fallback = await sb.from('announcements').select('kid_id, created_at');
    if (fallback.error) throw fallback.error;
    announcementsRes.data = fallback.data.map((a) => ({ ...a, amount: null }));
    announcementsRes.error = null;
  }

  const errors = [
    kidsRes.error,
    attendanceRes.error,
    txRes.error,
    stockOrdersRes.error,
    stockNewsRes.error,
    depositsRes.error,
    donationsRes.error,
    jobAppsRes.error,
    inventoryRes.error,
    announcementsRes.error,
    visitSnapshotsRes.error,
  ].filter(Boolean);
  if (errors.length > 0) throw errors[0];

  const inventory = (inventoryRes.data || []).map((i) => ({
    ...i,
    price: findShopItem(i.category, i.item_key)?.price ?? null,
  }));
  const announcements = (announcementsRes.data || []).map((a) => ({
    ...a,
    amount: a.amount ?? MEGAPHONE_PRICE, // amount 컬럼 마이그레이션 전/그 전 사용분은 현재가로 근사
  }));

  return {
    kids: kidsRes.data || [],
    attendance: attendanceRes.data || [],
    transactions: txRes.data || [],
    stockOrders: stockOrdersRes.data || [],
    stockNews: stockNewsRes.data || [],
    deposits: depositsRes.data || [],
    donations: donationsRes.data || [],
    jobApplications: jobAppsRes.data || [],
    inventory,
    announcements,
    visitSnapshots: visitSnapshotsRes.data || [],
  };
}

// 기존 통계 탭(app/api/admin/stats/route.js)과 같은 필터 규약: kidId가 있으면 그 학생만,
// 없으면 scope('all'|'male'|'female')로 좁힙니다.
function scopedKids(data, { kidId, scope } = {}) {
  if (kidId) return data.kids.filter((k) => k.id === kidId);
  if (scope === 'male' || scope === 'female') return data.kids.filter((k) => k.gender === scope);
  return data.kids;
}

/* ---------------------------- 기간별 수입/소비 계산 ---------------------------- */
// "소비" = 간식 주문·마이룸 확장(transactions type=spend) + 상점 구매(kid_inventory) +
// 확성기(announcements). 모의투자 매수/매도는 소비/수입에 포함하지 않습니다(투자는 소비가
// 아니라 자산 배분이라 별도 지표로 다룸).

function sumIncome(data, kidId, start, end) {
  return data.transactions
    .filter((t) => t.kid_id === kidId && INCOME_TYPES.includes(t.type) && t.tx_date >= start && t.tx_date < end)
    .reduce((s, t) => s + t.amount, 0);
}

function sumSpend(data, kidId, start, end) {
  const txSpend = data.transactions
    .filter((t) => t.kid_id === kidId && t.type === 'spend' && t.tx_date >= start && t.tx_date < end)
    .reduce((s, t) => s + t.amount, 0);
  const shopSpend = data.inventory
    .filter((i) => i.kid_id === kidId && i.price != null && dateStr(i.purchased_at) >= start && dateStr(i.purchased_at) < end)
    .reduce((s, i) => s + i.price, 0);
  const megaphoneSpend = data.announcements
    .filter((a) => a.kid_id === kidId && dateStr(a.created_at) >= start && dateStr(a.created_at) < end)
    .reduce((s, a) => s + a.amount, 0);
  return txSpend + shopSpend + megaphoneSpend;
}

function savingsRate(data, kidId, start, end) {
  const income = sumIncome(data, kidId, start, end);
  const spend = sumSpend(data, kidId, start, end);
  if (income <= 0) return null;
  return (income - spend) / income;
}

/* ---------------------------- 개인별: 등원 회차 구간 ---------------------------- */

function kidVisitDates(data, kidId) {
  return data.attendance.filter((a) => a.kid_id === kidId).map((a) => a.tx_date);
}

// 첫 N회/최근 N회 등원에 해당하는 [start, end) 날짜 범위. 등원이 N회 미만이면 null.
function visitWindowRanges(visitDates, n) {
  if (visitDates.length < n) return null;
  const firstDates = visitDates.slice(0, n);
  const lastDates = visitDates.slice(-n);
  const toRange = (dates) => ({ start: dates[0], end: addDaysToDateStr(dates[dates.length - 1], 1) });
  return { first: toRange(firstDates), last: toRange(lastDates) };
}

/* ---------------------------- 개인별: 매매 등 "건수" 기반 구간 ---------------------------- */

function firstLastN(list, n) {
  if (list.length < n) return null;
  return { first: list.slice(0, n), last: list.slice(-n) };
}

/* ---------------------------- 종목 매수 행동 지표 (건수 세트에 대해 계산) ---------------------------- */

function chaseBuyRate(buys) {
  if (buys.length === 0) return null;
  return buys.filter((o) => o.fee > calcFee(o.amount, TRADE_FEE_RATE)).length / buys.length;
}
function valuationBuyRate(buys, valuation) {
  if (buys.length === 0) return null;
  return buys.filter((o) => o.valuation_at_trade === valuation).length / buys.length;
}
function memoRate(buys) {
  if (buys.length === 0) return null;
  return buys.filter((o) => o.memo && o.memo.trim().length > 0).length / buys.length;
}
// 매도 건들의 수수료 합 ÷ |실현손익 합|. 실현손익 합이 0이면(이익도 손실도 없으면) 비율이
// 의미가 없어 null 처리합니다.
function feeToProfitRatio(sells) {
  const withRealized = sells.filter((o) => o.realized != null);
  if (withRealized.length === 0) return null;
  const totalFee = withRealized.reduce((s, o) => s + (o.fee || 0), 0);
  const totalRealized = withRealized.reduce((s, o) => s + o.realized, 0);
  if (totalRealized === 0) return null;
  return totalFee / Math.abs(totalRealized);
}

/* ---------------------------- 뉴스 직후 반응 ---------------------------- */

// 특정 주문이 "그 종목에 대해 직전 N시간 이내에 같은 방향 뉴스가 있었는지"를 봅니다.
function reactedToNews(order, newsByStock, direction) {
  const newsList = newsByStock.get(order.stock_id) || [];
  const orderTime = new Date(order.created_at).getTime();
  const windowMs = NEWS_REACTION_WINDOW_HOURS * 60 * 60 * 1000;
  return newsList.some((n) => {
    const newsTime = new Date(n.created_at).getTime();
    const sameDirection = direction === 'bad' ? n.pct < 0 : n.pct > 0;
    return sameDirection && orderTime >= newsTime && orderTime - newsTime <= windowMs;
  });
}

function buildNewsByStock(stockNews) {
  const map = new Map();
  for (const n of stockNews) {
    if (!map.has(n.stock_id)) map.set(n.stock_id, []);
    map.get(n.stock_id).push(n);
  }
  return map;
}

function badNewsSellReactRate(sells, newsByStock) {
  if (sells.length === 0) return null;
  return sells.filter((o) => reactedToNews(o, newsByStock, 'bad')).length / sells.length;
}
function goodNewsBuyReactRate(buys, newsByStock) {
  if (buys.length === 0) return null;
  return buys.filter((o) => reactedToNews(o, newsByStock, 'good')).length / buys.length;
}

/* ---------------------------- 구인시장 / 기부 ---------------------------- */

function jobCompletionRate(apps) {
  if (apps.length === 0) return null;
  return apps.filter((a) => a.status === 'completed').length / apps.length;
}

function donationRate(data, kidId, start, end) {
  const income = sumIncome(data, kidId, start, end);
  if (income <= 0) return null;
  const donated = data.donations
    .filter((d) => d.kid_id === kidId && dateStr(d.created_at) >= start && dateStr(d.created_at) < end)
    .reduce((s, d) => s + d.amount, 0);
  return donated / income;
}

/* ---------------------------- 등원 간 자산 유지율 ---------------------------- */
// 이번 등원 스냅샷 자산 ÷ (지난 등원 스냅샷 자산 + 그 사이 수입). 1에 가까울수록 "받은 만큼
// 자산으로 남아있다"는 뜻이고, 1보다 많이 작으면 "받자마자 많이 쓴다"는 뜻입니다.
// kid_visit_snapshots가 쌓이기 시작한 뒤부터만 계산 가능합니다(그 전 데이터는 없음).
function assetMaintenanceRatios(data, kidId) {
  const snaps = data.visitSnapshots.filter((s) => s.kid_id === kidId);
  const ratios = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    const prevAsset = prev.balance + prev.deposit_principal + prev.stock_value;
    const curAsset = cur.balance + cur.deposit_principal + cur.stock_value;
    const incomeBetween = sumIncome(data, kidId, prev.visit_date, cur.visit_date);
    const denom = prevAsset + incomeBetween;
    if (denom > 0) ratios.push({ visitDate: cur.visit_date, ratio: curAsset / denom });
  }
  return ratios;
}
function avg(nums) {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

/* =====================================================================
   1) getMonthlyGroupMetrics(from, to) — 월별 "집단 합산" 지표 + 전월 대비
   ===================================================================== */

export async function getMonthlyGroupMetrics(sb, from, to, { kidId = null, scope = 'all' } = {}) {
  const raw = await loadRawData(sb);
  const scopeKids = scopedKids(raw, { kidId, scope });
  const scopeSet = new Set(scopeKids.map((k) => k.id));
  const data = {
    ...raw,
    kids: scopeKids,
    attendance: raw.attendance.filter((a) => scopeSet.has(a.kid_id)),
    transactions: raw.transactions.filter((t) => scopeSet.has(t.kid_id)),
    stockOrders: raw.stockOrders.filter((o) => scopeSet.has(o.kid_id)),
    deposits: raw.deposits.filter((d) => scopeSet.has(d.kid_id)),
    donations: raw.donations.filter((d) => scopeSet.has(d.kid_id)),
    jobApplications: raw.jobApplications.filter((a) => scopeSet.has(a.kid_id)),
    inventory: raw.inventory.filter((i) => scopeSet.has(i.kid_id)),
    announcements: raw.announcements.filter((a) => scopeSet.has(a.kid_id)),
    visitSnapshots: raw.visitSnapshots.filter((s) => scopeSet.has(s.kid_id)),
  };

  const months = monthsBetween(monthKey(from), monthKey(to));
  const kidIds = data.kids.map((k) => k.id);
  const newsByStock = buildNewsByStock(data.stockNews);

  const rows = months.map((month) => {
    const start = `${month}-01`;
    const end = addMonths(month, 1) + '-01';

    const visitorIds = new Set(
      data.attendance.filter((a) => a.tx_date >= start && a.tx_date < end).map((a) => a.kid_id)
    );
    const visitorCount = visitorIds.size;

    const monthBuys = data.stockOrders.filter((o) => o.type === 'buy' && dateStr(o.created_at) >= start && dateStr(o.created_at) < end);
    const monthSells = data.stockOrders.filter((o) => o.type === 'sell' && dateStr(o.created_at) >= start && dateStr(o.created_at) < end);
    const monthJobApps = data.jobApplications.filter((a) => dateStr(a.created_at) >= start && dateStr(a.created_at) < end);

    const enoughVisitors = visitorCount >= GROWTH_THRESHOLDS.monthlyGroupMinVisitors;
    const enoughBuys = monthBuys.length >= GROWTH_THRESHOLDS.monthlyGroupMinBuys;

    // 저축률/기부율은 그 달에 등원한 아이들 전체를 대상으로 평균.
    let avgSavingsRate = null;
    let avgDonationRate = null;
    let depositUserCount = 0;
    if (enoughVisitors) {
      const rates = [];
      const donRates = [];
      for (const kidId of visitorIds) {
        const r = savingsRate(data, kidId, start, end);
        if (r != null) rates.push(r);
        const dr = donationRate(data, kidId, start, end);
        if (dr != null) donRates.push(dr);
      }
      avgSavingsRate = avg(rates);
      avgDonationRate = avg(donRates);
      depositUserCount = new Set(
        data.deposits.filter((d) => dateStr(d.created_at) >= start && dateStr(d.created_at) < end).map((d) => d.kid_id)
      ).size;
    }

    return {
      month,
      sampleSize: { visitorCount, buyCount: monthBuys.length, sellCount: monthSells.length, jobAppCount: monthJobApps.length },
      insufficient: !enoughVisitors && !enoughBuys,
      savings: enoughVisitors ? { avgSavingsRate, depositUserCount, insufficient: false } : { insufficient: true },
      investing: enoughBuys
        ? {
            chaseBuyRate: chaseBuyRate(monthBuys),
            overvaluedBuyRate: valuationBuyRate(monthBuys, 'over'),
            undervaluedBuyRate: valuationBuyRate(monthBuys, 'under'),
            memoRate: memoRate(monthBuys),
            feeToProfitRatio: feeToProfitRatio(monthSells),
            badNewsSellReactRate: badNewsSellReactRate(monthSells, newsByStock),
            goodNewsBuyReactRate: goodNewsBuyReactRate(monthBuys, newsByStock),
            insufficient: false,
          }
        : { insufficient: true },
      jobs: monthJobApps.length > 0 ? { completionRate: jobCompletionRate(monthJobApps), insufficient: false } : { insufficient: true },
      donation: enoughVisitors ? { avgDonationRate, insufficient: false } : { insufficient: true },
    };
  });

  // 전월 대비 변화(집단 기준으로만). 비율은 %p, 인원/건수는 증감으로.
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    cur.changeFromPrevMonth = {
      visitorCount: cur.sampleSize.visitorCount - prev.sampleSize.visitorCount,
      avgSavingsRatePp:
        cur.savings.avgSavingsRate != null && prev.savings.avgSavingsRate != null
          ? (cur.savings.avgSavingsRate - prev.savings.avgSavingsRate) * 100
          : null,
      chaseBuyRatePp:
        cur.investing.chaseBuyRate != null && prev.investing.chaseBuyRate != null
          ? (cur.investing.chaseBuyRate - prev.investing.chaseBuyRate) * 100
          : null,
    };
  }

  return { months: rows, totalKids: kidIds.length };
}

/* =====================================================================
   2) getKidProgress(sb, kidId?) — 개인별 "첫 N vs 최근 N" 비교
   ===================================================================== */

export async function getKidProgress(sb, { kidId = null, scope = 'all' } = {}) {
  const data = await loadRawData(sb);
  const targetKids = scopedKids(data, { kidId, scope });

  return targetKids.map((kid) => {
    const visitDates = kidVisitDates(data, kid.id);
    const visitWindows = visitWindowRanges(visitDates, GROWTH_THRESHOLDS.kidMinVisitsForCompare);

    const kidBuys = data.stockOrders.filter((o) => o.kid_id === kid.id && o.type === 'buy');
    const kidSells = data.stockOrders.filter((o) => o.kid_id === kid.id && o.type === 'sell');
    const buyWindows = firstLastN(kidBuys, GROWTH_THRESHOLDS.kidMinTradesForCompare);
    const sellWindows = firstLastN(kidSells, GROWTH_THRESHOLDS.kidMinTradesForCompare);
    const kidJobApps = data.jobApplications.filter((a) => a.kid_id === kid.id);
    const jobWindows = firstLastN(kidJobApps, GROWTH_THRESHOLDS.kidMinTradesForCompare);
    const newsByStock = buildNewsByStock(data.stockNews);

    const metrics = {};

    // 등원 구간 기반 지표
    if (visitWindows) {
      const firstSavings = savingsRate(data, kid.id, visitWindows.first.start, visitWindows.first.end);
      const lastSavings = savingsRate(data, kid.id, visitWindows.last.start, visitWindows.last.end);
      metrics.savingsRate = { first: firstSavings, last: lastSavings, verdict: compareDirection(firstSavings, lastSavings, 'up') };

      const firstDonation = donationRate(data, kid.id, visitWindows.first.start, visitWindows.first.end);
      const lastDonation = donationRate(data, kid.id, visitWindows.last.start, visitWindows.last.end);
      metrics.donationRate = { first: firstDonation, last: lastDonation, verdict: compareDirection(firstDonation, lastDonation, 'up') };
    } else {
      metrics.savingsRate = { pending: true };
      metrics.donationRate = { pending: true };
    }

    // 매수 건수 기반 지표
    if (buyWindows) {
      const m = (fn) => ({ first: fn(buyWindows.first), last: fn(buyWindows.last) });
      const chase = m(chaseBuyRate);
      const over = m((l) => valuationBuyRate(l, 'over'));
      const under = m((l) => valuationBuyRate(l, 'under'));
      const memo = m(memoRate);
      const goodNewsReact = m((l) => goodNewsBuyReactRate(l, newsByStock));
      metrics.chaseBuyRate = { ...chase, verdict: compareDirection(chase.first, chase.last, 'down') };
      metrics.overvaluedBuyRate = { ...over, verdict: compareDirection(over.first, over.last, 'down') };
      metrics.undervaluedBuyRate = { ...under, verdict: compareDirection(under.first, under.last, 'up') };
      metrics.memoRate = { ...memo, verdict: compareDirection(memo.first, memo.last, 'up') };
      metrics.goodNewsBuyReactRate = { ...goodNewsReact, verdict: compareDirection(goodNewsReact.first, goodNewsReact.last, 'down') };
    } else {
      metrics.chaseBuyRate = { pending: true };
      metrics.overvaluedBuyRate = { pending: true };
      metrics.undervaluedBuyRate = { pending: true };
      metrics.memoRate = { pending: true };
      metrics.goodNewsBuyReactRate = { pending: true };
    }

    // 매도 건수 기반 지표
    if (sellWindows) {
      const feeRatio = { first: feeToProfitRatio(sellWindows.first), last: feeToProfitRatio(sellWindows.last) };
      const badNewsReact = { first: badNewsSellReactRate(sellWindows.first, newsByStock), last: badNewsSellReactRate(sellWindows.last, newsByStock) };
      metrics.feeToProfitRatio = { ...feeRatio, verdict: compareDirection(feeRatio.first, feeRatio.last, 'down') };
      metrics.badNewsSellReactRate = { ...badNewsReact, verdict: compareDirection(badNewsReact.first, badNewsReact.last, 'down') };
    } else {
      metrics.feeToProfitRatio = { pending: true };
      metrics.badNewsSellReactRate = { pending: true };
    }

    // 구인시장
    if (jobWindows) {
      const first = jobCompletionRate(jobWindows.first);
      const last = jobCompletionRate(jobWindows.last);
      metrics.jobCompletionRate = { first, last, verdict: compareDirection(first, last, 'up') };
    } else {
      metrics.jobCompletionRate = { pending: true };
    }

    // 등원 간 자산 유지율(첫 구간 평균 vs 최근 구간 평균) — kid_visit_snapshots 데이터가
    // 쌓인 뒤부터만 값이 나옵니다.
    const maintenance = assetMaintenanceRatios(data, kid.id);
    if (maintenance.length >= 2) {
      const half = Math.max(1, Math.floor(maintenance.length / 2));
      const firstAvg = avg(maintenance.slice(0, half).map((r) => r.ratio));
      const lastAvg = avg(maintenance.slice(-half).map((r) => r.ratio));
      metrics.assetMaintenanceRatio = { first: firstAvg, last: lastAvg, verdict: compareDirection(firstAvg, lastAvg, 'up') };
    } else {
      metrics.assetMaintenanceRatio = { pending: true, reason: 'kid_visit_snapshots 데이터가 아직 부족함(2단계 이후부터 쌓임)' };
    }

    // 예금 이용(건수 기반, 첫 N건 vs 최근 N건 원금 비교)
    const kidDeposits = data.deposits.filter((d) => d.kid_id === kid.id);
    const depositWindows = firstLastN(kidDeposits, GROWTH_THRESHOLDS.kidMinTradesForCompare);
    if (depositWindows) {
      const firstAvgPrincipal = avg(depositWindows.first.map((d) => d.principal));
      const lastAvgPrincipal = avg(depositWindows.last.map((d) => d.principal));
      metrics.depositPrincipal = {
        first: firstAvgPrincipal,
        last: lastAvgPrincipal,
        verdict: compareDirection(firstAvgPrincipal, lastAvgPrincipal, 'up'),
      };
    } else {
      metrics.depositPrincipal = { pending: true, count: kidDeposits.length };
    }

    return {
      kidId: kid.id,
      kidName: kid.name,
      gender: kid.gender || null,
      totalVisits: visitDates.length,
      visitsPending: !visitWindows,
      metrics,
    };
  });
}

/* =====================================================================
   3) getGoalSummary(sb) — 목표별 "개선 N명 / 판단 가능 M명" 요약
   ===================================================================== */

const GOAL_METRIC_MAP = {
  계획적_금융생활: ['savingsRate', 'depositPrincipal', 'assetMaintenanceRatio'],
  합리적_의사결정: ['chaseBuyRate', 'overvaluedBuyRate', 'undervaluedBuyRate', 'memoRate', 'feeToProfitRatio'],
  경제_흐름_이해: ['badNewsSellReactRate', 'goodNewsBuyReactRate'],
  근로_나눔: ['jobCompletionRate', 'donationRate'],
};

export async function getGoalSummary(sb, { kidId = null, scope = 'all' } = {}) {
  const kidProgress = await getKidProgress(sb, { kidId, scope });
  const summary = {};

  for (const [goal, metricKeys] of Object.entries(GOAL_METRIC_MAP)) {
    let improved = 0;
    let judgable = 0;
    for (const kid of kidProgress) {
      for (const key of metricKeys) {
        const m = kid.metrics[key];
        if (!m || m.pending) continue;
        judgable++;
        if (m.verdict === 'improved') improved++;
      }
    }
    summary[goal] = {
      improved,
      judgable,
      pct: judgable > 0 ? Math.round((improved / judgable) * 1000) / 10 : null,
    };
  }
  return summary;
}

/* =====================================================================
   4) getCumulativeReach(sb) — "한 번이라도 해본 청소년 비율" 누적 곡선(월 단위)
   ===================================================================== */

export async function getCumulativeReach(sb, { kidId = null, scope = 'all' } = {}) {
  const raw = await loadRawData(sb);
  const scopeKids = scopedKids(raw, { kidId, scope });
  const scopeSet = new Set(scopeKids.map((k) => k.id));
  const data = {
    ...raw,
    kids: scopeKids,
    attendance: raw.attendance.filter((a) => scopeSet.has(a.kid_id)),
    stockOrders: raw.stockOrders.filter((o) => scopeSet.has(o.kid_id)),
    deposits: raw.deposits.filter((d) => scopeSet.has(d.kid_id)),
    donations: raw.donations.filter((d) => scopeSet.has(d.kid_id)),
    jobApplications: raw.jobApplications.filter((a) => scopeSet.has(a.kid_id)),
  };
  const totalKids = data.kids.length;
  if (totalKids === 0) return { months: [], totalKids: 0 };

  const firstTryDate = (rows, dateField, kidField = 'kid_id') => {
    const map = new Map();
    for (const r of rows) {
      const d = dateStr(r[dateField]);
      if (!map.has(r[kidField]) || d < map.get(r[kidField])) map.set(r[kidField], d);
    }
    return map;
  };

  const firstDeposit = firstTryDate(data.deposits, 'created_at');
  const firstBuy = firstTryDate(
    data.stockOrders.filter((o) => o.type === 'buy'),
    'created_at'
  );
  const firstDonation = firstTryDate(data.donations, 'created_at');
  const firstJobApp = firstTryDate(data.jobApplications, 'created_at');

  const allDates = [
    ...data.attendance.map((a) => a.tx_date),
    ...[...firstDeposit.values()],
    ...[...firstBuy.values()],
    ...[...firstDonation.values()],
    ...[...firstJobApp.values()],
  ].filter(Boolean);
  if (allDates.length === 0) return { months: [], totalKids };

  const months = monthsBetween(monthKey(allDates.reduce((a, b) => (a < b ? a : b))), monthKey(allDates.reduce((a, b) => (a > b ? a : b))));

  const countByEnd = (map, endExclusive) => [...map.values()].filter((d) => d < endExclusive).length;

  return {
    totalKids,
    months: months.map((month) => {
      const end = addMonths(month, 1) + '-01';
      return {
        month,
        deposit: { count: countByEnd(firstDeposit, end), pct: Math.round((countByEnd(firstDeposit, end) / totalKids) * 1000) / 10 },
        investing: { count: countByEnd(firstBuy, end), pct: Math.round((countByEnd(firstBuy, end) / totalKids) * 1000) / 10 },
        donation: { count: countByEnd(firstDonation, end), pct: Math.round((countByEnd(firstDonation, end) / totalKids) * 1000) / 10 },
        job: { count: countByEnd(firstJobApp, end), pct: Math.round((countByEnd(firstJobApp, end) / totalKids) * 1000) / 10 },
      };
    }),
  };
}

/* =====================================================================
   6) getKidsMonthlySeries(sb, from, to) — 청소년별 월별 원값(참고용, 표본 문턱 없음)
   ===================================================================== */
// 엑셀 "청소년별" 시트의 참고 열에 쓰는 값. 집단 지표(getMonthlyGroupMetrics)와 달리 개인
// 한 명 기준이라 monthlyGroupMin* 문턱을 적용하지 않고 그 달 원값을 그대로 보여줍니다.

export async function getKidsMonthlySeries(sb, from, to, { kidId = null, scope = 'all' } = {}) {
  const raw = await loadRawData(sb);
  const scopeKids = scopedKids(raw, { kidId, scope });
  const months = monthsBetween(monthKey(from), monthKey(to));

  return scopeKids.map((kid) => ({
    kidId: kid.id,
    kidName: kid.name,
    series: months.map((month) => {
      const start = `${month}-01`;
      const end = addMonths(month, 1) + '-01';
      const buys = raw.stockOrders.filter(
        (o) => o.kid_id === kid.id && o.type === 'buy' && dateStr(o.created_at) >= start && dateStr(o.created_at) < end
      );
      return {
        month,
        savingsRate: savingsRate(raw, kid.id, start, end),
        chaseBuyRate: chaseBuyRate(buys),
      };
    }),
  }));
}

/* =====================================================================
   7) getRawExportData(sb) — 엑셀 "원자료" 시트용 원본 행(등원 스냅샷, 매매 주문)
   ===================================================================== */

export async function getRawExportData(sb, { kidId = null, scope = 'all' } = {}) {
  const raw = await loadRawData(sb);
  const scopeKids = scopedKids(raw, { kidId, scope });
  const scopeSet = new Set(scopeKids.map((k) => k.id));
  const nameById = new Map(scopeKids.map((k) => [k.id, k.name]));

  return {
    visitSnapshots: raw.visitSnapshots
      .filter((s) => scopeSet.has(s.kid_id))
      .map((s) => ({ ...s, kidName: nameById.get(s.kid_id) })),
    stockOrders: raw.stockOrders
      .filter((o) => scopeSet.has(o.kid_id))
      .map((o) => ({ ...o, kidName: nameById.get(o.kid_id) })),
  };
}

/* =====================================================================
   5) buildReportSentences(sb) — 결과보고서에 붙여넣을 한 줄 문장
   ===================================================================== */

function pctStr(v) {
  return v == null ? '집계 불가' : `${Math.round(v * 1000) / 10}%`;
}

export async function buildReportSentences(sb, { kidId = null, scope = 'all' } = {}) {
  const monthly = await getMonthlyGroupMetrics(
    sb,
    addMonths(monthKey(new Date().toISOString()), -11) + '-01',
    new Date().toISOString().slice(0, 10),
    { kidId, scope }
  );
  const goalSummary = await getGoalSummary(sb, { kidId, scope });
  const sentences = [];

  const validMonths = monthly.months.filter((m) => !m.insufficient);
  if (validMonths.length >= 2) {
    const first = validMonths[0];
    const last = validMonths[validMonths.length - 1];
    if (first.investing && !first.investing.insufficient && last.investing && !last.investing.insufficient) {
      const pp = Math.round((last.investing.chaseBuyRate - first.investing.chaseBuyRate) * 1000) / 10;
      sentences.push(
        `추격매수 비율 ${pctStr(first.investing.chaseBuyRate)} → ${pctStr(last.investing.chaseBuyRate)}(${pp >= 0 ? '+' : ''}${pp}%p)`
      );
    }
    if (first.savings && !first.savings.insufficient && last.savings && !last.savings.insufficient) {
      const pp = Math.round((last.savings.avgSavingsRate - first.savings.avgSavingsRate) * 1000) / 10;
      sentences.push(
        `평균 저축률 ${pctStr(first.savings.avgSavingsRate)} → ${pctStr(last.savings.avgSavingsRate)}(${pp >= 0 ? '+' : ''}${pp}%p)`
      );
    }
  }

  for (const [goal, s] of Object.entries(goalSummary)) {
    if (s.judgable === 0) {
      sentences.push(`${goal.replaceAll('_', ' ')}: 아직 판단 가능한 청소년이 없어요(표본 부족)`);
    } else {
      sentences.push(`${goal.replaceAll('_', ' ')}: 판단 가능 ${s.judgable}건 중 ${s.improved}건 개선(${s.pct}%)`);
    }
  }

  return sentences;
}

/* =====================================================================
   8) buildOverallSummary(sb) — 목표별 결과를 종합한 서술형 총평 한 문단
   ===================================================================== */
// buildReportSentences()가 뽑는 건 각 항목을 그대로 나열한 bullet이고, 이건 그걸 사람이 읽는
// 문단으로 종합한 것. 규칙 기반으로만 만들어서(수치 → 정해진 문장 패턴 조합) AI 호출 없이도
// 항상 같은 데이터면 같은 총평이 나오고, 왜 그 문장이 나왔는지 항상 숫자로 추적 가능함.

export async function buildOverallSummary(sb, { kidId = null, scope = 'all' } = {}) {
  const goalSummary = await getGoalSummary(sb, { kidId, scope });
  const monthly = await getMonthlyGroupMetrics(
    sb,
    addMonths(monthKey(new Date().toISOString()), -11) + '-01',
    new Date().toISOString().slice(0, 10),
    { kidId, scope }
  );

  const entries = Object.entries(goalSummary);
  const judgable = entries.filter(([, s]) => s.judgable > 0);
  const insufficient = entries.filter(([, s]) => s.judgable === 0).map(([g]) => g.replaceAll('_', ' '));

  if (judgable.length === 0) {
    return '아직 목표별 개선 여부를 판단할 수 있는 표본이 부족해요. 청소년들의 등원·매매·예금 등 기록이 더 쌓이면 총평이 채워질 거예요.';
  }

  const sentences = [];

  const majorityImproved = judgable.filter(([, s]) => s.pct >= 50);
  sentences.push(
    `판단 가능한 ${judgable.length}개 목표 중 ${majorityImproved.length}개 목표에서 절반 이상의 청소년이 개선된 모습을 보였어요.`
  );

  const sortedByPct = [...judgable].sort((a, b) => b[1].pct - a[1].pct);
  const best = sortedByPct[0];
  const worst = sortedByPct[sortedByPct.length - 1];
  if (best) {
    sentences.push(
      `가장 뚜렷한 개선은 '${best[0].replaceAll('_', ' ')}' 영역(판단 ${best[1].judgable}건 중 ${best[1].improved}건, ${best[1].pct}%)이에요.`
    );
  }
  if (worst && worst[0] !== best[0] && worst[1].pct < 50) {
    sentences.push(`상대적으로 더딘 영역은 '${worst[0].replaceAll('_', ' ')}' 영역(${worst[1].pct}%)이에요.`);
  }

  const validMonths = monthly.months.filter((m) => !m.insufficient);
  if (validMonths.length >= 2) {
    const first = validMonths[0];
    const last = validMonths[validMonths.length - 1];
    if (first.savings && !first.savings.insufficient && last.savings && !last.savings.insufficient) {
      const pp = Math.round((last.savings.avgSavingsRate - first.savings.avgSavingsRate) * 1000) / 10;
      if (Math.abs(pp) >= 1) {
        sentences.push(`같은 기간 평균 저축률은 ${pp >= 0 ? '+' : ''}${pp}%p ${pp >= 0 ? '올랐어요' : '내려갔어요'}.`);
      }
    }
  }

  if (insufficient.length > 0) {
    sentences.push(`'${insufficient.join("', '")}' 영역은 아직 표본이 부족해 판단을 보류했어요.`);
  }

  return sentences.join(' ');
}
