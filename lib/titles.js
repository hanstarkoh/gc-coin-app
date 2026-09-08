// 칭호(타이틀): 조건을 만족하면 이름 앞에 붙일 수 있는 특별 뱃지.
// 배열 위쪽일수록 우선순위가 높아서, 여러 개를 동시에 만족해도 가장 위에 있는 것 하나만 보여줍니다.
// 새 칭호를 추가하려면 이 배열에 항목만 추가하면 됩니다.
export const TITLE_DEFS = [
  { key: 'stock_king', icon: '👑', name: '주식왕', desc: '모의투자 실현 손익 100 GC 달성', check: (k) => (k.invest_realized_profit || 0) >= 100 },
];

export function getActiveTitle(kid) {
  return TITLE_DEFS.find((t) => t.check(kid)) || null;
}
