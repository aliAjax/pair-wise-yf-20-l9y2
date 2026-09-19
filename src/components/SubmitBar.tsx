interface Props {
  total: number;
  pendingCount: number;
  overlapCount: number;
  invalidCount: number;
  hasSnapshot: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onReset: () => void;
}

export default function SubmitBar({
  total,
  pendingCount,
  overlapCount,
  invalidCount,
  hasSnapshot,
  canSubmit,
  onSubmit,
  onReset,
}: Props) {
  const steps = [
    { label: "登记点位", done: total > 0 },
    { label: "复核通过", done: canSubmit && total > 0 },
    { label: "整场放行", done: hasSnapshot },
  ];
  const active = canSubmit ? (hasSnapshot ? 3 : 2) : total > 0 ? 1 : 0;

  return (
    <div className="submit-bar panel">
      <div className="stepper">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={`step ${s.done ? "step-done" : ""} ${
              active === i + 1 && !s.done ? "step-active" : ""
            }`}
          >
            <span className="step-no">{s.done ? "✓" : i + 1}</span>
            <span className="step-label">{s.label}</span>
            {i < steps.length - 1 && <span className="step-line" />}
          </div>
        ))}
      </div>

      <div className="submit-side">
        <div className="check-lines">
          <span className={pendingCount === 0 ? "ok" : "bad"}>
            {pendingCount === 0 ? "✓" : "✕"} 待复核点位 {pendingCount}
          </span>
          <span className={overlapCount === 0 ? "ok" : "bad"}>
            {overlapCount === 0 ? "✓" : "✕"} 段落重叠 {overlapCount}
          </span>
          {invalidCount > 0 && <span className="bad">✕ 非法段落 {invalidCount}</span>}
        </div>
        <button className="btn btn-primary" disabled={!canSubmit} onClick={onSubmit}>
          整场提交并放行
        </button>
        <button className="btn btn-ghost" onClick={onReset} title="清空本地数据并恢复预置">
          重置
        </button>
      </div>
    </div>
  );
}
