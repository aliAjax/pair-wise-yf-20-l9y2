import { useRef } from "react";
import type { FirePoint, Segment, PointIssue } from "../types";
import {
  MIN_DISTANCE,
  RAY_LENGTH,
  distance,
  rayIntersection,
  rayVector,
} from "../lib";

interface Props {
  points: FirePoint[];
  segments: Segment[];
  issues: Record<string, PointIssue[]>;
  scheduled: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
}

const M = 24; // 边距（SVG px）
const FW = 120; // 场地宽（米）
const FH = 100; // 场地高（米）
const SCALE = 5; // 1m = 5px

export default function PointMap({
  points,
  segments,
  issues,
  scheduled,
  selectedId,
  onSelect,
  onMove,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  const sx = (x: number) => M + x * SCALE;
  const sy = (y: number) => M + (FH - y) * SCALE;

  const toMeters = (clientX: number, clientY: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.round(Math.min(FW, Math.max(0, (p.x - M) / SCALE))),
      y: Math.round(Math.min(FH, Math.max(0, FH - (p.y - M) / SCALE))),
    };
  };

  // 同刻相邻且交叉的点对（与判定规则一致），用于绘制交叉标记
  const crosses: { x: number; y: number; ids: [string, string] }[] = [];
  const byTime = new Map<number, FirePoint[]>();
  points.forEach((p) => {
    const l = byTime.get(p.ignite) ?? [];
    l.push(p);
    byTime.set(p.ignite, l);
  });
  for (const list of byTime.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (distance(a, b) < MIN_DISTANCE) {
          const hit = rayIntersection(a, b);
          if (hit) crosses.push({ ...hit, ids: [a.id, b.id] });
        }
      }
    }
  }

  const blockedRects = segments
    .filter((s) => s.blocked)
    .map((s, i) => ({ s, shade: i }));

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>点位平面图</h2>
        <span className="hint">圆点可拖拽移动 · 红线为发射轨迹 · 虚线圆为安全距离</span>
      </div>
      <svg
        ref={svgRef}
        className="point-map"
        viewBox={`0 0 ${FW * SCALE + M * 2} ${FH * SCALE + M * 2}`}
        onPointerMove={(e) => {
          if (!dragId.current) return;
          const { x, y } = toMeters(e.clientX, e.clientY);
          onMove(dragId.current, x, y);
        }}
        onPointerUp={() => (dragId.current = null)}
        onPointerLeave={() => (dragId.current = null)}
      >
        {/* 底图与网格 */}
        <rect
          x={M}
          y={M}
          width={FW * SCALE}
          height={FH * SCALE}
          className="field-bg"
        />
        {Array.from({ length: FW / 20 + 1 }, (_, i) => (
          <g key={`gx${i}`}>
            <line
              x1={sx(i * 20)}
              y1={sy(0)}
              x2={sx(i * 20)}
              y2={sy(FH)}
              className="grid-line"
            />
            <text x={sx(i * 20)} y={sy(0) + 12} className="grid-label">
              {i * 20}
            </text>
          </g>
        ))}
        {Array.from({ length: FH / 20 + 1 }, (_, i) => (
          <g key={`gy${i}`}>
            <line
              x1={sx(0)}
              y1={sy(i * 20)}
              x2={sx(FW)}
              y2={sy(i * 20)}
              className="grid-line"
            />
            <text x={sx(0) - 4} y={sy(i * 20) + 3} className="grid-label" textAnchor="end">
              {i * 20}
            </text>
          </g>
        ))}

        {/* 封锁段提示条（时间规则在时间轴体现，这里仅做图例性标注） */}
        {blockedRects.map(({ s }) => (
          <text key={s.id} x={M + 6} y={M + 16} className="blocked-note">
            ⛔ 封锁段：{s.name}
          </text>
        ))}

        {/* 安全距离圈 + 发射轨迹 */}
        {points.map((p) => {
          const v = rayVector(p.azimuth);
          const pending = !!issues[p.id];
          const done = scheduled.has(p.id);
          const cls = pending ? "ray-pending" : done ? "ray-scheduled" : "ray-draft";
          return (
            <g key={`ray${p.id}`}>
              <circle
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={p.safe * SCALE}
                className={pending ? "safe-pending" : "safe-circle"}
              />
              <line
                x1={sx(p.x)}
                y1={sy(p.y)}
                x2={sx(p.x + v.dx * RAY_LENGTH)}
                y2={sy(p.y + v.dy * RAY_LENGTH)}
                className={cls}
              />
            </g>
          );
        })}

        {/* 交叉标记 */}
        {crosses.map((c, i) => (
          <g key={`cross${i}`}>
            <circle cx={sx(c.x)} cy={sy(c.y)} r={7} className="cross-mark" />
            <line
              x1={sx(c.x) - 4}
              y1={sy(c.y) - 4}
              x2={sx(c.x) + 4}
              y2={sy(c.y) + 4}
              className="cross-mark-x"
            />
            <line
              x1={sx(c.x) - 4}
              y1={sy(c.y) + 4}
              x2={sx(c.x) + 4}
              y2={sy(c.y) - 4}
              className="cross-mark-x"
            />
          </g>
        ))}

        {/* 点位 */}
        {points.map((p) => {
          const pending = !!issues[p.id];
          const done = scheduled.has(p.id);
          const cls = pending
            ? "marker-pending"
            : done
            ? "marker-scheduled"
            : "marker-draft";
          return (
            <g
              key={p.id}
              className={`marker ${selectedId === p.id ? "marker-selected" : ""}`}
              onPointerDown={(e) => {
                e.preventDefault();
                dragId.current = p.id;
                onSelect(p.id);
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }}
            >
              <circle cx={sx(p.x)} cy={sy(p.y)} r={8} className={cls} />
              <text
                x={sx(p.x) + 11}
                y={sy(p.y) + 4}
                className={pending ? "marker-label marker-label-pending" : "marker-label"}
              >
                {p.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i className="dot dot-draft" /> 待提交</span>
        <span><i className="dot dot-pending" /> 待复核（不能排片）</span>
        <span><i className="dot dot-scheduled" /> 已放行排片</span>
        <span><i className="cross-legend" /> 发射角交叉</span>
      </div>
    </div>
  );
}
