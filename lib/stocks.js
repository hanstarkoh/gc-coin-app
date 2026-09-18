import { randomHeadline, sectorWideHeadline } from './stockNews';

const MAX_DAILY_CHANGE = 0.08; // 평소(토요일 활동시간 외) 하루 등락폭 ±8%
const HOURLY_CHANGE = 0.03; // 토요일 활동시간 중 매시 등락폭 ±3%
export const TRADE_FEE_RATE = 0.02; // 매수/매도 수수료 2%

// 청소년들이 실제로 수련관에 오는 시간(토요일 9~19시, KST)
const SESSION_DAY = 6; // 0=일 ... 6=토
const SESSION_START_HOUR = 9;
const SESSION_END_HOUR = 18; // 이 시각의 정각~59분까지 포함 (9~18시 총 10번 갱신)

// 실시간 분위기(매수/매도 몰림) 표시 기준. 이번 구간에 주문이 이 개수 이상 쌓이고,
// 매수/매도 쏠림이 이 비율 이상이어야 배너를 띄웁니다(주문 1~2건만으로 뜨는 걸 방지).
export const SENTIMENT_MIN_ORDERS = 3;
export const SENTIMENT_SKEW_THRESHOLD = 0.34;

// 거래 금액이 작으면(지금 시세대) 2%를 반올림하면 0GC가 돼서 사실상 무료로 거래되던
// 문제가 있었음. 실제 증권사들의 "최소 수수료"처럼 거래가 있으면 최소 1GC는 걷히게 함.
// rate는 매수 시 추격매수 할증이 붙을 수 있어 인자로 받습니다(매도는 항상 기본 rate).
export function calcFee(amount, rate = TRADE_FEE_RATE) {
  if (amount <= 0) return 0;
  return Math.max(1, Math.round(amount * rate));
}

// 최근 많이 오른 종목을 추격 매수할수록 수수료를 더 물립니다(매도엔 적용 안 함).
// recentChangePct가 15%를 넘는 순간부터 할증이 붙고, 최대 +8%p까지 붙어요.
export const CHASE_FEE_THRESHOLD = 0.15;
export const CHASE_FEE_MAX_SURCHARGE = 0.08;
const CHASE_FEE_SLOPE = 0.4;
export const MOMENTUM_LOOKBACK = 5;

export function chaseFeeSurcharge(recentChangePct) {
  if (!recentChangePct || recentChangePct <= CHASE_FEE_THRESHOLD) return 0;
  return Math.min(CHASE_FEE_MAX_SURCHARGE, (recentChangePct - CHASE_FEE_THRESHOLD) * CHASE_FEE_SLOPE);
}

// prices: 오래된 -> 최신 순서의 시세 배열. 최근 MOMENTUM_LOOKBACK틱 동안의 등락률을 구합니다.
export function momentumFromHistory(prices) {
  if (!prices || prices.length < 2) return 0;
  const lookback = Math.min(MOMENTUM_LOOKBACK, prices.length - 1);
  const base = prices[prices.length - 1 - lookback];
  const current = prices[prices.length - 1];
  if (!base) return 0;
  return (current - base) / base;
}

export function buyFeeRate(recentChangePct) {
  return TRADE_FEE_RATE + chaseFeeSurcharge(recentChangePct);
}

// 관리자가 뉴스 이벤트로 발표하는 등락률(%)을 실제 가격에 확정적으로(그날의 무작위 변동과는
// 별개로) 반영합니다.
export function applyNewsPriceChange(price, pct) {
  const rawDelta = (price * pct) / 100;
  const delta = rawDelta === 0 ? 0 : Math.sign(rawDelta) * Math.max(1, Math.round(Math.abs(rawDelta)));
  return Math.max(1, price + delta);
}

// 뉴스 등락률은 관리자가 직접 숫자를 정하지 않고, 호재/악재 방향만 고르면 그 폭은
// 무작위로 정해집니다(진짜 뉴스처럼 "발표는 했는데 반응은 예측 못 하는" 느낌).
export const NEWS_PCT_MIN = 5;
export const NEWS_PCT_MAX = 20;

export function randomNewsPct(direction) {
  const magnitude = NEWS_PCT_MIN + Math.floor(Math.random() * (NEWS_PCT_MAX - NEWS_PCT_MIN + 1));
  return direction === 'down' ? -magnitude : magnitude;
}

// 시세 갱신마다 이 확률로 종목에 자동 뉴스가 터집니다(관리자가 직접 안 눌러도).
// 진짜 뉴스처럼 "어제 호재였는데 오늘 갑자기 악재" 같은 부자연스러운 반전이 잘 안 나오게,
// 직전 뉴스와 같은 방향이 나올 확률(NEWS_DIRECTION_STICKINESS)을 높게 잡아서 며칠씩
// 호재/악재 흐름이 이어지다가 가끔 뒤집히는 느낌을 냅니다.
export const AUTO_NEWS_CHANCE = 0.12;
export const NEWS_DIRECTION_STICKINESS = 0.7;

// 업종 전체가 같이 움직이는 뉴스(드묾) — 같은 업종 종목이 2개 이상일 때만 발동합니다.
export const SECTOR_NEWS_CHANCE = 0.04;

// 종목별로 남겨두는 뉴스 개수(그 이상은 자동으로 지워서 용량을 아낍니다).
export const STOCK_NEWS_KEEP = 5;

export function decideNewsDirection(lastDirection) {
  if (!lastDirection) return Math.random() < 0.5 ? 'up' : 'down';
  const keepsSame = Math.random() < NEWS_DIRECTION_STICKINESS;
  if (keepsSame) return lastDirection;
  return lastDirection === 'up' ? 'down' : 'up';
}

// skew: -1(전부 매도) ~ +1(전부 매수). 시세 갱신 시 이 구간 동안의 매수/매도 쏠림만큼
// 무작위 변동폭 자체를 위/아래로 밀어서, "매수 몰리면 오르고 매도 몰리면 내리는" 느낌을 냅니다.
// 계수(0.6)를 곱해서, 한쪽으로 완전히 쏠려도(skew=±1) 반대 방향으로 갈 가능성이 남아있게
// 함 — 매수만 계속 일어나는 구조적 특성(공매도가 없어 매도보다 매수가 항상 많음)과 겹쳐서
// 시세가 한쪽으로만 우상향하는 걸 막기 위함입니다.
const SKEW_WEIGHT = 0.6;

// "적정가(최근 평균가)"로 돌아가려는 힘. 실제 투자에서 "고평가/저평가면 결국 제 가치를
// 찾아간다"는 평균회귀 개념을 그대로 씁니다. 관리자 개입 없이도 자동으로 작동하고,
// 적정가 자체가 최근 흐름을 따라가는 이동평균이라 진짜 장기 추세는 그대로 반영돼요 —
// 짧은 시간에 확 튄 가격만 눌러줍니다.
export const MEAN_REVERSION_WINDOW = 14;
export const MEAN_REVERSION_STRENGTH = 0.35;
export const VALUATION_THRESHOLD = 0.15; // 적정가 대비 이 이상 벗어나면 고평가/저평가 배지 표시

// prices: 오래된 -> 최신 순서의 시세 배열(현재가 포함). 최근 window개의 평균("적정가")을 구합니다.
export function movingAverage(prices, window = MEAN_REVERSION_WINDOW) {
  if (!prices || prices.length === 0) return null;
  const slice = prices.slice(-window);
  return slice.reduce((s, p) => s + p, 0) / slice.length;
}

// avgPrice 대비 현재가가 얼마나 벗어났는지에 비례해 반대 방향으로 당기는 pct를 구합니다.
// 하루/시간당 변동 상한(rate)만큼만 당기게 캡을 씌워서 한 번에 너무 세게 안 튀게 합니다.
export function meanReversionPct(price, avgPrice, rate) {
  if (!avgPrice || avgPrice <= 0 || price <= 0) return 0;
  const deviation = (avgPrice - price) / price;
  const pull = deviation * MEAN_REVERSION_STRENGTH;
  return Math.max(-rate, Math.min(rate, pull));
}

// avgPrice 대비 얼마나 벗어났는지로 "고평가/저평가" 상태를 반환합니다(그 사이면 null).
export function valuationStatus(price, avgPrice) {
  if (!avgPrice || avgPrice <= 0) return null;
  const diff = (price - avgPrice) / avgPrice;
  if (diff >= VALUATION_THRESHOLD) return 'over';
  if (diff <= -VALUATION_THRESHOLD) return 'under';
  return null;
}

export function randomizePrice(price, rate = MAX_DAILY_CHANGE, skew = 0, reversionPct = 0) {
  const pct = (Math.random() * 2 - 1) * rate + skew * rate * SKEW_WEIGHT + reversionPct;
  const rawDelta = price * pct;
  // 가격이 낮은 종목은 %변동폭이 반올림되면서 0이 돼버려 "항상 그대로"인 문제가 있었음.
  // 그래서 변동 방향이 정해졌으면(=pct가 0이 아니면) 최소 ±1GC는 움직이게 바닥을 깔아줌.
  const delta = rawDelta === 0 ? 0 : Math.sign(rawDelta) * Math.max(1, Math.round(Math.abs(rawDelta)));
  return Math.max(1, price + delta);
}

// 주문 건수 기준(수량 가중치 없음)으로 매수/매도 쏠림을 계산합니다.
// "몇 명이 사고팔았는지"에 가까운 체감을 주기 위해 1건=1표로 셉니다.
function skewFromOrders(orders) {
  let buy = 0;
  let sell = 0;
  for (const o of orders) {
    if (o.type === 'buy') buy++;
    else sell++;
  }
  const total = buy + sell;
  return { buy, sell, total, skew: total > 0 ? (buy - sell) / total : 0 };
}

// 서버는 보통 UTC로 도니까, KST(UTC+9) 기준 요일/시간을 알아내기 위한 보정.
// 한국은 서머타임이 없어서 고정 오프셋으로 계산해도 안전합니다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstNow() {
  return new Date(Date.now() + KST_OFFSET_MS);
}

// 오늘(KST 기준) 자정의 UTC 시각 — "오늘 뉴스만" 필터링에 씁니다.
export function todayStartUtcIso() {
  const dayStart = kstNow();
  dayStart.setUTCHours(0, 0, 0, 0);
  return new Date(dayStart.getTime() - KST_OFFSET_MS).toISOString();
}

function isSaturdaySession(kst) {
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  return day === SESSION_DAY && hour >= SESSION_START_HOUR && hour <= SESSION_END_HOUR;
}

// 현재가 속한 "갱신 구간"의 시작 시각(UTC)을 구합니다.
// 토요일 활동시간(9~19시)에는 1시간 단위, 그 외에는 하루 단위로 구간을 나눕니다.
function currentBucketStartUTC(kst, active) {
  const bucket = new Date(kst.getTime());
  if (active) {
    bucket.setUTCMinutes(0, 0, 0);
  } else {
    bucket.setUTCHours(0, 0, 0, 0);
  }
  return new Date(bucket.getTime() - KST_OFFSET_MS);
}

function bucketDurationMs(active) {
  return active ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

// 활성 종목의 시세를 갱신합니다.
// force=false: 이번 갱신 구간(토요일 활동시간엔 이번 시간대, 그 외엔 오늘)에 이미 갱신된
//   종목은 건너뜁니다. 사용자 트래픽에 얹혀 호출되므로 중복 갱신을 막기 위함입니다.
// force=true: 무조건 새 시세로 갱신합니다. (관리자 수동 갱신용)
// 종목별로 뉴스를 최근 N개만 남기고 오래된 건 지웁니다(계속 쌓이지 않도록).
export async function pruneStockNews(sb, stockId, keep = STOCK_NEWS_KEEP) {
  try {
    const { data, error } = await sb
      .from('stock_news')
      .select('id')
      .eq('stock_id', stockId)
      .order('created_at', { ascending: false })
      .range(keep, keep + 200);
    if (error || !data || data.length === 0) return;
    await sb.from('stock_news').delete().in('id', data.map((r) => r.id));
  } catch {
    // 정리 실패는 무시 — 다음 뉴스 때 다시 시도됩니다.
  }
}

// 뉴스를 적정가 대비 과열 여부에 따라 절반으로 줄여서 반영하고, stock_news에 기록합니다.
// 개별 종목 자동 뉴스/업종 전체 뉴스 양쪽에서 공유합니다.
async function applyNewsToStock(sb, stock, direction, pct, headline, avgPrice) {
  let candidatePrice = applyNewsPriceChange(stock.price, pct);
  if (avgPrice) {
    const overshoot = (candidatePrice - avgPrice) / avgPrice;
    const overheating =
      (direction === 'up' && overshoot > VALUATION_THRESHOLD) || (direction === 'down' && overshoot < -VALUATION_THRESHOLD);
    if (overheating) candidatePrice = Math.round((stock.price + candidatePrice) / 2);
  }
  const nextPrice = Math.max(1, candidatePrice);

  const newsRow = {
    stock_id: stock.id,
    stock_name: stock.name,
    headline,
    pct,
    old_price: stock.price,
    new_price: nextPrice,
    source: 'auto',
  };
  const { error: newsInsErr } = await sb.from('stock_news').insert(newsRow);
  if (newsInsErr) {
    // source 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니 없이 재시도합니다.
    const { source, ...withoutSource } = newsRow;
    const fallback = await sb.from('stock_news').insert(withoutSource);
    if (fallback.error) throw fallback.error;
  }
  await pruneStockNews(sb, stock.id);
  return nextPrice;
}

async function fetchAvgPrice(sb, stockId) {
  const { data: recentHistory, error } = await sb
    .from('stock_price_history')
    .select('price')
    .eq('stock_id', stockId)
    .order('recorded_at', { ascending: false })
    .limit(MEAN_REVERSION_WINDOW);
  if (error) throw error;
  return movingAverage((recentHistory || []).map((h) => h.price).reverse());
}

export async function updateStockPrices(sb, { force = false } = {}) {
  let { data: stocks, error: stocksErr } = await sb
    .from('stocks')
    .select('id, name, price, sector')
    .eq('is_active', true);
  if (stocksErr) {
    // sector 컬럼이 아직 없는(마이그레이션 전) 상태일 수 있으니, 그 컬럼 없이 재시도해서
    // 시세 갱신 자체가 통째로 막히는 걸 막습니다(자동 뉴스는 sector 없이 일반 헤드라인으로).
    const fallback = await sb.from('stocks').select('id, name, price').eq('is_active', true);
    if (fallback.error) throw fallback.error;
    stocks = fallback.data.map((s) => ({ ...s, sector: null }));
  }

  const kst = kstNow();
  const active = isSaturdaySession(kst);
  const rate = active ? HOURLY_CHANGE : MAX_DAILY_CHANGE;
  const bucketStart = currentBucketStartUTC(kst, active);
  const prevBucketStart = new Date(bucketStart.getTime() - bucketDurationMs(active));
  let updated = 0;

  const stockIds = stocks.map((s) => s.id);

  // 방금 끝난 구간(직전 시간/직전 날) 동안의 매수/매도 건수로 이번 시세 변동 방향을 살짝 밀어줍니다.
  const ordersByStock = new Map();
  if (stockIds.length > 0) {
    const { data: prevOrders, error: ordersErr } = await sb
      .from('stock_orders')
      .select('stock_id, type')
      .in('stock_id', stockIds)
      .gte('created_at', prevBucketStart.toISOString())
      .lt('created_at', bucketStart.toISOString());
    if (ordersErr) throw ordersErr;
    for (const o of prevOrders) {
      if (!ordersByStock.has(o.stock_id)) ordersByStock.set(o.stock_id, []);
      ordersByStock.get(o.stock_id).push(o);
    }
  }

  // 종목별 가장 최근 뉴스 방향(있으면) — 자동 뉴스가 같은 방향으로 이어지게 하는 데 씁니다.
  const lastNewsDirectionByStock = new Map();
  if (stockIds.length > 0) {
    const { data: recentNews, error: newsErr } = await sb
      .from('stock_news')
      .select('stock_id, pct, created_at')
      .in('stock_id', stockIds)
      .order('created_at', { ascending: false });
    if (newsErr) throw newsErr;
    for (const n of recentNews || []) {
      if (!lastNewsDirectionByStock.has(n.stock_id)) {
        lastNewsDirectionByStock.set(n.stock_id, n.pct > 0 ? 'up' : 'down');
      }
    }
  }

  // 이번 실행에서 업종 전체 뉴스로 이미 처리한 종목은 아래 개별 루프에서 건너뜁니다.
  const handledStockIds = new Set();

  // 드물게(업종당 4%) 업종 전체가 같이 움직이는 뉴스를 냅니다 — 종목 2개 이상인 업종만 대상.
  if (Math.random() < SECTOR_NEWS_CHANCE) {
    const stocksBySector = new Map();
    for (const s of stocks) {
      if (!s.sector) continue;
      if (!stocksBySector.has(s.sector)) stocksBySector.set(s.sector, []);
      stocksBySector.get(s.sector).push(s);
    }
    const eligibleSectors = [...stocksBySector.entries()].filter(([, list]) => list.length >= 2);
    if (eligibleSectors.length > 0) {
      const [sector, sectorStocks] = eligibleSectors[Math.floor(Math.random() * eligibleSectors.length)];
      const direction = Math.random() < 0.5 ? 'up' : 'down';
      const pct = randomNewsPct(direction);
      const headline = sectorWideHeadline(sector, direction) || randomHeadline(sector, direction);

      for (const stock of sectorStocks) {
        if (!force) {
          const { data: bucketHistory, error: histErr } = await sb
            .from('stock_price_history')
            .select('id')
            .eq('stock_id', stock.id)
            .gte('recorded_at', bucketStart.toISOString())
            .limit(1);
          if (histErr) throw histErr;
          if (bucketHistory.length > 0) {
            handledStockIds.add(stock.id);
            continue;
          }
        }

        const avgPrice = await fetchAvgPrice(sb, stock.id);
        const nextPrice = await applyNewsToStock(sb, stock, direction, pct, headline, avgPrice);
        lastNewsDirectionByStock.set(stock.id, direction);

        const { error: updErr } = await sb.from('stocks').update({ price: nextPrice }).eq('id', stock.id);
        if (updErr) throw updErr;
        const { error: histInsErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: nextPrice });
        if (histInsErr) throw histInsErr;

        handledStockIds.add(stock.id);
        updated++;
      }
    }
  }

  for (const stock of stocks) {
    if (handledStockIds.has(stock.id)) continue;

    if (!force) {
      const { data: bucketHistory, error: histErr } = await sb
        .from('stock_price_history')
        .select('id')
        .eq('stock_id', stock.id)
        .gte('recorded_at', bucketStart.toISOString())
        .limit(1);
      if (histErr) throw histErr;
      if (bucketHistory.length > 0) continue;
    }

    // 뉴스든 아니든 "적정가"는 항상 필요해서 한 번만 조회해서 공유합니다.
    const avgPrice = await fetchAvgPrice(sb, stock.id);

    let nextPrice;
    if (Math.random() < AUTO_NEWS_CHANCE) {
      // 이번 갱신은 무작위 변동 대신 뉴스 이벤트로 대체합니다(실제로도 큰 뉴스가 있는 날은
      // 그날 시세가 그 뉴스로 설명되지, 뉴스+별개의 랜덤 변동이 같이 오진 않으니까요).
      const direction = decideNewsDirection(lastNewsDirectionByStock.get(stock.id));
      const pct = randomNewsPct(direction);
      const headline = randomHeadline(stock.sector, direction);
      nextPrice = await applyNewsToStock(sb, stock, direction, pct, headline, avgPrice);
      lastNewsDirectionByStock.set(stock.id, direction);
    } else {
      const { skew } = skewFromOrders(ordersByStock.get(stock.id) || []);
      const reversionPct = meanReversionPct(stock.price, avgPrice, rate);
      nextPrice = randomizePrice(stock.price, rate, skew, reversionPct);
    }

    const { error: updErr } = await sb.from('stocks').update({ price: nextPrice }).eq('id', stock.id);
    if (updErr) throw updErr;

    const { error: histInsErr } = await sb.from('stock_price_history').insert({ stock_id: stock.id, price: nextPrice });
    if (histInsErr) throw histInsErr;

    updated++;
  }

  return { updated, total: stocks.length, active };
}

// 읽기 전용 요청(홈 화면, 청소년 시세 조회)에 얹어서 "때가 됐으면 갱신"하는 용도.
// 실패해도 원래 요청을 막으면 안 되므로 에러를 삼킵니다.
export async function maybeUpdateStockPrices(sb) {
  try {
    await updateStockPrices(sb, { force: false });
  } catch (e) {
    // 조용히 무시 - 다음 요청에서 다시 시도됩니다.
  }
}

// 지금 진행 중인 구간에 쌓이고 있는 매수/매도 쏠림을 보여주기 위한 실시간 분위기.
// 다음 시세 갱신에 반영될 방향을 미리 살짝 보여주는 셈이라, 화면에는
// "매수가 많아지고 있어요!" / "매도가 많아지고 있어요!" 배너로 씁니다.
export async function getLiveSentiments(sb, stockIds) {
  if (!stockIds || stockIds.length === 0) return {};
  try {
    const kst = kstNow();
    const active = isSaturdaySession(kst);
    const bucketStart = currentBucketStartUTC(kst, active);

    const { data: orders, error } = await sb
      .from('stock_orders')
      .select('stock_id, type')
      .in('stock_id', stockIds)
      .gte('created_at', bucketStart.toISOString());
    if (error) throw error;

    const grouped = new Map();
    for (const o of orders) {
      if (!grouped.has(o.stock_id)) grouped.set(o.stock_id, []);
      grouped.get(o.stock_id).push(o);
    }

    const result = {};
    for (const id of stockIds) {
      const { total, skew } = skewFromOrders(grouped.get(id) || []);
      result[id] = total >= SENTIMENT_MIN_ORDERS && Math.abs(skew) >= SENTIMENT_SKEW_THRESHOLD
        ? (skew > 0 ? 'buy' : 'sell')
        : null;
    }
    return result;
  } catch (e) {
    return {};
  }
}
