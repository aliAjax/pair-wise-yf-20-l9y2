import type { Segment } from "../types";
import TimeInput from "./TimeInput";

interface Props {
  segments: Segment[];
  overlapKeys: Set<string>;
  invalidIds: Set<string>;
  onUpdate: (id: string, patch: Partial<Segment>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function SegmentPanel({
  segments,
  overlapKeys,
  invalidIds,
  onUpdate,
  onDelete,
  onAdd,
}: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>节目段落（{segments.length}）</h2>
        <button className="btn btn-small" onClick={onAdd}>
          ＋ 新增段落
        </button>
      </div>
      <ul className="seg-list">
        {segments.map((s) => {
          const invalid = invalidIds.has(s.id);
          const overlap = overlapKeys.has(s.id);
          return (
            <li
              key={s.id}
              className={`seg-item ${s.blocked ? "seg-blocked" : ""} ${
                overlap ? "seg-overlap" : ""
              } ${invalid ? "seg-invalid" : ""}`}
            >
              <input
                className="seg-name"
                value={s.name}
                onChange={(e) => onUpdate(s.id, { name: e.target.value })}
              />
              <span className="seg-times">
                <TimeInput
                  value={s.start}
                  invalid={invalid}
                  onChange={(v) => onUpdate(s.id, { start: v })}
                />
                <span className="sep">–</span>
                <TimeInput
                  value={s.end}
                  invalid={invalid}
                  onChange={(v) => onUpdate(s.id, { end: v })}
                />
              </span>
              <label className="check">
                <input
                  type="checkbox"
                  checked={s.blocked}
                  onChange={(e) => onUpdate(s.id, { blocked: e.target.checked })}
                />
                封锁段
              </label>
              {invalid && <span className="issue issue-cross">时长非法</span>}
              {overlap && <span className="issue issue-cross">段落重叠</span>}
              <button className="btn-x" onClick={() => onDelete(s.id)}>
                ×
              </button>
            </li>
          );
        })}
        {segments.length === 0 && <li className="empty-row">尚无段落</li>}
      </ul>
    </div>
  );
}
