import { modelStats, type ReleasedShow } from '../lib/show';

export default function ModelStats({ released }: { released: ReleasedShow | null }) {
  if (!released) return <div className="empty">整场提交放行后，此处生成型号统计</div>;

  const stats = modelStats(released.points);
  const max = Math.max(1, ...stats.map(s => s.count));

  return (
    <div className="stats">
      {stats.map(s => (
        <div className="stat-row" key={s.model}>
          <span className="stat-name">{s.model}</span>
          <div className="stat-bar">
            <i style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
          <span className="stat-count">
            {s.count} 点位 · {[...s.calibers].sort((a, b) => a - b).join(' / ')}mm
          </span>
        </div>
      ))}
      <p className="stat-total">共 {released.points.length} 个点位已排片 · 放行时间 {released.releasedAt}</p>
    </div>
  );
}
