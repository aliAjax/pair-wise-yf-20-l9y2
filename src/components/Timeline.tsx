import { formatTime, type ReleasedShow } from '../lib/show';

const SEG_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

export default function Timeline({ released }: { released: ReleasedShow | null }) {
  if (!released) return <div className="empty">整场提交放行后，此处生成时间轴</div>;

  const { points, segments, blocked } = released;
  const total = Math.max(1, ...segments.map(s => s.end), ...blocked.map(b => b.end), ...points.map(p => p.fireTime));
  const W = 660;
  const H = 150;
  const padL = 20;
  const padR = 20;
  const x = (t: number) => padL + (t / total) * (W - padL - padR);
  const step = total > 150 ? 30 : 15;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += step) ticks.push(t);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="timeline" role="img" aria-label="燃放时间轴">
        <defs>
          <pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#4c1d1d" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#fc8181" strokeWidth="1.6" />
          </pattern>
        </defs>

        {/* 节目段落 */}
        {segments.map((s, i) => (
          <g key={s.id}>
            <rect x={x(s.start)} y={22} width={Math.max(2, x(s.end) - x(s.start))} height={20} rx={3} fill={SEG_COLORS[i % SEG_COLORS.length]} opacity={0.9}>
              <title>{`${s.name} ${formatTime(s.start)}–${formatTime(s.end)}`}</title>
            </rect>
            <text x={x(s.start) + 5} y={35} className="tl-seg-label">{s.name}</text>
          </g>
        ))}

        {/* 封锁段 */}
        {blocked.map(b => (
          <g key={b.id}>
            <rect x={x(b.start)} y={48} width={Math.max(2, x(b.end) - x(b.start))} height={12} rx={2} fill="url(#hatch)" stroke="#fc8181" strokeWidth={0.6}>
              <title>{`${b.name} ${formatTime(b.start)}–${formatTime(b.end)}`}</title>
            </rect>
            <text x={x(b.start) + 4} y={57.5} className="tl-blocked-label">{b.name}</text>
          </g>
        ))}

        {/* 点火点位（双排错位避免重叠） */}
        {points.map((p, i) => {
          const cy = i % 2 === 0 ? 92 : 76;
          return (
            <g key={p.id}>
              <line x1={x(p.fireTime)} y1={cy} x2={x(p.fireTime)} y2={112} stroke="#f6ad55" strokeWidth={1} opacity={0.7} />
              <circle cx={x(p.fireTime)} cy={cy} r={4} fill="#f6ad55" stroke="#7b341e" strokeWidth={1} />
              <text x={x(p.fireTime)} y={cy - 7} textAnchor="middle" className="tl-pt-label">
                {p.id} {formatTime(p.fireTime)}
              </text>
            </g>
          );
        })}

        {/* 时间轴 */}
        <line x1={padL} x2={W - padR} y1={112} y2={112} stroke="#4a5568" strokeWidth={1} />
        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={108} y2={112} stroke="#4a5568" strokeWidth={1} />
            <text x={x(t)} y={126} textAnchor="middle" className="tl-tick">{formatTime(t)}</text>
          </g>
        ))}
      </svg>
      <div className="legend">
        <span><i className="dot" style={{ background: '#3b82f6' }} />节目段</span>
        <span><i className="dot dot-hatch" />封锁段</span>
        <span><i className="dot" style={{ background: '#f6ad55' }} />点火点位</span>
      </div>
    </div>
  );
}
