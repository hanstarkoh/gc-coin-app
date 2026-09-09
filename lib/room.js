// 마이룸은 기본 4x4에서 시작해서, 코인을 내고 한 줄씩(4칸) 넓힐 수 있습니다.
// 넓힐수록 다음 확장 비용이 올라가는 식(부동산 느낌)으로 설계했습니다.
export const ROOM_BASE_COLS = 4;
export const ROOM_BASE_ROWS = 4;
export const ROOM_EXPANSION_COSTS = [30, 50, 80, 120];
export const ROOM_MAX_EXPANSIONS = ROOM_EXPANSION_COSTS.length;

export function roomDims(expansions = 0) {
  const level = Math.max(0, Math.min(expansions, ROOM_MAX_EXPANSIONS));
  return { cols: ROOM_BASE_COLS, rows: ROOM_BASE_ROWS + level };
}

export function nextExpansionCost(expansions = 0) {
  if (expansions >= ROOM_MAX_EXPANSIONS) return null;
  return ROOM_EXPANSION_COSTS[expansions];
}

export function isValidCell(x, y, expansions = 0) {
  const { cols, rows } = roomDims(expansions);
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < cols && y >= 0 && y < rows;
}
