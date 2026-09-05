// 레벨 계산: 지금까지 받은 코인 총합(total_earned) 기준
// 15 GC 모을 때마다 1레벨업. 필요하면 XP_PER_LEVEL 값만 바꾸면 전체 밸런스가 조정됩니다.
export const XP_PER_LEVEL = 15;

export function calcLevel(totalEarned) {
  const level = Math.floor(totalEarned / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalEarned % XP_PER_LEVEL;
  const xpToNext = XP_PER_LEVEL - xpIntoLevel;
  const progressPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100);
  return { level, xpIntoLevel, xpToNext, progressPct, xpPerLevel: XP_PER_LEVEL };
}
