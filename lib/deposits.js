// 예금(정기예금) 상품 목록. 주식은 위험한 대신 크게 벌 수도 있는 자산이라면,
// 예금은 "안전하지만 확정된 적은 이자"를 주는 자산 — 위험/안전 자산의 대비를 가르치기 위한 기능입니다.
export const DEPOSIT_PLANS = [
  { days: 3, ratePct: 4, label: '3일 예금' },
  { days: 7, ratePct: 10, label: '7일 예금' },
  { days: 14, ratePct: 25, label: '14일 예금' },
];

export const MIN_DEPOSIT_AMOUNT = 10;

export function findDepositPlan(days) {
  return DEPOSIT_PLANS.find((p) => p.days === Number(days)) || null;
}

export function calcPayout(principal, ratePct) {
  return principal + Math.round((principal * ratePct) / 100);
}
