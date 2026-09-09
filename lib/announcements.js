export const MEGAPHONE_PRICE = 15;
export const MESSAGE_MAX_LENGTH = 60;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 오늘(KST 기준) 자정까지 유효한 만료 시각을 UTC로 계산합니다.
export function kstEndOfTodayUTC() {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  kst.setUTCHours(24, 0, 0, 0); // 다음날 00:00 (KST)
  return new Date(kst.getTime() - KST_OFFSET_MS);
}
