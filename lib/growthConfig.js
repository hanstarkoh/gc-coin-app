// 성장 지표 계산에 쓰는 기준값 모음. 표본이 아래 기준에 못 미치면 값을 억지로 만들지 않고
// insufficient(집단)/pending(개인)으로 표시합니다. 필요하면 이 숫자들만 조정하면 전체
// 계산(lib/growthMetrics.js)과 화면·엑셀에 그대로 반영돼요.

export const GROWTH_THRESHOLDS = {
  // 월별 "집단(전체 합산)" 지표 계산에 필요한 최소 표본.
  monthlyGroupMinBuys: 15, // 매수 관련 집단 지표(추격매수 비율 등)에 필요한 그 달 최소 매수 건수
  monthlyGroupMinVisitors: 10, // 등원/저축 관련 집단 지표에 필요한 그 달 최소 등원 인원

  // 개인별 "처음 N vs 최근 N" 비교에 필요한 최소 표본.
  kidMinTradesForCompare: 3, // 매수/예금처럼 드문 행동: 첫 3건 vs 최근 3건
  kidMinVisitsForCompare: 4, // 등원 기반 지표: 첫 4회 등원 vs 최근 4회 등원
  kidMinVisitsForRetention: 6, // 등원 유지율(등원 간격) 비교에 필요한 최소 등원 횟수(간격 5개 확보)

  // 월별 "집단" 비율 지표를 아이별 비율 평균으로 계산할 때, 그 달에 이 건수 미만만 거래한
  // 아이는 평균에서 뺍니다(1~2건만 거래하면 비율이 0%/100%로 튀어서 평균을 왜곡함).
  monthlyGroupMinTradesPerKid: 3,

  // 참여 유형(투자형/저축형/...) 분류 — 한 영역의 활동 건수가 전체 활동 건수 중 이 비율
  // 이상이면 그 유형으로 봅니다. 30명 규모에서는 군집분석이 불안정해서 규칙 기반으로 정함.
  // 추정치라 실제 분포를 보고 조정이 필요합니다(2026-10 기준 초기값).
  participationTypeDominantShare: 0.4,
};

// 뉴스가 뜬 뒤 이 시간(시간 단위) 이내에 같은 종목을 매매하면 "뉴스에 즉흥적으로 반응했다"고 봅니다.
export const NEWS_REACTION_WINDOW_HOURS = 24;
