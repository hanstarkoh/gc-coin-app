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
import { isMissingTableError } from './quiz';

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

/* ---------------------------- 통계 유틸(윌콕슨 부호순위 검정) ---------------------------- */
// 사전→사후처럼 "짝지어진" 두 값의 차이가 통계적으로 의미 있는 변화인지 보는 비모수 검정.
// 차이가 0인 쌍은 표준 절차대로 제외하고, |차이|를 순위로 매겨(동순위는 평균순위) 양의
// 순위 합(W+)을 구합니다. n<=20이면 2^n가지 부호조합을 전부 따져서 "정확한" p값을 내고
// (n=20이어도 2^20≈100만 가지라 충분히 빠름), n이 더 크면 정규근사를 씁니다. n<5는 아예
// 유의미해질 수 없는 범위라(최소 가능한 양쪽검정 p가 0.05를 넘음) 검정을 생략합니다.
const WILCOXON_EXACT_MAX_N = 20;
const WILCOXON_MIN_N = 5;

function erf(x) {
  // Abramowitz-Stegun 근사(최대오차 ~1.5e-7)
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}
function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// 순위 n개에 +/-를 다 매겨봐서(2^n가지) W+가 관측값만큼(또는 더) 극단적으로 나오는 조합의
// 비율로 정확한 양쪽검정 p값을 구합니다. 동순위(평균순위)가 있어도 그대로 적용 가능합니다.
function exactWilcoxonP(ranks, wPlusObserved) {
  const n = ranks.length;
  const total = 1 << n; // 2^n
  let countLE = 0;
  let countGE = 0;
  for (let mask = 0; mask < total; mask++) {
    let w = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) w += ranks[i];
    }
    if (w <= wPlusObserved) countLE++;
    if (w >= wPlusObserved) countGE++;
  }
  const pOneTail = Math.min(countLE, countGE) / total;
  return Math.min(1, pOneTail * 2);
}

function wilcoxonSignedRank(diffs) {
  const nonZero = diffs.filter((d) => d !== 0);
  const n = nonZero.length;
  if (n < WILCOXON_MIN_N) return { n, insufficient: true };
  const absVals = nonZero.map((d) => Math.abs(d));
  const order = absVals.map((_, i) => i).sort((a, b) => absVals[a] - absVals[b]);
  const ranks = new Array(n);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && absVals[order[j + 1]] === absVals[order[i]]) j++;
    const avgRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) ranks[order[k]] = avgRank;
    i = j + 1;
  }
  let wPlus = 0;
  let wMinus = 0;
  for (let k = 0; k < n; k++) {
    if (nonZero[k] > 0) wPlus += ranks[k];
    else wMinus += ranks[k];
  }

  let p;
  let method;
  if (n <= WILCOXON_EXACT_MAX_N) {
    p = exactWilcoxonP(ranks, wPlus);
    method = 'exact';
  } else {
    const meanW = (n * (n + 1)) / 4;
    const sdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
    const z = sdW > 0 ? (wPlus - meanW) / sdW : 0;
    p = 2 * (1 - normalCdf(Math.abs(z)));
    method = 'approx';
  }
  p = Math.round(Math.min(p, 1) * 1000) / 1000;

  return {
    n,
    wPlus,
    wMinus,
    method, // 'exact'(n<=20, 부호조합 전부 따짐) | 'approx'(n>20, 정규근사)
    p,
    significant: p < 0.05,
    // n이 적으면(기본 20명 미만) exact라도 "통계적으로 유의미/아님"이라는 확정적 표현보다
    // "참고용" 해석이 안전하다는 걸 화면/엑셀에서 같이 보여주기 위한 플래그.
    smallSample: n < WILCOXON_EXACT_MAX_N,
    insufficient: false,
  };
}

// wilcoxonSignedRank() 결과를 화면/엑셀/보고서 문장에서 똑같은 문구로 쓰기 위한 공용 라벨.
function wilcoxonLabel(w) {
  if (w.insufficient) return `표본이 작아 통계적 검정은 아직 의미 없음(참고: n≥${WILCOXON_MIN_N}부터 계산)`;
  const methodLabel = w.method === 'exact' ? '윌콕슨 부호순위 검정(정확계산)' : '윌콕슨 부호순위 검정(근사)';
  const sigLabel = w.significant ? `유의미함(p=${w.p})` : `유의미하다고 보기 어려움(p=${w.p})`;
  const smallNote = w.smallSample ? ` — 인원이 적어(n=${w.n}) 참고용으로만 해석할 것` : '';
  return `${methodLabel}: ${sigLabel}${smallNote}`;
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
    quizSubmissionsRes,
    eventSubmissionsRes,
    jobPostingsRes,
    eventsRes,
  ] = await Promise.all([
    sb.from('kids').select('id, name, gender, invest_realized_profit, is_test'),
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
    sb.from('quiz_submissions').select('kid_id, quiz_type, correct_count, total_count, submitted_at'),
    sb.from('event_submissions').select('kid_id, status, created_at'),
    sb.from('job_postings').select('id, created_at'),
    sb.from('events').select('id, created_at'),
  ]);

  // 5단계(경제 퀴즈) 마이그레이션 전이라 quiz_submissions 테이블 자체가 아직 없을 수 있음
  // (Postgres 42P01) — 그때는 빈 배열로 처리해서 나머지 지표 계산은 그대로 진행됩니다.
  if (quizSubmissionsRes.error && isMissingTableError(quizSubmissionsRes.error)) {
    quizSubmissionsRes.data = [];
    quizSubmissionsRes.error = null;
  }

  // is_test 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 그때는 없이 재시도.
  if (kidsRes.error) {
    const fallback = await sb.from('kids').select('id, name, gender, invest_realized_profit');
    if (fallback.error) throw fallback.error;
    kidsRes.data = fallback.data.map((k) => ({ ...k, is_test: false }));
    kidsRes.error = null;
  }

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
    quizSubmissionsRes.error,
    eventSubmissionsRes.error,
    jobPostingsRes.error,
    eventsRes.error,
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
    quizSubmissions: quizSubmissionsRes.data || [],
    eventSubmissions: (eventSubmissionsRes.data || []).filter((e) => e.status === 'approved'),
    jobPostings: jobPostingsRes.data || [],
    events: eventsRes.data || [],
  };
}

// 기존 통계 탭(app/api/admin/stats/route.js)과 같은 필터 규약: kidId가 있으면 그 학생만,
// 없으면 scope('all'|'male'|'female')로 좁힙니다.
function scopedKids(data, { kidId, scope } = {}) {
  if (kidId) return data.kids.filter((k) => k.id === kidId);
  // 테스트 계정은 "전체/남자/여자" 집계에선 항상 제외(실제 결과보고서용 숫자를 어지럽히면
  // 안 되니까). kidId로 직접 선택했을 때는 위에서 이미 통과시킴 — 계산 검증용으로 씀.
  const real = data.kids.filter((k) => !k.is_test);
  if (scope === 'male' || scope === 'female') return real.filter((k) => k.gender === scope);
  return real;
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
// "계획적 소비"를 보려는 지표라서 현금+예금원금만 봅니다(2026-10, 보유 주식 평가액 제외로
// 수정). 주식평가액을 포함하면 투자를 전혀 안 한 아이의 "소비 계획성" 점수가 시세 변동에
// 끌려가 버려서(투자 안 한 아이는 stock_value가 항상 0이라 영향 없지만, 투자한 아이는
// 오르면 유지율이 좋아 보이고 내리면 나빠 보임 — 소비와 무관한 요인이 섞이는 문제) 분리.
function assetMaintenanceRatios(data, kidId) {
  const snaps = data.visitSnapshots.filter((s) => s.kid_id === kidId);
  const ratios = [];
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const cur = snaps[i];
    const prevAsset = prev.balance + prev.deposit_principal;
    const curAsset = cur.balance + cur.deposit_principal;
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
function median(nums) {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// 항목 목록(예: 그 달 매수 건들)을 kid_id별로 나눈 뒤, 각 아이 단위로 computeFn을 돌려서
// "아이별 비율 → 평균/중앙값"을 구합니다. 저축률/기부율이 이미 쓰던 방식(거래량이 아니라
// 아이 수로 가중)과 똑같이 맞춰서, 소수의 아이가 거래를 많이 한다고 집단 지표가 끌려가지
// 않게 합니다. minCount 미만만 거래한 아이는 뺍니다(1~2건이면 비율이 0%/100%로 튀어서
// 평균을 왜곡함 — GROWTH_THRESHOLDS.monthlyGroupMinTradesPerKid 기본값 3). kidCount는 값이
// 나온(=minCount 이상 거래하고 null이 아닌) 아이 수. pooled는 "전체 거래를 합쳐서 계산한
// 값"(예전 방식)을 참고용으로 같이 반환 — 두 방식이 얼마나 다른지 비교할 수 있게.
function perKidAvgMedian(items, computeFn, { minCount = GROWTH_THRESHOLDS.monthlyGroupMinTradesPerKid } = {}) {
  const byKid = new Map();
  for (const it of items) {
    if (!byKid.has(it.kid_id)) byKid.set(it.kid_id, []);
    byKid.get(it.kid_id).push(it);
  }
  const values = [];
  for (const list of byKid.values()) {
    if (list.length < minCount) continue;
    const v = computeFn(list);
    if (v != null) values.push(v);
  }
  return { avg: avg(values), median: median(values), kidCount: values.length, pooled: computeFn(items) };
}

/* ---------------------------- 등원 유지율(등원 간격) ---------------------------- */
// 등원 날짜들 사이의 "간격(일)"을 처음 구간 vs 최근 구간으로 비교합니다. 간격이 줄거나
// 유지되면(=더 자주/꾸준히 옴) 좋은 신호, 늘어나면(=뜨문뜨문 와짐) 안 좋은 신호로 봅니다.
function visitGaps(visitDates) {
  const gaps = [];
  for (let i = 1; i < visitDates.length; i++) {
    const d1 = new Date(`${visitDates[i - 1]}T00:00:00Z`).getTime();
    const d2 = new Date(`${visitDates[i]}T00:00:00Z`).getTime();
    gaps.push((d2 - d1) / (1000 * 60 * 60 * 24));
  }
  return gaps;
}

/* ---------------------------- 경험 다양성(활동 범위) ---------------------------- */
// 투자/예금/기부/구인/이벤트/퀴즈 중 "한 번이라도 해본" 영역 개수. 모의투자 참여 여부와
// 무관하게 "이 프로그램을 어떤 식으로든 활용했는지"를 보여주는 지표라서, 투자를 안 해도
// 소비·이벤트·기부만으로도 다양성 점수를 가질 수 있습니다.
export const ENGAGEMENT_CATEGORIES = ['investing', 'saving', 'donation', 'job', 'event', 'quiz'];

// 구인시장(정원제)·이벤트(지도자가 열어야 생김)는 투자/예금/기부/퀴즈처럼 항상 열려있는
// 기능이 아니라서, "안 함(0)"이 전부 같은 의미가 아닙니다 — 기회 자체가 없었을 수 있어요.
// 그 아이가 등원한 기간(첫 등원~최근 등원) 중에 공고/이벤트가 하나라도 있었는지로
// "기회가 있었는지"를 판정하고, 기회가 없었으면 해당 영역을 분모에서 뺍니다(null).
function hadOpportunity(records, visitDates) {
  if (visitDates.length === 0) return false;
  const start = visitDates[0];
  const end = visitDates[visitDates.length - 1];
  return records.some((r) => {
    const d = dateStr(r.created_at);
    return d >= start && d <= end;
  });
}

function engagementBreadth(data, kidId) {
  const visitDates = kidVisitDates(data, kidId);
  const jobOpportunity = hadOpportunity(data.jobPostings, visitDates);
  const eventOpportunity = hadOpportunity(data.events, visitDates);

  const categories = {
    investing: data.stockOrders.some((o) => o.kid_id === kidId && o.type === 'buy'),
    saving: data.deposits.some((d) => d.kid_id === kidId),
    donation: data.donations.some((d) => d.kid_id === kidId),
    job: jobOpportunity ? data.jobApplications.some((a) => a.kid_id === kidId) : null,
    event: eventOpportunity ? data.eventSubmissions.some((e) => e.kid_id === kidId) : null,
    quiz: data.quizSubmissions.some((q) => q.kid_id === kidId),
  };
  const applicable = ENGAGEMENT_CATEGORIES.filter((c) => categories[c] !== null);
  const count = applicable.filter((c) => categories[c]).length;
  return { count, total: applicable.length, categories };
}

const PARTICIPATION_TYPE_LABELS = {
  investing: '투자형',
  saving: '저축형',
  donation: '기부형',
  job: '구인형',
  event: '이벤트형',
  quiz: '퀴즈형',
};

// 참여 유형(투자형/저축형/...)을 군집분석이 아니라 규칙으로 분류합니다 — 30명 규모에서는
// 군집이 불안정하다는 지적을 반영. "활동 건수 중 한 영역이 기준 비율(기본 40%) 이상이면
// 그 유형, 아니면 혼합형, 활동 자체가 없으면 저참여형"이라는 단순 규칙. 기준값은 추정치라
// 실제 분포를 보고 growthConfig.js의 participationTypeDominantShare로 조정 가능.
function classifyParticipationType(data, kidId) {
  const counts = {
    investing: data.stockOrders.filter((o) => o.kid_id === kidId && o.type === 'buy').length,
    saving: data.deposits.filter((d) => d.kid_id === kidId).length,
    donation: data.donations.filter((d) => d.kid_id === kidId).length,
    job: data.jobApplications.filter((a) => a.kid_id === kidId).length,
    event: data.eventSubmissions.filter((e) => e.kid_id === kidId).length,
    quiz: data.quizSubmissions.filter((q) => q.kid_id === kidId).length,
  };
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (total === 0) return '저참여형';
  let dominant = null;
  let dominantCount = 0;
  for (const c of ENGAGEMENT_CATEGORIES) {
    if (counts[c] > dominantCount) {
      dominant = c;
      dominantCount = counts[c];
    }
  }
  if (dominantCount / total >= GROWTH_THRESHOLDS.participationTypeDominantShare) {
    return PARTICIPATION_TYPE_LABELS[dominant];
  }
  return '혼합형';
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

    // 저축률/기부율은 그 달에 등원한 아이들 전체를 대상으로 "아이별 비율 → 평균/중앙값"
    // (거래량이 아니라 아이 수로 가중) — 아래 투자 지표도 같은 방식으로 통일했습니다.
    let avgSavingsRate = null;
    let medianSavingsRate = null;
    let savingsRateN = 0;
    let avgDonationRate = null;
    let medianDonationRate = null;
    let donationRateN = 0;
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
      medianSavingsRate = median(rates);
      savingsRateN = rates.length;
      avgDonationRate = avg(donRates);
      medianDonationRate = median(donRates);
      donationRateN = donRates.length;
      depositUserCount = new Set(
        data.deposits.filter((d) => dateStr(d.created_at) >= start && dateStr(d.created_at) < end).map((d) => d.kid_id)
      ).size;
    }

    // 추격매수 비율 등 투자 지표도 "전체 거래 풀링(거래량 가중)"이 아니라 "아이별 비율 →
    // 평균/중앙값"으로 계산합니다(저축률/기부율과 같은 방식으로 통일 — 거래를 많이 한
    // 소수가 집단 지표를 과도하게 끌고 가지 않도록).
    const chase = perKidAvgMedian(monthBuys, chaseBuyRate);
    const over = perKidAvgMedian(monthBuys, (l) => valuationBuyRate(l, 'over'));
    const under = perKidAvgMedian(monthBuys, (l) => valuationBuyRate(l, 'under'));
    const memo = perKidAvgMedian(monthBuys, memoRate);
    const feeProfit = perKidAvgMedian(monthSells, feeToProfitRatio);
    const badNews = perKidAvgMedian(monthSells, (l) => badNewsSellReactRate(l, newsByStock));
    const goodNews = perKidAvgMedian(monthBuys, (l) => goodNewsBuyReactRate(l, newsByStock));

    return {
      month,
      sampleSize: { visitorCount, buyCount: monthBuys.length, sellCount: monthSells.length, jobAppCount: monthJobApps.length },
      insufficient: !enoughVisitors && !enoughBuys,
      savings: enoughVisitors
        ? { avgSavingsRate, medianSavingsRate, savingsRateN, depositUserCount, insufficient: false }
        : { insufficient: true },
      // N은 "최소 거래건수(monthlyGroupMinTradesPerKid) 이상 거래해서 평균에 포함된 아이 수",
      // pooled는 그 N 기준 없이 "그 달 전체 거래를 하나로 합쳐서 계산한 값"(예전 방식, 참고용).
      investing: enoughBuys
        ? {
            chaseBuyRate: chase.avg,
            medianChaseBuyRate: chase.median,
            chaseBuyRateN: chase.kidCount,
            chaseBuyRatePooled: chase.pooled,
            overvaluedBuyRate: over.avg,
            medianOvervaluedBuyRate: over.median,
            overvaluedBuyRateN: over.kidCount,
            overvaluedBuyRatePooled: over.pooled,
            undervaluedBuyRate: under.avg,
            medianUndervaluedBuyRate: under.median,
            undervaluedBuyRateN: under.kidCount,
            undervaluedBuyRatePooled: under.pooled,
            memoRate: memo.avg,
            medianMemoRate: memo.median,
            memoRateN: memo.kidCount,
            memoRatePooled: memo.pooled,
            feeToProfitRatio: feeProfit.avg,
            medianFeeToProfitRatio: feeProfit.median,
            feeToProfitRatioN: feeProfit.kidCount,
            feeToProfitRatioPooled: feeProfit.pooled,
            badNewsSellReactRate: badNews.avg,
            medianBadNewsSellReactRate: badNews.median,
            badNewsSellReactRateN: badNews.kidCount,
            badNewsSellReactRatePooled: badNews.pooled,
            goodNewsBuyReactRate: goodNews.avg,
            medianGoodNewsBuyReactRate: goodNews.median,
            goodNewsBuyReactRateN: goodNews.kidCount,
            goodNewsBuyReactRatePooled: goodNews.pooled,
            insufficient: false,
          }
        : { insufficient: true },
      jobs: monthJobApps.length > 0 ? { completionRate: jobCompletionRate(monthJobApps), insufficient: false } : { insufficient: true },
      donation: enoughVisitors ? { avgDonationRate, medianDonationRate, donationRateN, insufficient: false } : { insufficient: true },
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

    // "참여 안 함"(count=0, 의도적 비참여일 수 있음)과 "표본 부족"(해봤지만 비교할 만큼은
    // 아직 아님)을 구분해서 pending 사유를 표시합니다 — 둘을 같은 "판단 보류"로 묶으면
    // 안 하는 애와 막 시작한 애가 똑같이 보여서 해석이 왜곡됩니다.
    const pendingReason = (count) => (count === 0 ? 'no_activity' : 'insufficient_sample');

    // 등원 구간 기반 지표
    if (visitWindows) {
      const firstSavings = savingsRate(data, kid.id, visitWindows.first.start, visitWindows.first.end);
      const lastSavings = savingsRate(data, kid.id, visitWindows.last.start, visitWindows.last.end);
      metrics.savingsRate = { first: firstSavings, last: lastSavings, verdict: compareDirection(firstSavings, lastSavings, 'up') };

      const firstDonation = donationRate(data, kid.id, visitWindows.first.start, visitWindows.first.end);
      const lastDonation = donationRate(data, kid.id, visitWindows.last.start, visitWindows.last.end);
      metrics.donationRate = { first: firstDonation, last: lastDonation, verdict: compareDirection(firstDonation, lastDonation, 'up') };
    } else {
      metrics.savingsRate = { pending: true, count: visitDates.length, reasonCode: pendingReason(visitDates.length) };
      metrics.donationRate = { pending: true, count: visitDates.length, reasonCode: pendingReason(visitDates.length) };
    }

    // 등원 유지율(등원 간격) — 첫 구간 평균 간격 vs 최근 구간 평균 간격(일). 간격이 줄거나
    // 유지되면 "꾸준히 온다"는 뜻이라 direction은 'down'(줄수록 좋음).
    const visitGapList = visitGaps(visitDates);
    const gapWindows = firstLastN(visitGapList, GROWTH_THRESHOLDS.kidMinVisitsForRetention - 1);
    if (gapWindows) {
      const firstGap = avg(gapWindows.first);
      const lastGap = avg(gapWindows.last);
      metrics.attendanceGapDays = { first: firstGap, last: lastGap, verdict: compareDirection(firstGap, lastGap, 'down') };
    } else {
      metrics.attendanceGapDays = { pending: true, count: visitDates.length, reasonCode: pendingReason(visitDates.length) };
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
      const r = { pending: true, count: kidBuys.length, reasonCode: pendingReason(kidBuys.length) };
      metrics.chaseBuyRate = { ...r };
      metrics.overvaluedBuyRate = { ...r };
      metrics.undervaluedBuyRate = { ...r };
      metrics.memoRate = { ...r };
      metrics.goodNewsBuyReactRate = { ...r };
    }

    // 매도 건수 기반 지표
    if (sellWindows) {
      const feeRatio = { first: feeToProfitRatio(sellWindows.first), last: feeToProfitRatio(sellWindows.last) };
      const badNewsReact = { first: badNewsSellReactRate(sellWindows.first, newsByStock), last: badNewsSellReactRate(sellWindows.last, newsByStock) };
      metrics.feeToProfitRatio = { ...feeRatio, verdict: compareDirection(feeRatio.first, feeRatio.last, 'down') };
      metrics.badNewsSellReactRate = { ...badNewsReact, verdict: compareDirection(badNewsReact.first, badNewsReact.last, 'down') };
    } else {
      const r = { pending: true, count: kidSells.length, reasonCode: pendingReason(kidSells.length) };
      metrics.feeToProfitRatio = { ...r };
      metrics.badNewsSellReactRate = { ...r };
    }

    // 구인시장 — 정원제라 "0건"이 전부 "안 함"은 아닙니다. 그 아이가 등원한 기간 동안
    // 공고 자체가 없었으면 '미노출', 공고가 있었는데도 0건이면 '비참여'로 구분합니다.
    if (jobWindows) {
      const first = jobCompletionRate(jobWindows.first);
      const last = jobCompletionRate(jobWindows.last);
      metrics.jobCompletionRate = { first, last, verdict: compareDirection(first, last, 'up') };
    } else {
      const jobReasonCode =
        kidJobApps.length > 0
          ? 'insufficient_sample'
          : hadOpportunity(data.jobPostings, visitDates)
            ? 'no_activity'
            : 'no_opportunity';
      metrics.jobCompletionRate = { pending: true, count: kidJobApps.length, reasonCode: jobReasonCode };
    }

    // 경제 퀴즈 사전→사후 점수 변화. 재응시가 없는 "딱 한 번씩"이라 다른 지표처럼 "첫 N건 vs
    // 최근 N건" 구간이 아니라, 사전·사후 점수 그 자체를 first/last로 씁니다.
    const preQuiz = data.quizSubmissions.find((q) => q.kid_id === kid.id && q.quiz_type === 'pre');
    const postQuiz = data.quizSubmissions.find((q) => q.kid_id === kid.id && q.quiz_type === 'post');
    if (preQuiz && postQuiz) {
      const firstScore = preQuiz.correct_count / preQuiz.total_count;
      const lastScore = postQuiz.correct_count / postQuiz.total_count;
      metrics.quizScoreChange = { first: firstScore, last: lastScore, verdict: compareDirection(firstScore, lastScore, 'up') };
    } else {
      // 퀴즈는 "응시 자체가 참여"라서 사전조차 안 봤으면 no_activity, 사전만 보고 사후를
      // 아직 안 봤으면(제일 흔한 경우) insufficient_sample로 구분합니다.
      metrics.quizScoreChange = { pending: true, count: preQuiz ? 1 : 0, reasonCode: preQuiz ? 'insufficient_sample' : 'no_activity' };
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
      metrics.assetMaintenanceRatio = {
        pending: true,
        reasonCode: 'insufficient_sample',
        reason: 'kid_visit_snapshots 데이터가 아직 부족함(2단계 이후부터 쌓임)',
      };
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
      metrics.depositPrincipal = { pending: true, count: kidDeposits.length, reasonCode: pendingReason(kidDeposits.length) };
    }

    return {
      kidId: kid.id,
      kidName: kid.name,
      gender: kid.gender || null,
      totalVisits: visitDates.length,
      visitsPending: !visitWindows,
      breadth: engagementBreadth(data, kid.id),
      metrics,
    };
  });
}

/* =====================================================================
   3) getGoalSummary(sb) — 목표별 "개선 N명 / 판단 가능 M명" 요약
   ===================================================================== */

// 3층 구조: ① 참여·정착(프로그램이 정기 참여자에게 자리잡았는가) → ② 경제이해 성장(투자
// 여부와 무관하게 전원 측정 가능한 핵심 효과성 지표) → ③ 영역별 행동 변화(②가 어디서
// 나왔는지 설명하는 보조 근거, 투자/소비/나눔 영역별로 나눔). 예전 4목표(계획적 금융생활/
// 합리적 의사결정/경제 흐름 이해/근로나눔)를 동등하게 나열하던 구조에서, 투자 참여를
// 전제로 하는 지표가 7/13(54%)을 차지해서 투자를 안 하는 청소년은 "효과 없음"처럼 보이던
// 문제를 바로잡기 위해 재구성했습니다(2026-10).
export const GROWTH_STRUCTURE = {
  참여_정착: ['attendanceGapDays'],
  경제이해_성장: ['quizScoreChange'],
  계획적_소비: ['savingsRate', 'depositPrincipal', 'assetMaintenanceRatio'],
  합리적_투자판단: ['chaseBuyRate', 'overvaluedBuyRate', 'undervaluedBuyRate', 'memoRate', 'feeToProfitRatio', 'badNewsSellReactRate', 'goodNewsBuyReactRate'],
  나눔_책임: ['jobCompletionRate', 'donationRate'],
};

// 화면/엑셀에서 "① 참여·정착" 같은 묶음 제목을 붙일 때 쓰는, 각 goal 키가 속한 층 번호.
export const GROWTH_LAYER_OF = {
  참여_정착: 1,
  경제이해_성장: 2,
  계획적_소비: 3,
  합리적_투자판단: 3,
  나눔_책임: 3,
};

// 보존용 — 2026-10-13 재구성 이전에 쓰던 4목표 정의. 시즌 중간에 지표 틀을 바꾼 것이라
// "결과를 보고 유리하게 바꿨다"는 오해를 살 수 있어서, 예전 정의를 코드로 남겨 언제든
// getGoalSummary(sb, opts, LEGACY_GOAL_METRIC_MAP)로 재현 가능하게 해둠(부록 비교용).
// 재구성 시점(2026-10-13) 기준 두 구조로 각각 계산한 결과는 CONTEXT.md에 날짜와 함께
// 기록해뒀습니다 — 재구성 직후 수치가 기존 대비 더 좋게 나오지 않았다는 근거 포함.
export const LEGACY_GOAL_METRIC_MAP = {
  계획적_금융생활: ['savingsRate', 'depositPrincipal', 'assetMaintenanceRatio'],
  합리적_의사결정: ['chaseBuyRate', 'overvaluedBuyRate', 'undervaluedBuyRate', 'memoRate', 'feeToProfitRatio'],
  경제_흐름_이해: ['badNewsSellReactRate', 'goodNewsBuyReactRate', 'quizScoreChange'],
  근로_나눔: ['jobCompletionRate', 'donationRate'],
};

export async function getGoalSummary(sb, { kidId = null, scope = 'all' } = {}, metricMap = GROWTH_STRUCTURE) {
  const kidProgress = await getKidProgress(sb, { kidId, scope });
  const summary = {};

  for (const [goal, metricKeys] of Object.entries(metricMap)) {
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
   3b) getParticipationProfile(sb) — "참여 유형 분포" (① 참여·정착 보조 지표)
   ===================================================================== */
// 투자에 열심인 아이와 그렇지 않은 아이의 참여 격차 때문에 평균이 왜곡될 수 있다는 문제를
// 숫자로 투명하게 보여주기 위한 지표. "몇 명이 몇 가지 영역을 해봤는지" 분포와, 영역별
// 참여 인원을 함께 보여줘서 — 투자를 안 하는 청소년이 많아도 그게 "실패"가 아니라 이
// 프로그램을 다른 방식(소비/이벤트/기부 등)으로 쓰고 있다는 현황을 그대로 드러냅니다.

export async function getParticipationProfile(sb, { kidId = null, scope = 'all' } = {}) {
  const data = await loadRawData(sb);
  const targetKids = scopedKids(data, { kidId, scope });

  const breadthHistogram = {};
  for (let i = 0; i <= ENGAGEMENT_CATEGORIES.length; i++) breadthHistogram[i] = 0;
  const categoryDidCount = Object.fromEntries(ENGAGEMENT_CATEGORIES.map((c) => [c, 0]));
  // job/event는 분모가 "기회가 있었던 아이 수"라서 전체 인원과 다를 수 있음(구인시장
  // 정원제·이벤트는 지도자가 열어야 생기는 기회라, 기회 자체가 없던 아이는 분모에서 뺌).
  const categoryApplicableCount = Object.fromEntries(ENGAGEMENT_CATEGORIES.map((c) => [c, 0]));
  const typeDistribution = {};

  for (const kid of targetKids) {
    const { count, categories } = engagementBreadth(data, kid.id);
    breadthHistogram[count]++;
    for (const c of ENGAGEMENT_CATEGORIES) {
      if (categories[c] === null) continue; // 기회 없음(미노출) — 분모에서 제외
      categoryApplicableCount[c]++;
      if (categories[c]) categoryDidCount[c]++;
    }
    const type = classifyParticipationType(data, kid.id);
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  }

  const totalKids = targetKids.length;
  const pct = (n, denom) => (denom > 0 ? Math.round((n / denom) * 1000) / 10 : null);

  return {
    totalKids,
    breadthHistogram, // { 0: N명, 1: N명, ... } — 0은 "아직 선택 활동을 안 해본" 인원
    noActivityCount: breadthHistogram[0] || 0,
    noActivityPct: pct(breadthHistogram[0] || 0, totalKids),
    categoryParticipation: Object.fromEntries(
      ENGAGEMENT_CATEGORIES.map((c) => [
        c,
        {
          count: categoryDidCount[c],
          applicable: categoryApplicableCount[c],
          pct: pct(categoryDidCount[c], categoryApplicableCount[c]),
        },
      ])
    ),
    // 규칙 기반 참여 유형 분포(투자형/저축형/.../혼합형/저참여형). 군집분석 대신 단순 규칙
    // 사용(표본 30명으로는 군집이 불안정) — growthConfig.js의 participationTypeDominantShare.
    typeDistribution,
  };
}

/* =====================================================================
   3c) getQuizGroupStats(sb) — 경제 퀴즈 사전→사후 집단 통계
   ===================================================================== */
// getGoalSummary의 "개선 N/판단 M건"은 "올랐는지 여부"만 세는데, 그것만으로는 (1) 올랐는지
// 내렸는지 세기만 하고 얼마나 올랐는지는 안 보여주고 (2) 소수가 크게 오르면 평균이 끌려갈
// 수 있어서 중앙값도 필요합니다. 윌콕슨 부호순위 검정(근사)으로 "이 방향성이 우연으로 보기
// 어려운 정도인지"도 참고용으로 같이 냅니다. 비교집단이 없어서 이 결과만으로 "금청코인
// 때문에 올랐다"는 인과 주장은 할 수 없고, "참여 기간 중 향상됨" 수준으로만 해석해야 합니다.
export async function getQuizGroupStats(sb, { kidId = null, scope = 'all' } = {}) {
  const kidProgress = await getKidProgress(sb, { kidId, scope });
  const diffs = [];
  for (const kid of kidProgress) {
    const m = kid.metrics.quizScoreChange;
    if (m && !m.pending) diffs.push(m.last - m.first);
  }
  return {
    n: diffs.length,
    avgDelta: avg(diffs),
    medianDelta: median(diffs),
    upCount: diffs.filter((d) => d > 0).length,
    sameCount: diffs.filter((d) => d === 0).length,
    downCount: diffs.filter((d) => d < 0).length,
    wilcoxon: wilcoxonSignedRank(diffs),
  };
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
   7b) getQuizExportData(sb) — 엑셀 "퀴즈" 시트용 원본(활성 세트의 문항 + 응시 결과)
   ===================================================================== */
// 문항별 정답률은 "지금 활성화된 세트" 기준으로만 계산합니다(관리자가 문제를 교체하면 예전
// 문항 번호와는 비교가 무의미해지므로, 세트를 바꾼 뒤에는 그 시점부터 새로 쌓임).

export async function getQuizExportData(sb, { kidId = null, scope = 'all' } = {}) {
  const [{ data: sets, error: setsErr }] = await Promise.all([sb.from('quiz_sets').select('id, type, title').eq('is_active', true)]);
  if (setsErr) {
    if (isMissingTableError(setsErr)) return { sets: { pre: null, post: null }, submissions: [] };
    throw setsErr;
  }

  const preSet = (sets || []).find((s) => s.type === 'pre') || null;
  const postSet = (sets || []).find((s) => s.type === 'post') || null;
  const setIds = [preSet, postSet].filter(Boolean).map((s) => s.id);

  const raw = await loadRawData(sb);
  const scopeKids = scopedKids(raw, { kidId, scope });
  const scopeSet = new Set(scopeKids.map((k) => k.id));
  const nameById = new Map(scopeKids.map((k) => [k.id, k.name]));

  const submissions = raw.quizSubmissions
    .filter((q) => scopeSet.has(q.kid_id))
    .map((q) => ({ ...q, kidName: nameById.get(q.kid_id) }));

  if (setIds.length === 0) return { sets: { pre: preSet, post: postSet }, submissions };

  const { data: questions, error: qErr } = await sb
    .from('quiz_questions')
    .select('id, quiz_set_id, order_index, question, choices, correct_index')
    .in('quiz_set_id', setIds)
    .order('order_index', { ascending: true });
  if (qErr) throw qErr;

  const { data: fullSubmissions, error: subErr } = await sb
    .from('quiz_submissions')
    .select('kid_id, quiz_set_id, quiz_type, answers, correct_count, total_count')
    .in('quiz_set_id', setIds);
  if (subErr) throw subErr;

  return {
    sets: {
      pre: preSet ? { ...preSet, questions: (questions || []).filter((q) => q.quiz_set_id === preSet.id) } : null,
      post: postSet ? { ...postSet, questions: (questions || []).filter((q) => q.quiz_set_id === postSet.id) } : null,
    },
    submissions,
    fullSubmissions: (fullSubmissions || []).filter((s) => scopeSet.has(s.kid_id)),
  };
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

const CATEGORY_LABEL = { investing: '투자', saving: '예금', donation: '기부', job: '구인시장', event: '이벤트', quiz: '퀴즈' };

export async function buildReportSentences(sb, { kidId = null, scope = 'all' } = {}) {
  const monthly = await getMonthlyGroupMetrics(
    sb,
    addMonths(monthKey(new Date().toISOString()), -11) + '-01',
    new Date().toISOString().slice(0, 10),
    { kidId, scope }
  );
  const goalSummary = await getGoalSummary(sb, { kidId, scope });
  const profile = await getParticipationProfile(sb, { kidId, scope });
  const quizStats = await getQuizGroupStats(sb, { kidId, scope });
  const sentences = [];

  // 경제이해 성장(퀴즈 사전→사후)은 투자 여부와 무관하게 전원 측정 가능한 유일한 지표라서
  // 맨 앞에 핵심 지표로 올립니다. 평균 향상 비율만이 아니라 중앙값·상승/동일/하락 인원·
  // 윌콕슨 부호순위 검정(근사, n<5면 생략)까지 같이 내고, 비교집단이 없다는 한계를 명시합니다.
  if (quizStats.n === 0) {
    sentences.push('경제이해 성장(핵심 지표): 아직 사전·사후 퀴즈를 모두 응시한 청소년이 없어요(표본 부족)');
  } else {
    const d = quizStats;
    let line = `경제이해 성장(핵심 지표): 사전·사후 퀴즈를 모두 응시한 ${d.n}명 중 상승 ${d.upCount}명 · 동일 ${d.sameCount}명 · 하락 ${d.downCount}명 (평균 변화 ${d.avgDelta >= 0 ? '+' : ''}${Math.round(d.avgDelta * 1000) / 10}%p, 중앙값 ${d.medianDelta >= 0 ? '+' : ''}${Math.round(d.medianDelta * 1000) / 10}%p)`;
    line += ` — ${wilcoxonLabel(d.wilcoxon)}`;
    sentences.push(line);
    sentences.push('※ 비교집단이 없어 이 변화를 "금청코인 때문"이라고 단정할 수 없고, "참여 기간 중 경제 이해가 향상됨" 수준으로 해석해야 해요. 사전·사후 문항이 똑같으면 실력 향상과 "문제를 외워서"를 구분할 수 없으니 서로 다른 문항으로 구성하는 걸 권장해요.');
  }

  // 참여 유형 분포 — 투자에 열심인 아이와 그렇지 않은 아이의 격차 때문에 평균이 왜곡될 수
  // 있다는 걸 투명하게 보여주기 위한 현황(문제가 아니라 현황으로 기술). 구인시장/이벤트는
  // 기회가 없었던 아이를 분모에서 뺀 비율이에요.
  if (profile.totalKids > 0) {
    const catLine = ENGAGEMENT_CATEGORIES.map((c) => {
      const p = profile.categoryParticipation[c];
      const gated = c === 'job' || c === 'event';
      return gated
        ? `${CATEGORY_LABEL[c]} ${p.count}명(기회 있었던 ${p.applicable}명 중 ${p.pct == null ? '집계 불가' : p.pct + '%'})`
        : `${CATEGORY_LABEL[c]} ${p.count}명(${p.pct}%)`;
    }).join(' · ');
    sentences.push(`영역별 참여 인원(전체 ${profile.totalKids}명 중): ${catLine}`);

    const sumRange = (fromI, toI) => {
      let s = 0;
      for (let i = fromI; i <= toI; i++) s += profile.breadthHistogram[i] || 0;
      return s;
    };
    const low = sumRange(0, 1);
    const mid = sumRange(2, 3);
    const high = sumRange(4, ENGAGEMENT_CATEGORIES.length);
    sentences.push(
      `경험 다양성 분포: 0~1개 영역 ${low}명 · 2~3개 영역 ${mid}명 · 4개 이상 영역 ${high}명 (활동을 전혀 안 해본 청소년 ${profile.noActivityCount}명도 간식·이벤트 등으로 프로그램을 이용 중일 수 있어 "저조"가 아니라 "현황"으로 해석해야 함)`
    );

    const typeLine = Object.entries(profile.typeDistribution)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type} ${n}명`)
      .join(' · ');
    sentences.push(`참여 유형(규칙 기반, 한 영역이 활동의 40% 이상이면 그 유형): ${typeLine}`);
  }

  const validMonths = monthly.months.filter((m) => !m.insufficient);
  if (validMonths.length >= 2) {
    const first = validMonths[0];
    const last = validMonths[validMonths.length - 1];
    if (first.investing && !first.investing.insufficient && last.investing && !last.investing.insufficient) {
      const pp = Math.round((last.investing.chaseBuyRate - first.investing.chaseBuyRate) * 1000) / 10;
      sentences.push(
        `추격매수 비율 ${pctStr(first.investing.chaseBuyRate)} → ${pctStr(last.investing.chaseBuyRate)}(${pp >= 0 ? '+' : ''}${pp}%p, 참여 ${first.investing.chaseBuyRateN}명→${last.investing.chaseBuyRateN}명)`
      );
    }
    if (first.savings && !first.savings.insufficient && last.savings && !last.savings.insufficient) {
      const pp = Math.round((last.savings.avgSavingsRate - first.savings.avgSavingsRate) * 1000) / 10;
      sentences.push(
        `평균 저축률 ${pctStr(first.savings.avgSavingsRate)} → ${pctStr(last.savings.avgSavingsRate)}(${pp >= 0 ? '+' : ''}${pp}%p, 참여 ${first.savings.savingsRateN}명→${last.savings.savingsRateN}명)`
      );
    }
  }

  for (const [goal, s] of Object.entries(goalSummary)) {
    if (goal === '경제이해_성장') continue; // 위에서 이미 단독으로 다룸
    // 참여·정착(등원 유지율)은 학교 일정·아카데미 자체 운영 등 외부 요인 영향이 커서
    // "개선"이라는 효과성 언어를 쓰지 않고 현황으로만 기술합니다.
    if (goal === '참여_정착') {
      sentences.push(
        s.judgable === 0
          ? '참여·정착(현황, 효과 단정 금지): 등원 유지율을 판단할 수 있는 청소년이 아직 없어요(표본 부족)'
          : `참여·정착(현황, 효과 단정 금지): 등원 간격이 유지/감소한 청소년 ${s.improved}/${s.judgable}명(${s.pct}%) — 학교 일정 등 외부 요인 영향이 커서 이것만으로 "금청코인 효과"라 보기는 어려움`
      );
      continue;
    }
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
  const profile = await getParticipationProfile(sb, { kidId, scope });
  const quizStats = await getQuizGroupStats(sb, { kidId, scope });
  const monthly = await getMonthlyGroupMetrics(
    sb,
    addMonths(monthKey(new Date().toISOString()), -11) + '-01',
    new Date().toISOString().slice(0, 10),
    { kidId, scope }
  );

  const sentences = [];

  // 경제이해 성장(퀴즈 사전→사후)은 투자 참여와 무관하게 전원 측정 가능한 핵심 효과성
  // 지표라서, 다른 목표들과 평균 내지 않고 맨 앞에 단독으로 짚습니다. 비교집단이 없다는
  // 한계를 항상 같이 적어서 "금청코인 때문"이라는 인과 주장으로 읽히지 않게 합니다.
  if (quizStats.n === 0) {
    sentences.push('경제이해 성장(핵심 지표)은 아직 사전·사후 퀴즈를 모두 응시한 청소년이 없어 판단을 보류해요.');
  } else {
    sentences.push(
      `경제이해 성장(핵심 지표)은 사전·사후 퀴즈를 모두 응시한 ${quizStats.n}명 중 ${quizStats.upCount}명이 점수가 올랐어요(중앙값 변화 ${quizStats.medianDelta >= 0 ? '+' : ''}${Math.round(quizStats.medianDelta * 1000) / 10}%p, ${wilcoxonLabel(quizStats.wilcoxon)}). 다만 비교집단이 없어서 "금청코인 때문"이라고 단정하긴 어렵고, 참여 기간 중 경제 이해가 향상된 것으로 해석하는 게 정확해요.`
    );
  }

  // 참여·정착(등원 유지율)은 학교 일정 등 외부 요인 영향이 커서 "효과"로 단정하지 않고
  // 현황으로만 짚습니다 — 그래서 아래 best/worst 비교에서도 경제이해 성장과 함께 뺍니다.
  const attendanceGoal = goalSummary['참여_정착'];
  if (attendanceGoal) {
    sentences.push(
      attendanceGoal.judgable === 0
        ? '참여·정착(현황)은 등원 유지율을 판단할 수 있는 청소년이 아직 없어요.'
        : `참여·정착(현황)은 등원 간격이 유지/감소한 청소년이 ${attendanceGoal.improved}/${attendanceGoal.judgable}명(${attendanceGoal.pct}%)이에요 — 다만 등원은 학교 일정·아카데미 자체 운영 영향이 커서 "금청코인 효과"로 단정하기보다 현황으로만 참고해야 해요.`
    );
  }

  // 나머지 목표(영역별 행동 변화)는 서로 비교해서 가장 뚜렷한/더딘 영역을 짚되, 위에서 이미
  // 단독으로 다룬 경제이해 성장·참여·정착은 이 비교에서 빼서 중복·과소평가를 막습니다.
  const entries = Object.entries(goalSummary).filter(([g]) => g !== '경제이해_성장' && g !== '참여_정착');
  const judgable = entries.filter(([, s]) => s.judgable > 0);
  const insufficient = entries.filter(([, s]) => s.judgable === 0).map(([g]) => g.replaceAll('_', ' '));

  if (judgable.length === 0) {
    sentences.push('그 외 목표는 아직 개선 여부를 판단할 수 있는 표본이 부족해요. 청소년들의 등원·매매·예금 등 기록이 더 쌓이면 채워질 거예요.');
    if (profile.totalKids > 0) {
      sentences.push(
        `참여 현황: 전체 ${profile.totalKids}명 중 투자·예금·기부·구인·이벤트·퀴즈 중 어느 것도 아직 안 해본 청소년이 ${profile.noActivityCount}명(${profile.noActivityPct}%)이에요 — 간식·상점 이용 자체를 즐기고 있을 수 있어 이게 곧 "저조"를 뜻하진 않아요.`
      );
    }
    return sentences.join(' ');
  }

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

  if (profile.totalKids > 0 && profile.noActivityCount > 0) {
    sentences.push(
      `전체 ${profile.totalKids}명 중 ${profile.noActivityCount}명(${profile.noActivityPct}%)은 투자·예금·기부·구인·이벤트·퀴즈 중 어느 것도 아직 안 해봤어요 — 간식·상점 이용 자체를 즐기는 경우일 수 있어 "저조"보다는 "다른 방식의 참여"로 함께 봐야 해요.`
    );
  }

  return sentences.join(' ');
}
