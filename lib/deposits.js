// 예금(정기예금) 상품 목록. 주식은 위험한 대신 크게 벌 수도 있는 자산이라면,
// 예금은 "안전하지만 확정된 적은 이자"를 주는 자산 — 위험/안전 자산의 대비를 가르치기 위한 기능입니다.
// 아이들이 보통 토요일마다 오기 때문에 기간을 2주/3주/4주(다음, 다다음, 그다음 토요일) 단위로
// 맞췄고, 이율은 주식보다 확실히 낮게 잡아서 "안전하지만 느리다"는 게 체감되게 했습니다.
export const DEPOSIT_PLANS = [
  { days: 14, weeks: 2, ratePct: 5, label: '2주 예금' },
  { days: 21, weeks: 3, ratePct: 8, label: '3주 예금' },
  { days: 30, weeks: 4, ratePct: 12, label: '4주 예금' },
];

export const MIN_DEPOSIT_AMOUNT = 10;

export function findDepositPlan(days) {
  return DEPOSIT_PLANS.find((p) => p.days === Number(days)) || null;
}

export function calcPayout(principal, ratePct) {
  return principal + Math.round((principal * ratePct) / 100);
}
