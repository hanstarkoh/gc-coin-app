// 투표(설문) 공용 상수. 코인을 걸고 맞추는 "예측 시장"과 달리, 그냥 선택지 하나를 고르면
// 참여 보상으로 고정 코인을 받는 방식 — 관리자가 궁금한 걸 청소년에게 물어볼 때 씀.

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_DEFAULT_REWARD = 10;
export const POLL_MAX_REWARD = 200;

export function sanitizePollOptions(rawOptions) {
  const options = (Array.isArray(rawOptions) ? rawOptions : [])
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter(Boolean)
    .slice(0, POLL_MAX_OPTIONS);
  if (options.length < POLL_MIN_OPTIONS) return null;
  return options;
}
