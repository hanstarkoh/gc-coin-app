// 상점 카탈로그. 가격/이모지/이름은 여기서만 관리하고, DB에는 "누가 뭘 샀는지"만 저장합니다.
// 새 아이템을 추가하려면 해당 카테고리 배열에 항목만 추가하면 됩니다.

export const AVATAR_CATALOG = [
  // 기본 동물
  { key: 'lion', emoji: '🦁', name: '사자', price: 100 },
  { key: 'tiger', emoji: '🐯', name: '호랑이', price: 100 },
  { key: 'rabbit', emoji: '🐰', name: '토끼', price: 100 },
  { key: 'bear', emoji: '🐻', name: '곰', price: 100 },
  { key: 'panda', emoji: '🐼', name: '판다', price: 100 },
  { key: 'fox', emoji: '🦊', name: '여우', price: 100 },
  { key: 'frog', emoji: '🐸', name: '개구리', price: 100 },
  { key: 'monkey', emoji: '🐵', name: '원숭이', price: 100 },
  { key: 'koala', emoji: '🐨', name: '코알라', price: 100 },
  { key: 'pig', emoji: '🐷', name: '돼지', price: 100 },
  { key: 'hamster', emoji: '🐹', name: '햄스터', price: 100 },
  { key: 'chick', emoji: '🐔', name: '병아리', price: 100 },
  { key: 'turtle', emoji: '🐢', name: '거북이', price: 100 },
  { key: 'penguin', emoji: '🐧', name: '펭귄', price: 100 },
  { key: 'cat', emoji: '🐱', name: '고양이', price: 100 },
  { key: 'dog', emoji: '🐶', name: '강아지', price: 100 },
  { key: 'cow', emoji: '🐮', name: '소', price: 100 },
  { key: 'sheep', emoji: '🐑', name: '양', price: 100 },
  { key: 'bee', emoji: '🐝', name: '꿀벌', price: 100 },
  { key: 'ladybug', emoji: '🐞', name: '무당벌레', price: 100 },
  { key: 'elephant', emoji: '🐘', name: '코끼리', price: 100 },
  { key: 'hippo', emoji: '🦛', name: '하마', price: 100 },
  { key: 'dolphin', emoji: '🐬', name: '돌고래', price: 100 },
  { key: 'sloth', emoji: '🦥', name: '나무늘보', price: 100 },
  // 프리미엄
  { key: 'unicorn', emoji: '🦄', name: '유니콘', price: 350 },
  { key: 'dragon', emoji: '🐲', name: '용', price: 350 },
  { key: 'owl', emoji: '🦉', name: '부엉이', price: 350 },
  { key: 'octopus', emoji: '🐙', name: '문어', price: 350 },
  { key: 'eagle', emoji: '🦅', name: '독수리', price: 350 },
  { key: 'wolf', emoji: '🐺', name: '늑대', price: 350 },
  { key: 'shark', emoji: '🦈', name: '상어', price: 350 },
  { key: 'trex', emoji: '🦖', name: '티라노사우루스', price: 350 },
  { key: 'flamingo', emoji: '🦩', name: '플라밍고', price: 350 },
  { key: 'parrot', emoji: '🦜', name: '앵무새', price: 350 },
];

export const ACCESSORY_CATALOG = [
  { key: 'hat', emoji: '🎩', name: '모자', price: 150 },
  { key: 'glasses', emoji: '🕶️', name: '선글라스', price: 150 },
  { key: 'ribbon', emoji: '🎀', name: '리본', price: 150 },
  { key: 'flower', emoji: '🌸', name: '꽃', price: 150 },
  { key: 'crown', emoji: '👑', name: '왕관', price: 300 },
  { key: 'headphones', emoji: '🎧', name: '헤드폰', price: 150 },
  { key: 'cap', emoji: '🧢', name: '캡모자', price: 120 },
  { key: 'mask', emoji: '🎭', name: '가면', price: 150 },
  { key: 'scarf', emoji: '🧣', name: '목도리', price: 120 },
  { key: 'necklace', emoji: '📿', name: '목걸이', price: 200 },
  { key: 'goggles', emoji: '🥽', name: '고글', price: 180 },
];

export const STICKER_CATALOG = [
  { key: 'star', emoji: '⭐', name: '별', price: 80 },
  { key: 'heart', emoji: '💖', name: '하트', price: 80 },
  { key: 'fire', emoji: '🔥', name: '불꽃', price: 80 },
  { key: 'sparkle', emoji: '✨', name: '반짝', price: 80 },
  { key: 'rainbow', emoji: '🌈', name: '무지개', price: 80 },
  { key: 'clover', emoji: '🍀', name: '네잎클로버', price: 80 },
  { key: 'music', emoji: '🎵', name: '음표', price: 80 },
  { key: 'gem', emoji: '💎', name: '보석', price: 120 },
  { key: 'balloon', emoji: '🎈', name: '풍선', price: 80 },
  { key: 'butterfly', emoji: '🦋', name: '나비', price: 80 },
  { key: 'lightning', emoji: '⚡', name: '번개', price: 100 },
];

// from/mid/to는 코인 카드 그라디언트용, wall/floor는 마이룸 벽지/바닥 색으로 같이 씁니다.
export const THEME_CATALOG = [
  { key: 'sunset', name: '선셋', from: '#E2574C', mid: '#F2AC1E', to: '#C98A0E', wall: '#FCE0D3', floor: '#D98B5F', price: 250 },
  { key: 'grape', name: '그레이프', from: '#A78EE0', mid: '#7C5CBF', to: '#5E44A0', wall: '#EDE7FA', floor: '#9B7FCB', price: 250 },
  { key: 'mint', name: '민트', from: '#82E4BE', mid: '#3FB68B', to: '#2C8A68', wall: '#E1F7EE', floor: '#5FBE97', price: 250 },
  { key: 'coral', name: '코랄', from: '#FFB199', mid: '#E2574C', to: '#B93F36', wall: '#FFE7E0', floor: '#E2836F', price: 250 },
  { key: 'ocean', name: '오션', from: '#6EC6FF', mid: '#3B82C4', to: '#1D4E89', wall: '#DCF0FF', floor: '#4E86B8', price: 250 },
  { key: 'forest', name: '포레스트', from: '#8FCB88', mid: '#4E8F52', to: '#2E5E33', wall: '#E3F3E1', floor: '#5C8F5F', price: 250 },
  { key: 'rose', name: '로즈', from: '#FFB6D9', mid: '#E85CA0', to: '#B83A78', wall: '#FFE3F0', floor: '#E28FB5', price: 250 },
  { key: 'gold', name: '골드', from: '#FFE29A', mid: '#F2AC1E', to: '#C98A0E', wall: '#FFF3D6', floor: '#E0AA55', price: 300 },
];

// special은 보유하면 항상 켜져 있는 효과라 착용 슬롯이 없습니다.
// durationDays가 있으면 기간제 아이템 — 구매 시점부터 그만큼만 유지되고, 만료되면 다시 구매해야 합니다.
// 30일짜리는 "한 번 사면 한 달 내내 다시 안 사도 되는" 구조라 지속적 소비가 잘 안 일어나서
// (실제로 구매 0건), 같은 효과를 2주 버전으로도 팔아서 더 자주 재구매하게 유도함(가격도
// 30일의 절반보다 더 싸게 잡음). 두 버전 다 같은 시각 효과를 내며, 공개 화면 쪽에서
// "둘 중 하나라도 유효하면" 효과가 보이게 처리함(app/api/kids/route.js).
export const SPECIAL_CATALOG = [
  { key: 'name_glow', emoji: '✨', name: '이름 반짝이', price: 150, durationDays: 30, desc: '이름 선택 화면에서 내 이름이 금빛으로 빛나요 (30일)' },
  { key: 'rainbow_name', emoji: '🌈', name: '무지개 이름', price: 200, durationDays: 30, desc: '이름이 무지개색으로 은은하게 빛나요 (30일)' },
  { key: 'neon_name', emoji: '💠', name: '네온 이름', price: 180, durationDays: 30, desc: '이름이 하늘색 네온사인처럼 빛나요 (30일)' },
  { key: 'shake_name', emoji: '🫨', name: '흔들 이름', price: 100, durationDays: 30, desc: '이름이 두근두근 살짝 흔들려요 (30일)' },
  { key: 'avatar_ring', emoji: '🟡', name: '골드 링', price: 150, durationDays: 30, desc: '아바타 주변에 금빛 테두리가 생겨요 (30일)' },
  { key: 'avatar_ring_rainbow', emoji: '💫', name: '무지개 링', price: 200, durationDays: 30, desc: '아바타 주변에 무지개색 테두리가 생겨요 (30일)' },
  { key: 'avatar_ring_fire', emoji: '🔥', name: '불꽃 링', price: 180, durationDays: 30, desc: '아바타 주변에 활활 타오르는 테두리가 생겨요 (30일)' },
  { key: 'star_trail', emoji: '🌟', name: '별가루 효과', price: 200, durationDays: 30, desc: '아바타 주변에 별이 반짝반짝 떠다녀요 (30일)' },
  { key: 'vip_badge', emoji: '🎖️', name: 'VIP 마크', price: 250, durationDays: 30, desc: '이름 옆에 VIP 마크가 붙어요 (30일)' },

  // 2주 버전(같은 효과, 더 싸고 더 자주 재구매하는 용도)
  { key: 'name_glow_2w', emoji: '✨', name: '이름 반짝이 (2주)', price: 60, durationDays: 14, desc: '이름 선택 화면에서 내 이름이 금빛으로 빛나요 (2주)' },
  { key: 'rainbow_name_2w', emoji: '🌈', name: '무지개 이름 (2주)', price: 80, durationDays: 14, desc: '이름이 무지개색으로 은은하게 빛나요 (2주)' },
  { key: 'neon_name_2w', emoji: '💠', name: '네온 이름 (2주)', price: 70, durationDays: 14, desc: '이름이 하늘색 네온사인처럼 빛나요 (2주)' },
  { key: 'shake_name_2w', emoji: '🫨', name: '흔들 이름 (2주)', price: 40, durationDays: 14, desc: '이름이 두근두근 살짝 흔들려요 (2주)' },
  { key: 'avatar_ring_2w', emoji: '🟡', name: '골드 링 (2주)', price: 60, durationDays: 14, desc: '아바타 주변에 금빛 테두리가 생겨요 (2주)' },
  { key: 'avatar_ring_rainbow_2w', emoji: '💫', name: '무지개 링 (2주)', price: 80, durationDays: 14, desc: '아바타 주변에 무지개색 테두리가 생겨요 (2주)' },
  { key: 'avatar_ring_fire_2w', emoji: '🔥', name: '불꽃 링 (2주)', price: 70, durationDays: 14, desc: '아바타 주변에 활활 타오르는 테두리가 생겨요 (2주)' },
  { key: 'star_trail_2w', emoji: '🌟', name: '별가루 효과 (2주)', price: 80, durationDays: 14, desc: '아바타 주변에 별이 반짝반짝 떠다녀요 (2주)' },
  { key: 'vip_badge_2w', emoji: '🎖️', name: 'VIP 마크 (2주)', price: 100, durationDays: 14, desc: '이름 옆에 VIP 마크가 붙어요 (2주)' },

  // 움직이는 아바타 효과(2주 전용, 신규) — 아바타 자체에 애니메이션을 입힘(테두리 효과와는 별개).
  { key: 'avatar_bounce', emoji: '🏀', name: '통통 튀는 아바타', price: 60, durationDays: 14, desc: '내 아바타가 통통 튀면서 움직여요 (2주)' },
  { key: 'avatar_spin', emoji: '🌀', name: '빙글빙글 도는 아바타', price: 70, durationDays: 14, desc: '내 아바타가 빙글빙글 돌아가요 (2주)' },
  { key: 'avatar_pulse', emoji: '💓', name: '두근두근 아바타', price: 60, durationDays: 14, desc: '내 아바타가 두근두근 떨려요 (2주)' },
  { key: 'avatar_wiggle', emoji: '🫨', name: '흔들흔들 아바타', price: 60, durationDays: 14, desc: '내 아바타가 좌우로 흔들흔들해요 (2주)' },
  { key: 'avatar_shimmer', emoji: '✨', name: '반짝반짝 빛나는 아바타', price: 70, durationDays: 14, desc: '내 아바타가 반짝반짝 밝아졌다 어두워져요 (2주)' },
];

// 시즌/행사 한정 코스튬. accessory와 같은 방식(아바타에 작은 이모지 배지)으로 착용되고,
// durationDays로 기간제 구매가 되지만, availableFrom~availableTo 기간에만 "새로 구매"할
// 수 있다는 점이 다름(이미 산 건 기간이 지나도 만료 전까지 유지됨). 수련관 행사 시즌에
// 맞춰 항목을 추가하면 됨 — 지금은 할로윈만 넣어둠.
export const SEASONAL_CATALOG = [
  {
    key: 'costume_halloween_pumpkin',
    emoji: '🎃',
    name: '호박 모자',
    price: 80,
    durationDays: 21,
    availableFrom: '2026-10-15',
    availableTo: '2026-11-02',
    desc: '할로윈 한정 — 호박 모자를 써요 (10/15~11/2에만 구매 가능, 구매 후 21일 유지)',
  },
];

function isSeasonalInWindow(item, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return today >= item.availableFrom && today <= item.availableTo;
}

// 지금 구매 가능한(기간 안인) 시즌 코스튬만 돌려줍니다. 상점 목록에 accessory와 합쳐서 보여줄 때 씀.
export function activeSeasonalItems(now = new Date()) {
  return SEASONAL_CATALOG.filter((it) => isSeasonalInWindow(it, now));
}

// 마이룸에 놓는 가구. 착용(equip) 개념이 아니라 원하는 만큼 사서 방 여기저기에 배치합니다.
export const FURNITURE_CATALOG = [
  { key: 'sofa', emoji: '🛋️', name: '소파', price: 200 },
  { key: 'bed', emoji: '🛏️', name: '침대', price: 200 },
  { key: 'tv', emoji: '📺', name: 'TV', price: 250 },
  { key: 'guitar', emoji: '🎸', name: '기타', price: 250 },
  { key: 'books', emoji: '📚', name: '책장', price: 150 },
  { key: 'plant', emoji: '🪴', name: '화분', price: 120 },
  { key: 'frame', emoji: '🖼️', name: '액자', price: 120 },
  { key: 'fishbowl', emoji: '🐠', name: '어항', price: 150 },
  { key: 'teddy', emoji: '🧸', name: '곰인형', price: 150 },
  { key: 'lamp', emoji: '💡', name: '조명', price: 100 },
  { key: 'clock', emoji: '🕰️', name: '시계', price: 100 },
  { key: 'candle', emoji: '🕯️', name: '초', price: 80 },
  { key: 'chair', emoji: '🪑', name: '의자', price: 100 },
  { key: 'piano', emoji: '🎹', name: '피아노', price: 300 },
  { key: 'bathtub', emoji: '🛁', name: '욕조', price: 200 },
  { key: 'window', emoji: '🪟', name: '창문', price: 120 },
  { key: 'basket', emoji: '🧺', name: '바구니', price: 100 },
  { key: 'console', emoji: '🎮', name: '게임기', price: 200 },
  { key: 'radio', emoji: '📻', name: '라디오', price: 150 },
  { key: 'easel', emoji: '🎨', name: '이젤', price: 150 },
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
  if (!key) return null;
  const list = SHOP_CATEGORIES[category];
  const found = list ? list.find((i) => i.key === key) : null;
  if (found) return found;
  // 시즌 코스튬은 accessory 슬롯을 같이 쓰지만 SHOP_CATEGORIES엔 없어서(상시 노출 안 함) 따로 찾음.
  // 구매 기간이 지난 뒤에도(이미 산 아이템 표시용) 찾을 수 있어야 해서 기간 체크는 안 함.
  if (category === 'accessory') return SEASONAL_CATALOG.find((i) => i.key === key) || null;
  return null;
}
