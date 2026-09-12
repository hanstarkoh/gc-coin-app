// 예측 시장(베팅 풀) 정산 로직. 패리뮤추얼 방식: 이긴 쪽 사람들이 진 쪽의 판돈을
// 자기 베팅액 비율대로 나눠 갖습니다. 새 코인을 만들지 않고 참가자끼리만 돈이 오가므로
// 전체 코인 총량(인플레이션)에는 영향이 없습니다.

export function calcPoolPayouts(bets, winnerOption) {
  const winPool = bets.filter((b) => b.option === winnerOption).reduce((s, b) => s + b.amount, 0);
  const totalPool = bets.reduce((s, b) => s + b.amount, 0);

  // 이긴 쪽에 아무도 없으면 나눠줄 사람이 없으니, 낸 돈을 그대로 돌려줘서 제로섬을 지킵니다.
  if (winPool === 0) {
    return bets.map((b) => ({ id: b.id, payout: b.amount }));
  }

  const payouts = bets.map((b) => {
    if (b.option !== winnerOption) return { id: b.id, payout: 0 };
    return { id: b.id, payout: Math.round((b.amount / winPool) * totalPool) };
  });

  // 각자 반올림하다 보면 합계가 totalPool이랑 어긋날 수 있어서(제로섬 원칙 위반),
  // 그 차이를 가장 많이 베팅한 승자 한 명에게 몰아줘서 총 지급액을 정확히 맞춥니다.
  const diff = totalPool - payouts.reduce((s, p) => s + p.payout, 0);
  if (diff !== 0) {
    let biggestIdx = -1;
    let biggestAmount = -1;
    bets.forEach((b, i) => {
      if (b.option === winnerOption && b.amount > biggestAmount) {
        biggestAmount = b.amount;
        biggestIdx = i;
      }
    });
    if (biggestIdx >= 0) payouts[biggestIdx].payout += diff;
  }

  return payouts;
}
