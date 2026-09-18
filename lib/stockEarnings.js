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

export function randomEarningsHeadline(fundamental, direction) {
  const bank = EARNINGS_HEADLINE[fundamental] || EARNINGS_HEADLINE.stagnant;
  const list = bank[direction] || EARNINGS_HEADLINE.stagnant[direction];
  return list[Math.floor(Math.random() * list.length)];
}

export const FUNDAMENTAL_LABELS = {
  growing: '성장중',
  stagnant: '정체',
  crisis: '위기',
};
