import type { ReactNode } from "react";
import type { FirePoint, PointIssue } from "../types";
import { formatTime } from "../lib";
import TimeInput from "./TimeInput";

interface Props {
  points: FirePoint[];
  issues: Record<string, PointIssue[]>;
  scheduled: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<FirePoint>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function PointPanel({
  points,
  issues,
  scheduled,
  selectedId,
  onSelect,
  onUpdate,
  onDelete,
  onAdd,
}: Props) {
  const selected = points.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>配点表（{points.length}）</h2>
        <button className="btn btn-small" onClick={onAdd}>
          ＋ 登记点位
        </button>
      </div>

      <div className="table-wrap">
        <table className="point-table">
          <thead>
            <tr>
              <th>点位</th>
              <th>型号</th>
              <th>口径</th>
              <th>发射角</th>
              <th>点火</th>
              <th>安全距离</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => {
              const list = issues[p.id];
              const pending = !!list;
              const done = scheduled.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={
                    selectedId === p.id
                      ? "row-selected"
                      : pending
                      ? "row-pending"
                      : ""
                  }
                  onClick={() => onSelect(p.id)}
                >
                  <td className="cell-name">{p.name}</td>
                  <td>{p.model}</td>
                  <td className="num">{p.caliber} mm</td>
                  <td className="num">{p.azimuth}°</td>
                  <td className="num">{formatTime(p.ignite)}</td>
                  <td className="num">{p.safe} m</td>
                  <td>
                    {pending ? (
                      <span className="tag tag-pending">待复核</span>
                    ) : done ? (
                      <span className="tag tag-scheduled">已排片</span>
                    ) : (
                      <span className="tag tag-draft">待提交</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-x"
                      title="删除点位"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(p.id);
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
            {points.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  尚无点位，点击「登记点位」开始
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="editor">
          <div className="editor-title">
            编辑 {selected.name}
            {((): ReactNode => {
              const list = issues[selected.id];
              if (!list) return null;
              return list.map((iss, i) => (
                <span key={i} className={`issue issue-${iss.kind}`}>
                  {iss.kind === "blocked" ? "⛔ " : "✕ "}
                  {iss.text}
                </span>
              ));
            })()}
          </div>
          <div className="editor-grid">
            <label>
              型号
              <input
                value={selected.model}
                onChange={(e) => onUpdate(selected.id, { model: e.target.value })}
              />
            </label>
            <label>
              口径 (mm)
              <input
                type="number"
                min={1}
                value={selected.caliber}
                onChange={(e) =>
                  onUpdate(selected.id, {
                    caliber: Math.max(1, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              发射方位角 (0-359°)
              <input
                type="number"
                min={0}
                max={359}
                value={selected.azimuth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v))
                    onUpdate(selected.id, { azimuth: ((v % 360) + 360) % 360 });
                }}
              />
            </label>
            <label>
              点火时间
              <TimeInput
                value={selected.ignite}
                onChange={(sec) => onUpdate(selected.id, { ignite: sec })}
              />
            </label>
            <label>
              安全距离 (m)
              <input
                type="number"
                min={0}
                value={selected.safe}
                onChange={(e) =>
                  onUpdate(selected.id, { safe: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
            <label>
              坐标 X (m)
              <input
                type="number"
                min={0}
                value={selected.x}
                onChange={(e) =>
                  onUpdate(selected.id, { x: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
            <label>
              坐标 Y (m)
              <input
                type="number"
                min={0}
                value={selected.y}
                onChange={(e) =>
                  onUpdate(selected.id, { y: Math.max(0, Number(e.target.value) || 0) })
                }
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
