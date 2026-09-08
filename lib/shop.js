// 상점 카탈로그. 가격/이모지/이름은 여기서만 관리하고, DB에는 "누가 뭘 샀는지"만 저장합니다.
// 새 아이템을 추가하려면 해당 카테고리 배열에 항목만 추가하면 됩니다.

export const AVATAR_CATALOG = [
  { key: 'lion', emoji: '🦁', name: '사자', price: 10 },
  { key: 'tiger', emoji: '🐯', name: '호랑이', price: 10 },
  { key: 'rabbit', emoji: '🐰', name: '토끼', price: 10 },
  { key: 'bear', emoji: '🐻', name: '곰', price: 10 },
  { key: 'panda', emoji: '🐼', name: '판다', price: 10 },
  { key: 'fox', emoji: '🦊', name: '여우', price: 10 },
  { key: 'frog', emoji: '🐸', name: '개구리', price: 10 },
  { key: 'monkey', emoji: '🐵', name: '원숭이', price: 10 },
  { key: 'koala', emoji: '🐨', name: '코알라', price: 10 },
  { key: 'pig', emoji: '🐷', name: '돼지', price: 10 },
  { key: 'hamster', emoji: '🐹', name: '햄스터', price: 10 },
  { key: 'chick', emoji: '🐔', name: '병아리', price: 10 },
  { key: 'unicorn', emoji: '🦄', name: '유니콘', price: 35 },
  { key: 'dragon', emoji: '🐲', name: '용', price: 35 },
  { key: 'owl', emoji: '🦉', name: '부엉이', price: 35 },
  { key: 'octopus', emoji: '🐙', name: '문어', price: 35 },
];

export const ACCESSORY_CATALOG = [
  { key: 'hat', emoji: '🎩', name: '모자', price: 15 },
  { key: 'glasses', emoji: '🕶️', name: '선글라스', price: 15 },
  { key: 'ribbon', emoji: '🎀', name: '리본', price: 15 },
  { key: 'flower', emoji: '🌸', name: '꽃', price: 15 },
  { key: 'crown', emoji: '👑', name: '왕관', price: 30 },
];

export const STICKER_CATALOG = [
  { key: 'star', emoji: '⭐', name: '별', price: 8 },
  { key: 'heart', emoji: '💖', name: '하트', price: 8 },
  { key: 'fire', emoji: '🔥', name: '불꽃', price: 8 },
  { key: 'sparkle', emoji: '✨', name: '반짝', price: 8 },
];

export const THEME_CATALOG = [
  { key: 'sunset', name: '선셋', from: '#E2574C', mid: '#F2AC1E', to: '#C98A0E', price: 25 },
  { key: 'grape', name: '그레이프', from: '#A78EE0', mid: '#7C5CBF', to: '#5E44A0', price: 25 },
  { key: 'mint', name: '민트', from: '#82E4BE', mid: '#3FB68B', to: '#2C8A68', price: 25 },
  { key: 'coral', name: '코랄', from: '#FFB199', mid: '#E2574C', to: '#B93F36', price: 25 },
];

export const SPECIAL_CATALOG = [
  { key: 'name_glow', name: '이름 반짝이', price: 40, desc: '이름 선택 화면에서 내 이름이 금빛으로 빛나요' },
];

// 착용(equip) 가능한 카테고리만. special은 보유하면 항상 켜져 있는 효과라 착용 슬롯이 없음.
export const EQUIPPABLE_CATEGORIES = ['avatar', 'accessory', 'sticker', 'theme'];

export const SHOP_CATEGORIES = {
  avatar: AVATAR_CATALOG,
  accessory: ACCESSORY_CATALOG,
  sticker: STICKER_CATALOG,
  theme: THEME_CATALOG,
  special: SPECIAL_CATALOG,
};

export function findShopItem(category, key) {
  const list = SHOP_CATEGORIES[category];
  if (!list || !key) return null;
  return list.find((i) => i.key === key) || null;
}
