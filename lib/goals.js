// 목표(goal)별 기부 순위를 계산합니다. 실시간 집계라 스냅샷을 따로 저장하지 않고,
// 그때그때 group_goal_donations을 합산해서 보여줍니다. 1등 보상은 관리자가 목표 설명에
// 자유롭게 적어서 정하는 방식이라 여기서는 순위만 계산합니다.
export async function getTopDonors(sb, goalId, limit = 5) {
  const [{ data, error }, { data: testKids }] = await Promise.all([
    sb.from('group_goal_donations').select('kid_id, kid_name, amount').eq('goal_id', goalId),
    sb.from('kids').select('id').eq('is_test', true),
  ]);
  if (error) throw error;
  // 테스트 계정이 기부 순위(1등 보상 결정용)에 섞이면 안 되니 제외.
  const testIds = new Set((testKids || []).map((k) => k.id));
  const realData = data.filter((d) => !testIds.has(d.kid_id));

  const totals = new Map();
  for (const d of realData) {
    const prev = totals.get(d.kid_id) || { kidId: d.kid_id, kidName: d.kid_name, amount: 0 };
    prev.amount += d.amount;
    prev.kidName = d.kid_name;
    totals.set(d.kid_id, prev);
  }

  return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}
