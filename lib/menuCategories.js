// 금청수 상점 메뉴 소분류. DB에는 key만 저장하고, 표시용 이름은 여기서 관리합니다.
export const MENU_CATEGORIES = [
  { key: 'snack', label: '간식' },
  { key: 'drink', label: '음료' },
  { key: 'toy', label: '완구' },
  { key: 'etc', label: '기타' },
];

export const DEFAULT_MENU_CATEGORY = 'snack';
export const MENU_DESCRIPTION_MAX_LENGTH = 40;
export const MENU_CATEGORY_KEYS = MENU_CATEGORIES.map((c) => c.key);

export function menuCategoryLabel(key) {
  return MENU_CATEGORIES.find((c) => c.key === key)?.label || '기타';
}

export function isValidMenuCategory(key) {
  return MENU_CATEGORY_KEYS.includes(key);
}
