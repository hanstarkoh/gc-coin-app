// 실적발표 헤드라인 뱅크. 종목의 펀더멘털(성장중/정체/위기) × 결과 방향(상승/하락) 조합별로
// 문구가 달라져서, "펀더멘털대로 갔는지" "깜짝 반전(서프라이즈/쇼크)이었는지"가 느껴지게 합니다.
// 펀더멘털이 좋다고 결과가 확정되는 건 아니에요(예: 성장중이어도 실망스러운 실적이 나올 수
// 있음) — 그래야 "라벨만 보고 사면 무조건 이긴다"는 계산 게임이 안 됩니다.

const EARNINGS_HEADLINE = {
  growing: {
    up: ['예상대로 좋은 실적을 발표했어요!', '성장세를 이어가며 실적이 더 좋아졌대요!', '매출과 이익이 함께 늘었다는 소식이에요!'],
    down: [
      '성장 중이었는데 이번엔 예상을 밑돌았대요... 어닝쇼크!',
      '잘나가던 회사가 갑자기 실적이 꺾였대요...',
      '기대가 컸던 만큼 실망도 컸다는 반응이에요...',
    ],
  },
  stagnant: {
    up: ['예상보다 좋은 실적을 발표했어요!', '오랜만에 반가운 실적 소식이에요!', '조용히 실적을 끌어올렸다는 평가예요.'],
    down: ['예상보다 아쉬운 실적을 발표했대요...', '이번 실적도 특별한 반등은 없었대요...', '큰 변화 없이 제자리걸음인 실적이래요...'],
  },
  crisis: {
    up: [
      '위기설이 돌았는데 깜짝 실적을 발표했어요! 어닝서프라이즈!',
      '우려와 달리 선방한 실적이 나왔대요!',
      '반전에 성공하며 시장을 놀라게 했대요!',
    ],
    down: ['우려했던 대로 실적이 좋지 않았대요...', '역시나 어려운 실적이 이어지고 있대요...', '위기설이 실적으로 확인됐다는 평가예요...'],
  },
};

// 최근 한 달 뉴스가 뚜렷하게 한쪽으로 쏠렸는데(누가 봐도 계속 좋은/나쁜 소식) 실적은 반대로
// 나온 경우, "그냥 랜덤이라 그래요"가 아니라 실제 뉴스처럼 납득할 만한 이유(일회성 비용,
// 환율, 재고평가손실, 비용절감 등)를 붙여서 왜 그렇게 됐는지 이해가 되게 합니다.
const NEWS_SURPRISE_THRESHOLD = 0.5;
const NEWS_TREND_SURPRISE = {
  // 한 달 내내 좋은 뉴스였는데 실적은 꺾인 경우
  downDespiteGoodNews: [
    '한 달 내내 좋은 소식이 많았지만, 일회성 비용이 크게 잡히며 실적은 예상을 밑돌았대요...',
    '분위기는 좋았는데, 환율 영향으로 실적이 발목을 잡혔대요...',
    '호재가 이어졌지만, 재고자산 평가손실이 반영되며 실적이 꺾였대요...',
  ],
  // 한 달 내내 나쁜 뉴스였는데 실적은 좋게 나온 경우
  upDespiteBadNews: [
    '안 좋은 소식이 이어졌지만, 비용 절감 효과로 깜짝 실적을 냈대요!',
    '우려가 컸는데, 일회성 이익이 반영되며 예상보다 좋은 실적이 나왔대요!',
    '분위기는 안 좋았지만, 신사업 효과로 실적을 방어하며 반등했대요!',
  ],
};

// newsSkew: 최근 한 달 뉴스의 호재/악재 쏠림(-1~1). 뉴스 흐름과 실제 결과가 뚜렷하게
// 어긋나면(예: 계속 좋은 뉴스였는데 실적은 하락) 그 이유를 설명하는 헤드라인을 우선 쓰고,
// 그 정도로 어긋나지 않았으면 기존처럼 펀더멘털×방향 조합 헤드라인을 씁니다.
export function randomEarningsHeadline(fundamental, direction, newsSkew = 0) {
  if (newsSkew >= NEWS_SURPRISE_THRESHOLD && direction === 'down') {
    const list = NEWS_TREND_SURPRISE.downDespiteGoodNews;
    return list[Math.floor(Math.random() * list.length)];
  }
  if (newsSkew <= -NEWS_SURPRISE_THRESHOLD && direction === 'up') {
    const list = NEWS_TREND_SURPRISE.upDespiteBadNews;
    return list[Math.floor(Math.random() * list.length)];
  }
  const bank = EARNINGS_HEADLINE[fundamental] || EARNINGS_HEADLINE.stagnant;
  const list = bank[direction] || EARNINGS_HEADLINE.stagnant[direction];
  return list[Math.floor(Math.random() * list.length)];
}

export const FUNDAMENTAL_LABELS = {
  growing: '성장중',
  stagnant: '정체',
  crisis: '위기',
};
