// 오늘의 운세 뽑기: 코인을 내고 등급(대길~대흉) + 한마디 + 등급별 이펙트를 뽑는 소비처.
// 가치 있는 걸 거는 추첨이 아니라(코인/아이템을 딸 수 없음) 등급도 결과도 순수 꾸밈이라
// 안전함. 하루 1회만 가능하게 해서(귀한 느낌) 매일 다시 오고 싶게 만드는 용도.
//
// 안 좋은 등급(소흉/중흉/대흉)도 코인 내고 뽑았는데 진짜 기분 나쁘면 재구매 의욕이 꺾이니까,
// 문구는 전부 "그래도 괜찮아" 식으로 가볍게 마무리함 — 진짜 불길한 느낌은 주지 않음.

export const FORTUNE_PRICE = 20;

// weight가 클수록 자주 나옴(합계 100 기준 %). effect는 프론트에서 등급별로 다른 이펙트를
// 고를 때 쓰는 키(components/FortuneWheel.jsx 참고) — 양 극단(대길/대흉)일수록 이펙트가
// 훨씬 더 크고 화려하게(또는 극적으로), 가운데(평운)에 가까울수록 차분해지는 식으로 강도를
// 단계별로 분명하게 다르게 둠(그냥 "조금씩 다른 흔들림"이 아니라 등급마다 완전히 다른 연출).
//
// 아래 weight는 "기본값"이고, 관리자가 settings.fortune_weights(jsonb, {key: weight})로
// 덮어쓸 수 있음(app/api/admin/settings/fortune-weights/route.js). 흉 쪽(소흉/중흉/대흉)은
// 코인 내고 뽑았는데 나쁜 결과만 자주 나오면 재구매 의욕이 꺾이니 기본값부터 낮게 잡음
// (합계 17%, 좋음+평범 83%).
export const FORTUNE_TIERS = [
  { key: 'daegil', label: '대길', emoji: '🎉', color: '#C98A0E', weight: 6, effect: 'mega-gold' },
  { key: 'junggil', label: '중길', emoji: '✨', color: '#2C8A68', weight: 17, effect: 'confetti-mint' },
  { key: 'sogil', label: '소길', emoji: '🍀', color: '#1D4E89', weight: 28, effect: 'sparkle' },
  { key: 'pyeongun', label: '평운', emoji: '☁️', color: '#6B7280', weight: 32, effect: 'calm' },
  { key: 'sohyung', label: '소흉', emoji: '🧐', color: '#C98A0E', weight: 10, effect: 'wobble' },
  { key: 'junghyung', label: '중흉', emoji: '😬', color: '#B93F36', weight: 5, effect: 'storm' },
  { key: 'daehyung', label: '대흉', emoji: '🌧️', color: '#7A1F17', weight: 2, effect: 'mega-storm' },
];

const FORTUNE_PHRASES = {
  daegil: [
    '오늘은 뭘 해도 잘 풀리는 대길의 날이에요!',
    '과감한 도전이 큰 성과로 이어질 수 있는 날이에요',
    '오늘 만나는 기회는 놓치지 마세요, 대길이에요!',
    '주변에 좋은 일이 연달아 생길 수 있어요',
    '자신감 있게 하루를 시작해보세요, 대길의 기운이에요',
  ],
  junggil: [
    '오늘은 전반적으로 순조로운 하루예요',
    '꾸준히 해온 노력이 슬슬 빛을 보기 시작해요',
    '작은 행운들이 하루 곳곳에 숨어있어요',
    '친구와의 대화에서 좋은 아이디어를 얻을 수 있어요',
    '계획한 일들이 차근차근 풀려가는 날이에요',
  ],
  sogil: [
    '소소하지만 기분 좋은 일이 생길 수 있어요',
    '평소보다 운이 살짝 더 따라주는 하루예요',
    '작은 선택 하나가 좋은 결과로 이어질 거예요',
    '오늘은 느긋하게, 소소한 행복을 챙겨보세요',
    '뜻밖의 작은 행운을 기대해도 좋아요',
  ],
  pyeongun: [
    '오늘은 평소와 비슷한, 무난한 하루예요',
    '특별한 일은 없지만 안정적인 하루가 될 거예요',
    '평범한 하루 속에서도 좋은 습관을 챙겨보세요',
    '오늘은 평소 하던 대로 꾸준히 하면 충분해요',
    '급하게 서두르지 않아도 되는 여유로운 날이에요',
  ],
  sohyung: [
    '오늘은 평소보다 한 번 더 생각하고 행동하는 게 좋아요',
    '성급한 선택은 잠시 미뤄두는 게 좋은 날이에요',
    '작은 실수에 주의하면 무사히 잘 넘어갈 수 있어요',
    '컨디션 관리에 조금 더 신경 써보세요',
    '오늘은 무리한 도전보다 신중함이 필요해요',
  ],
  junghyung: [
    '오늘은 중요한 결정은 내일로 미뤄보는 게 어때요?',
    '평소보다 꼼꼼하게 확인하고 넘어가는 게 좋은 날이에요',
    '친구와 작은 다툼이 생길 수 있으니 말을 한 번 더 생각해봐요',
    '급한 투자나 큰 소비는 오늘만큼은 피해보세요',
    '오늘은 집중이 잘 안 될 수 있어요, 잠깐 쉬어가도 괜찮아요',
  ],
  daehyung: [
    '오늘은 뭘 해도 삐끗할 수 있는 날, 그래도 웃으면서 넘겨봐요!',
    '중요한 결정은 오늘 말고 내일! 급한 일은 잠시 미뤄두세요',
    '오늘따라 자꾸 깜빡할 수 있어요, 메모를 꼭 남겨두세요',
    '무리한 추격매수나 큰돈 쓰는 건 오늘은 패스하는 게 좋아요',
    '액땜했다 생각하고, 내일은 더 좋은 하루가 올 거예요!',
  ],
};

// weightOverrides: 관리자가 settings.fortune_weights로 저장해둔 {key: weight} 맵(없으면
// 기본 FORTUNE_TIERS.weight 사용). 음수/NaN 등 이상한 값은 기본값으로 대체해서 안전하게 처리.
function pickWeighted(weightOverrides) {
  const weights = FORTUNE_TIERS.map((t) => {
    const override = weightOverrides?.[t.key];
    return Number.isFinite(override) && override >= 0 ? override : t.weight;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * (total || 1);
  for (let i = 0; i < FORTUNE_TIERS.length; i++) {
    if (r < weights[i]) return FORTUNE_TIERS[i];
    r -= weights[i];
  }
  return FORTUNE_TIERS[FORTUNE_TIERS.length - 1];
}

export function drawFortune(weightOverrides) {
  const tier = pickWeighted(weightOverrides);
  const phrases = FORTUNE_PHRASES[tier.key];
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];
  return { tier: tier.key, label: tier.label, emoji: tier.emoji, color: tier.color, effect: tier.effect, phrase };
}
