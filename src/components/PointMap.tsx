import { adjacentPairs, dirVec, MIN_SEPARATION_M, type ReleasedShow } from '../lib/show';

export default function PointMap({ released }: { released: ReleasedShow | null }) {
  if (!released) return <div className="empty">整场提交放行后，此处生成点位平面图</div>;

  const { points } = released;
  const margin = 14;
  const minX = Math.min(...points.map(p => p.x - p.safety)) - margin;
  const maxX = Math.max(...points.map(p => p.x + p.safety)) + margin;
  const minY = Math.min(...points.map(p => p.y - p.safety)) - margin;
  const maxY = Math.max(...points.map(p => p.y + p.safety)) + margin;

  const gx: number[] = [];
  for (let g = Math.ceil(minX / 20) * 20; g <= maxX; g += 20) gx.push(g);
  const gy: number[] = [];
  for (let g = Math.ceil(minY / 20) * 20; g <= maxY; g += 20) gy.push(g);

  const pairs = adjacentPairs(points);

  return (
    <div>
      <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className="map" role="img" aria-label="燃放点位平面图">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f6ad55" />
          </marker>
        </defs>

        {/* 网格（20m） */}
        {gx.map(g => <line key={`x${g}`} x1={g} y1={minY} x2={g} y2={maxY} className="grid-line" />)}
        {gy.map(g => <line key={`y${g}`} x1={minX} y1={g} x2={maxX} y2={g} className="grid-line" />)}

        {/* 相邻点位连线与间距 */}
        {pairs.map(({ a, b, dist }) => {
          const close = dist < MIN_SEPARATION_M;
          return (
            <g key={a.id + b.id}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={close ? 'pair-line bad' : 'pair-line'} />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 2.5} textAnchor="middle" className={close ? 'map-dist bad' : 'map-dist'}>
                {dist.toFixed(0)}m
              </text>
            </g>
          );
        })}

        {/* 点位：安全距离圈 + 发射角箭头 + 标记 */}
        {points.map(p => {
          const d = dirVec(p.angle);
          return (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r={p.safety} className="safety-circle" />
              <line x1={p.x} y1={p.y} x2={p.x + d.x * 24} y2={p.y + d.y * 24} className="angle-arrow" markerEnd="url(#arrow)" />
              <circle cx={p.x} cy={p.y} r={3.4} className="pt-dot" />
              <text x={p.x} y={p.y + 9} textAnchor="middle" className="map-label">{p.id}</text>
              <text x={p.x} y={p.y - 6.5} textAnchor="middle" className="map-angle">{p.angle}°</text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="dot" style={{ background: '#f6ad55' }} />点位 / 发射角（0°=正北，顺时针）</span>
        <span><i className="dot dot-ring" />安全距离圈</span>
        <span><i className="dot" style={{ background: '#fc8181' }} />间距 &lt; {MIN_SEPARATION_M}m</span>
      </div>
    </div>
  );
}
