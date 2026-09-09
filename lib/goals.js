// 목표(goal)별 기부 순위를 계산합니다. 실시간 집계라 스냅샷을 따로 저장하지 않고,
// 그때그때 group_goal_donations을 합산해서 보여줍니다. 1등에게 메뉴 선정권을 줍니다.
export async function getTopDonors(sb, goalId, limit = 5) {
  const { data, error } = await sb
    .from('group_goal_donations')
    .select('kid_id, kid_name, amount')
    .eq('goal_id', goalId);
  if (error) throw error;

  const totals = new Map();
  for (const d of data) {
    const prev = totals.get(d.kid_id) || { kidId: d.kid_id, kidName: d.kid_name, amount: 0 };
    prev.amount += d.amount;
    prev.kidName = d.kid_name;
    totals.set(d.kid_id, prev);
  }

  return [...totals.values()].sort((a, b) => b.amount - a.amount).slice(0, limit);
}
