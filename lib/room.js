export const ROOM_COLS = 4;
export const ROOM_ROWS = 4;

export function isValidCell(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < ROOM_COLS && y >= 0 && y < ROOM_ROWS;
}
