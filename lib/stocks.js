const MAX_DAILY_CHANGE = 0.08; // 평소(토요일 활동시간 외) 하루 등락폭 ±8%
const HOURLY_CHANGE = 0.03; // 토요일 활동시간 중 매시 등락폭 ±3%
export const TRADE_FEE_RATE = 0.02; // 매수/매도 수수료 2%

// 청소년들이 실제로 수련관에 오는 시간(토요일 10~15시, KST)
const SESSION_DAY = 6; // 0=일 ... 6=토
const SESSION_START_HOUR = 10;
const SESSION_END_HOUR = 14; // 이 시각의 정각~59분까지 포함 (10,11,12,13,14시 총 5번 갱신)

// 실시간 분위기(매수/매도 몰림) 표시 기준. 이번 구간에 주문이 이 개수 이상 쌓이고,
// 매수/매도 쏠림이 이 비율 이상이어야 배너를 띄웁니다(주문 1~2건만으로 뜨는 걸 방지).
export const SENTIMENT_MIN_ORDERS = 3;
export const SENTIMENT_SKEW_THRESHOLD = 0.34;

export function calcFee(amount) {
  return Math.round(amount * TRADE_FEE_RATE);
}

// skew: -1(전부 매도) ~ +1(전부 매수). 시세 갱신 시 이 구간 동안의 매수/매도 쏠림만큼
// 무작위 변동폭 자체를 위/아래로 밀어서, "매수 몰리면 오르고 매도 몰리면 내리는" 느낌을 냅니다.
export function randomizePrice(price, rate = MAX_DAILY_CHANGE, skew = 0) {
  const pct = (Math.random() * 2 - 1) * rate + skew * rate;
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

function isSaturdaySession(kst) {
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  return day === SESSION_DAY && hour >= SESSION_START_HOUR && hour <= SESSION_END_HOUR;
}

// 현재가 속한 "갱신 구간"의 시작 시각(UTC)을 구합니다.
// 토요일 활동시간(10~15시)에는 1시간 단위, 그 외에는 하루 단위로 구간을 나눕니다.
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
export async function updateStockPrices(sb, { force = false } = {}) {
  const { data: stocks, error: stocksErr } = await sb
    .from('stocks')
    .select('id, price')
    .eq('is_active', true);
  if (stocksErr) throw stocksErr;

  const kst = kstNow();
  const active = isSaturdaySession(kst);
  const rate = active ? HOURLY_CHANGE : MAX_DAILY_CHANGE;
  const bucketStart = currentBucketStartUTC(kst, active);
  const prevBucketStart = new Date(bucketStart.getTime() - bucketDurationMs(active));
  let updated = 0;

  // 방금 끝난 구간(직전 시간/직전 날) 동안의 매수/매도 건수로 이번 시세 변동 방향을 살짝 밀어줍니다.
  const stockIds = stocks.map((s) => s.id);
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

  for (const stock of stocks) {
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

    const { skew } = skewFromOrders(ordersByStock.get(stock.id) || []);
    const nextPrice = randomizePrice(stock.price, rate, skew);
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
