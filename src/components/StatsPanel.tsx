import type { Snapshot } from "../types";
import { modelStats } from "../lib";

interface Props {
  snapshot: Snapshot | null;
}

export default function StatsPanel({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>型号统计</h2>
          <span className="hint">放行后同步</span>
        </div>
        <div className="empty-box">尚未放行</div>
      </div>
    );
  }

  const stats = modelStats(snapshot.points);
  const total = snapshot.points.length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>型号统计</h2>
        <span className="hint">已放行版本 · 共 {total} 个点位</span>
      </div>
      <ul className="stat-list">
        {stats.map((s) => (
          <li key={`${s.model}-${s.caliber}`}>
            <span className="stat-model">{s.model}</span>
            <span className="stat-cal">{s.caliber} mm</span>
            <span className="bar-wrap">
              <span
                className="bar"
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            </span>
            <span className="stat-count">
              {s.count} 点 · {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
