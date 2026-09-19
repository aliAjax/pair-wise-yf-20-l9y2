import type { FirePoint, Segment, Snapshot } from "../types";
import { formatTime } from "../lib";

interface Props {
  snapshot: Snapshot | null;
}

const W = 960;
const H = 220;
const PAD_L = 44;
const PAD_R = 16;
const AXIS_Y = 150;
const LANE_H = 26;

export default function Timeline({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h2>时间轴</h2>
          <span className="hint">放行后生成（已锁定版本）</span>
        </div>
        <div className="empty-box">尚未放行 —— 整场提交通过后，时间轴在此生成</div>
      </div>
    );
  }

  const { points, segments } = snapshot;
  const span = Math.max(
    60,
    ...segments.map((s) => s.end),
    ...points.map((p) => p.ignite)
  );
  const span5 = Math.ceil(span / 5) * 5;
  const innerW = W - PAD_L - PAD_R;
  const x = (sec: number) => PAD_L + (sec / span5) * innerW;

  // 泳道贪心分配
  const lanes: Segment[][] = [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  for (const s of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      if (last.end <= s.start) {
        lanes[i].push(s);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([s]);
  }

  const ticks: number[] = [];
  for (let t = 0; t <= span5; t += span5 > 120 ? 15 : 10) ticks.push(t);
  if (ticks[ticks.length - 1] !== span5) ticks.push(span5);

  // 点火标记：同时刻纵向排开
  const byT = new Map<number, FirePoint[]>();
  points.forEach((p) => {
    const l = byT.get(p.ignite) ?? [];
    l.push(p);
    byT.set(p.ignite, l);
  });

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>时间轴（已放行 {snapshot.at}）</h2>
        <span className="hint">只读快照 · 编辑后需重新提交整场</span>
      </div>
      <svg className="timeline" viewBox={`0 0 ${W} ${H}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={AXIS_Y - 4} x2={x(t)} y2={AXIS_Y + 6} className="tick" />
            <text x={x(t)} y={AXIS_Y + 22} className="tick-label" textAnchor="middle">
              {formatTime(t)}
            </text>
          </g>
        ))}
        <line x1={PAD_L} y1={AXIS_Y} x2={W - PAD_R} y2={AXIS_Y} className="axis" />

        {/* 段落泳道 */}
        {lanes.map((lane, li) =>
          lane.map((s) => {
            const x0 = x(s.start);
            const w = Math.max(4, x(s.end) - x(s.start));
            const y = AXIS_Y - 30 - li * LANE_H;
            return (
              <g key={s.id}>
                <rect
                  x={x0}
                  y={y - 16}
                  width={w}
                  height={18}
                  rx={4}
                  className={s.blocked ? "seg-bar seg-bar-blocked" : "seg-bar"}
                />
                <text x={x0 + 6} y={y - 3} className="seg-bar-label">
                  {s.name}
                  {s.blocked ? " ⛔" : ""}
                </text>
              </g>
            );
          })
        )}

        {/* 点火节点 */}
        {[...byT.entries()].map(([t, list]) =>
          list.map((p, i) => {
            const stack = Math.floor(i / 1);
            return (
              <g key={p.id}>
                <line
                  x1={x(t)}
                  y1={AXIS_Y + 6}
                  x2={x(t)}
                  y2={AXIS_Y + 30 + stack * 16}
                  className="cue-line"
                />
                <circle cx={x(t)} cy={AXIS_Y + 34 + stack * 16} r={5} className="cue-dot" />
                <text
                  x={x(t) + 8}
                  y={AXIS_Y + 38 + stack * 16}
                  className="cue-label"
                >
                  {p.name.replace(/^P\d+\s*/, "")}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
