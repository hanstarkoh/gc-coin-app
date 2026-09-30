// 성장 지표 탭 전용 월별 추이 꺾은선. Sparkline과 달리 "표본 부족" 달을 흐리게 표시할 수 있게
// 점 단위로 그립니다(그래서 새 컴포넌트로 분리 — Sparkline은 다른 곳에서도 쓰는 단순 미니
// 그래프라 그 계약을 건드리지 않음).
export default function GrowthTrendChart({ points, color = '#16324F', height = 90, formatValue }) {
  const width = Math.max(240, points.length * 44);
  const usable = points.filter((p) => p.value != null);
  if (usable.length < 2) {
    return <p className="text-[11px] text-gray-400 py-3 text-center">표본이 부족해서 그래프를 그릴 수 없어요.</p>;
  }

  const values = usable.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padTop = 14;
  const padBottom = 20;
  const plotHeight = height - padTop - padBottom;
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  const toY = (v) => padTop + plotHeight - ((v - min) / range) * plotHeight;
  const coords = points.map((p, i) => ({ ...p, x: i * step, y: p.value != null ? toY(p.value) : null }));

  const linePoints = coords
    .filter((c) => c.y != null)
    .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      {coords.map((c, i) => (
        <g key={i}>
          {c.y != null && (
            <circle cx={c.x} cy={c.y} r={c.insufficient ? 3 : 4} fill={c.insufficient ? '#D1D5DB' : color} opacity={c.insufficient ? 0.6 : 1} />
          )}
          <text x={c.x} y={height - 4} fontSize="9" textAnchor="middle" fill="#9CA3AF">
            {c.month.slice(5)}월
          </text>
          {c.y != null && (
            <text x={c.x} y={c.y - 8} fontSize="9" textAnchor="middle" fill={c.insufficient ? '#9CA3AF' : color}>
              {formatValue ? formatValue(c.value) : c.value}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
