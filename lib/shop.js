// 상점 카탈로그. 가격/이모지/이름은 여기서만 관리하고, DB에는 "누가 뭘 샀는지"만 저장합니다.
// 새 아이템을 추가하려면 해당 카테고리 배열에 항목만 추가하면 됩니다.

export const AVATAR_CATALOG = [
  // 기본 동물
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
  { key: 'turtle', emoji: '🐢', name: '거북이', price: 10 },
  { key: 'penguin', emoji: '🐧', name: '펭귄', price: 10 },
  { key: 'cat', emoji: '🐱', name: '고양이', price: 10 },
  { key: 'dog', emoji: '🐶', name: '강아지', price: 10 },
  { key: 'cow', emoji: '🐮', name: '소', price: 10 },
  { key: 'sheep', emoji: '🐑', name: '양', price: 10 },
  { key: 'bee', emoji: '🐝', name: '꿀벌', price: 10 },
  { key: 'ladybug', emoji: '🐞', name: '무당벌레', price: 10 },
  { key: 'elephant', emoji: '🐘', name: '코끼리', price: 10 },
  { key: 'hippo', emoji: '🦛', name: '하마', price: 10 },
  { key: 'dolphin', emoji: '🐬', name: '돌고래', price: 10 },
  { key: 'sloth', emoji: '🦥', name: '나무늘보', price: 10 },
  // 프리미엄
  { key: 'unicorn', emoji: '🦄', name: '유니콘', price: 35 },
  { key: 'dragon', emoji: '🐲', name: '용', price: 35 },
  { key: 'owl', emoji: '🦉', name: '부엉이', price: 35 },
  { key: 'octopus', emoji: '🐙', name: '문어', price: 35 },
  { key: 'eagle', emoji: '🦅', name: '독수리', price: 35 },
  { key: 'wolf', emoji: '🐺', name: '늑대', price: 35 },
  { key: 'shark', emoji: '🦈', name: '상어', price: 35 },
  { key: 'trex', emoji: '🦖', name: '티라노사우루스', price: 35 },
  { key: 'flamingo', emoji: '🦩', name: '플라밍고', price: 35 },
  { key: 'parrot', emoji: '🦜', name: '앵무새', price: 35 },
];

export const ACCESSORY_CATALOG = [
  { key: 'hat', emoji: '🎩', name: '모자', price: 15 },
  { key: 'glasses', emoji: '🕶️', name: '선글라스', price: 15 },
  { key: 'ribbon', emoji: '🎀', name: '리본', price: 15 },
  { key: 'flower', emoji: '🌸', name: '꽃', price: 15 },
  { key: 'crown', emoji: '👑', name: '왕관', price: 30 },
  { key: 'headphones', emoji: '🎧', name: '헤드폰', price: 15 },
  { key: 'cap', emoji: '🧢', name: '캡모자', price: 12 },
  { key: 'mask', emoji: '🎭', name: '가면', price: 15 },
  { key: 'scarf', emoji: '🧣', name: '목도리', price: 12 },
  { key: 'necklace', emoji: '📿', name: '목걸이', price: 20 },
  { key: 'goggles', emoji: '🥽', name: '고글', price: 18 },
];

export const STICKER_CATALOG = [
  { key: 'star', emoji: '⭐', name: '별', price: 8 },
  { key: 'heart', emoji: '💖', name: '하트', price: 8 },
  { key: 'fire', emoji: '🔥', name: '불꽃', price: 8 },
  { key: 'sparkle', emoji: '✨', name: '반짝', price: 8 },
  { key: 'rainbow', emoji: '🌈', name: '무지개', price: 8 },
  { key: 'clover', emoji: '🍀', name: '네잎클로버', price: 8 },
  { key: 'music', emoji: '🎵', name: '음표', price: 8 },
  { key: 'gem', emoji: '💎', name: '보석', price: 12 },
  { key: 'balloon', emoji: '🎈', name: '풍선', price: 8 },
  { key: 'butterfly', emoji: '🦋', name: '나비', price: 8 },
  { key: 'lightning', emoji: '⚡', name: '번개', price: 10 },
];

// from/mid/to는 코인 카드 그라디언트용, wall/floor는 마이룸 벽지/바닥 색으로 같이 씁니다.
export const THEME_CATALOG = [
  { key: 'sunset', name: '선셋', from: '#E2574C', mid: '#F2AC1E', to: '#C98A0E', wall: '#FCE0D3', floor: '#D98B5F', price: 25 },
  { key: 'grape', name: '그레이프', from: '#A78EE0', mid: '#7C5CBF', to: '#5E44A0', wall: '#EDE7FA', floor: '#9B7FCB', price: 25 },
  { key: 'mint', name: '민트', from: '#82E4BE', mid: '#3FB68B', to: '#2C8A68', wall: '#E1F7EE', floor: '#5FBE97', price: 25 },
  { key: 'coral', name: '코랄', from: '#FFB199', mid: '#E2574C', to: '#B93F36', wall: '#FFE7E0', floor: '#E2836F', price: 25 },
  { key: 'ocean', name: '오션', from: '#6EC6FF', mid: '#3B82C4', to: '#1D4E89', wall: '#DCF0FF', floor: '#4E86B8', price: 25 },
  { key: 'forest', name: '포레스트', from: '#8FCB88', mid: '#4E8F52', to: '#2E5E33', wall: '#E3F3E1', floor: '#5C8F5F', price: 25 },
  { key: 'rose', name: '로즈', from: '#FFB6D9', mid: '#E85CA0', to: '#B83A78', wall: '#FFE3F0', floor: '#E28FB5', price: 25 },
  { key: 'gold', name: '골드', from: '#FFE29A', mid: '#F2AC1E', to: '#C98A0E', wall: '#FFF3D6', floor: '#E0AA55', price: 30 },
];

// special은 보유하면 항상 켜져 있는 효과라 착용 슬롯이 없습니다.
// durationDays가 있으면 기간제 아이템 — 구매 시점부터 그만큼만 유지되고, 만료되면 다시 구매해야 합니다.
export const SPECIAL_CATALOG = [
  { key: 'name_glow', emoji: '✨', name: '이름 반짝이', price: 15, durationDays: 30, desc: '이름 선택 화면에서 내 이름이 금빛으로 빛나요 (30일)' },
  { key: 'rainbow_name', emoji: '🌈', name: '무지개 이름', price: 20, durationDays: 30, desc: '이름이 무지개색으로 은은하게 빛나요 (30일)' },
  { key: 'neon_name', emoji: '💠', name: '네온 이름', price: 18, durationDays: 30, desc: '이름이 하늘색 네온사인처럼 빛나요 (30일)' },
  { key: 'shake_name', emoji: '🫨', name: '흔들 이름', price: 10, durationDays: 30, desc: '이름이 두근두근 살짝 흔들려요 (30일)' },
  { key: 'avatar_ring', emoji: '🟡', name: '골드 링', price: 15, durationDays: 30, desc: '아바타 주변에 금빛 테두리가 생겨요 (30일)' },
  { key: 'avatar_ring_rainbow', emoji: '💫', name: '무지개 링', price: 20, durationDays: 30, desc: '아바타 주변에 무지개색 테두리가 생겨요 (30일)' },
  { key: 'avatar_ring_fire', emoji: '🔥', name: '불꽃 링', price: 18, durationDays: 30, desc: '아바타 주변에 활활 타오르는 테두리가 생겨요 (30일)' },
  { key: 'star_trail', emoji: '🌟', name: '별가루 효과', price: 20, durationDays: 30, desc: '아바타 주변에 별이 반짝반짝 떠다녀요 (30일)' },
  { key: 'vip_badge', emoji: '🎖️', name: 'VIP 마크', price: 25, durationDays: 30, desc: '이름 옆에 VIP 마크가 붙어요 (30일)' },
];

// 마이룸에 놓는 가구. 착용(equip) 개념이 아니라 원하는 만큼 사서 방 여기저기에 배치합니다.
export const FURNITURE_CATALOG = [
  { key: 'sofa', emoji: '🛋️', name: '소파', price: 20 },
  { key: 'bed', emoji: '🛏️', name: '침대', price: 20 },
  { key: 'tv', emoji: '📺', name: 'TV', price: 25 },
  { key: 'guitar', emoji: '🎸', name: '기타', price: 25 },
  { key: 'books', emoji: '📚', name: '책장', price: 15 },
  { key: 'plant', emoji: '🪴', name: '화분', price: 12 },
  { key: 'frame', emoji: '🖼️', name: '액자', price: 12 },
  { key: 'fishbowl', emoji: '🐠', name: '어항', price: 15 },
  { key: 'teddy', emoji: '🧸', name: '곰인형', price: 15 },
  { key: 'lamp', emoji: '💡', name: '조명', price: 10 },
  { key: 'clock', emoji: '🕰️', name: '시계', price: 10 },
  { key: 'candle', emoji: '🕯️', name: '초', price: 8 },
  { key: 'chair', emoji: '🪑', name: '의자', price: 10 },
  { key: 'piano', emoji: '🎹', name: '피아노', price: 30 },
  { key: 'bathtub', emoji: '🛁', name: '욕조', price: 20 },
  { key: 'window', emoji: '🪟', name: '창문', price: 12 },
  { key: 'basket', emoji: '🧺', name: '바구니', price: 10 },
  { key: 'console', emoji: '🎮', name: '게임기', price: 20 },
  { key: 'radio', emoji: '📻', name: '라디오', price: 15 },
  { key: 'easel', emoji: '🎨', name: '이젤', price: 15 },
];

// 착용(equip) 가능한 카테고리만. special/furniture는 착용 슬롯이 없음
// (special은 보유하면 항상 켜져 있는 효과, furniture는 마이룸에 직접 배치).
export const EQUIPPABLE_CATEGORIES = ['avatar', 'accessory', 'sticker', 'theme'];

export const SHOP_CATEGORIES = {
  avatar: AVATAR_CATALOG,
  accessory: ACCESSORY_CATALOG,
  sticker: STICKER_CATALOG,
  theme: THEME_CATALOG,
  special: SPECIAL_CATALOG,
  furniture: FURNITURE_CATALOG,
};

export function findShopItem(category, key) {
  const list = SHOP_CATEGORIES[category];
  if (!list || !key) return null;
  return list.find((i) => i.key === key) || null;
}
