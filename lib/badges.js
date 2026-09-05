// 뱃지는 별도 테이블 없이, 매번 kids 테이블의 누적 수치로 즉시 계산합니다.
// 조건을 만족하면 자동으로 획득한 것으로 표시돼요. 새 뱃지를 추가하려면 이 배열에 항목만 추가하면 됩니다.
export const BADGE_DEFS = [
  { key: 'first_attend', icon: '🌱', name: '첫 출석', desc: '처음으로 출석 코인을 받았어요', check: (k) => k.attendance_count >= 1 },
  { key: 'attend_5', icon: '🔥', name: '개근 브론즈', desc: '출석 5회 달성', check: (k) => k.attendance_count >= 5 },
  { key: 'attend_10', icon: '🏅', name: '개근 실버', desc: '출석 10회 달성', check: (k) => k.attendance_count >= 10 },
  { key: 'attend_20', icon: '🏆', name: '개근왕', desc: '출석 20회 달성', check: (k) => k.attendance_count >= 20 },
  { key: 'earn_50', icon: '💰', name: '코인 컬렉터', desc: '누적 코인 50 GC 달성', check: (k) => k.total_earned >= 50 },
  { key: 'earn_100', icon: '👑', name: '코인 마스터', desc: '누적 코인 100 GC 달성', check: (k) => k.total_earned >= 100 },
  { key: 'first_buy', icon: '🍦', name: '첫 간식', desc: '처음으로 코인을 사용했어요', check: (k) => k.purchase_count >= 1 },
  { key: 'buy_10', icon: '🛒', name: '간식 단골', desc: '10번 구매 달성', check: (k) => k.purchase_count >= 10 },
];

export function getEarnedBadges(kid) {
  return BADGE_DEFS.filter((b) => b.check(kid));
}

export function getNextBadge(kid) {
  return BADGE_DEFS.find((b) => !b.check(kid)) || null;
}
