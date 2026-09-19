import { useEffect, useMemo, useState } from 'react';
import {
  MIN_SEPARATION_M,
  MODEL_OPTIONS,
  MUSIC_MOMENT_TOLERANCE_S,
  adjacentPairs,
  findSegmentProblems,
  formatTime,
  pointFieldProblems,
  presetBlocked,
  presetPoints,
  presetSegments,
  reviewPoints,
  type AppState,
  type Point,
  type ReleasedShow,
  type Segment,
} from './lib/show';
import Timeline from './components/Timeline';
import PointMap from './components/PointMap';
import ModelStats from './components/ModelStats';
import './styles.css';

const STORAGE_KEY = 'fireworks-review-console:v1';

function freshState(): AppState {
  return {
    points: presetPoints.map(p => ({ ...p })),
    segments: presetSegments.map(s => ({ ...s })),
    blocked: presetBlocked.map(b => ({ ...b })),
    released: null,
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as AppState;
    if (!Array.isArray(parsed.points) || !Array.isArray(parsed.segments) || !Array.isArray(parsed.blocked)) {
      return freshState();
    }
    return { points: parsed.points, segments: parsed.segments, blocked: parsed.blocked, released: parsed.released ?? null };
  } catch {
    return freshState();
  }
}

const num = (v: string) => (v === '' ? 0 : Number(v));

function Step({ n, title, done, note }: { n: number; title: string; done: boolean; note: string }) {
  return (
    <div className={`step ${done ? 'done' : ''}`}>
      <span className="step-n">{done ? '✓' : n}</span>
      <div>
        <b>{title}</b>
        <small>{note}</small>
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [result, setResult] = useState<{ ok: boolean; messages: string[] } | null>(null);

  // 数据只存本地：任何变更即写入 localStorage，刷新后保留
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 存储不可用时静默忽略 */
    }
  }, [state]);

  const reviewed = useMemo(() => reviewPoints(state.points, state.blocked), [state.points, state.blocked]);
  const segProblems = useMemo(() => findSegmentProblems(state.segments), [state.segments]);
  const fieldProblems = useMemo(
    () => state.points.map(p => ({ name: p.name, probs: pointFieldProblems(p) })),
    [state.points]
  );
  const pairs = useMemo(() => adjacentPairs(state.points), [state.points]);

  const pendingCount = reviewed.filter(p => p.issues.length > 0).length;
  const fieldProblemCount = fieldProblems.filter(f => f.probs.length > 0).length;

  // 当前全部待复核 / 拒绝事由（提交时复用同一份计算）
  const currentProblems = useMemo(() => {
    const list: string[] = [];
    fieldProblems.forEach(f => f.probs.forEach(pr => list.push(`${f.name} 登记项无效：${pr}`)));
    reviewed.forEach(p => p.issues.forEach(i => list.push(`${p.name} 待复核：${i}`)));
    segProblems.forEach(pr => {
      if (pr.type === 'invalid') list.push(`段落「${pr.seg.name}」起止时间无效（需开始 < 结束）`);
      else list.push(`段落重叠：「${pr.a.name}」与「${pr.b.name}」(${formatTime(pr.a.start)}–${formatTime(pr.a.end)} / ${formatTime(pr.b.start)}–${formatTime(pr.b.end)})`);
    });
    return list;
  }, [fieldProblems, reviewed, segProblems]);

  const dirty = useMemo(() => {
    if (!state.released) return false;
    return (
      JSON.stringify(state.points) !== JSON.stringify(state.released.points) ||
      JSON.stringify(state.segments) !== JSON.stringify(state.released.segments) ||
      JSON.stringify(state.blocked) !== JSON.stringify(state.released.blocked)
    );
  }, [state]);

  const step1Done = fieldProblemCount === 0;
  const step2Done = step1Done && pendingCount === 0 && segProblems.length === 0;
  const step3Done = !!state.released && !dirty;
  const progressPct = (((step1Done ? 1 : 0) + (step2Done ? 1 : 0) + (step3Done ? 1 : 0)) / 3) * 100;

  const patchPoint = (id: string, patch: Partial<Point>) =>
    setState(s => ({ ...s, points: s.points.map(p => (p.id === id ? { ...p, ...patch } : p)) }));
  const patchSegment = (id: string, patch: Partial<Segment>) =>
    setState(s => ({ ...s, segments: s.segments.map(g => (g.id === id ? { ...g, ...patch } : g)) }));
  const patchBlocked = (id: string, patch: Partial<Segment>) =>
    setState(s => ({ ...s, blocked: s.blocked.map(g => (g.id === id ? { ...g, ...patch } : g)) }));

  const submit = () => {
    if (currentProblems.length > 0) {
      // 拒绝：不改动任何状态，配点表与进度保持不变
      setResult({ ok: false, messages: currentProblems });
      return;
    }
    const released: ReleasedShow = {
      points: state.points.map(p => ({ ...p })),
      segments: state.segments.map(s => ({ ...s })),
      blocked: state.blocked.map(b => ({ ...b })),
      releasedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    setState(s => ({ ...s, released }));
    setResult({
      ok: true,
      messages: [`复核通过，已放行 ${released.points.length} 个点位 / ${released.segments.length} 段节目，时间轴、点位图、型号统计已同步`],
    });
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(freshState());
    setResult(null);
  };

  const statusText = !state.released ? '未放行' : dirty ? '已放行 · 有未提交修改' : '已放行';
  const statusClass = !state.released ? 'idle' : dirty ? 'warn' : 'ok';
  const syncBadge = !state.released ? (
    <span className="tag idle">未放行</span>
  ) : dirty ? (
    <span className="tag warn">展示上次放行快照 · 当前有未提交修改</span>
  ) : (
    <span className="tag ok">已同步 · {state.released.releasedAt}</span>
  );

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>烟花燃放点位复核台</h1>
          <p className="sub">单页复核工作台 · 数据仅保存于本机浏览器（localStorage），刷新不丢失</p>
        </div>
        <div className="top-actions">
          <span className={`badge ${statusClass}`}>{statusText}</span>
          <button className="ghost" onClick={reset}>重置预置数据</button>
          <button className="primary" onClick={submit}>整场提交</button>
        </div>
      </header>

      {result && (
        <div className={`banner ${result.ok ? 'ok' : 'err'}`}>
          <strong>{result.ok ? '✓ 放行成功' : '✕ 提交被拒绝 —— 配点表与进度保持不变'}</strong>
          <ul>
            {result.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card progress-card">
        <div className="steps">
          <Step n={1} title="点位登记" done={step1Done} note={step1Done ? `${state.points.length} 个点位登记完整` : `${fieldProblemCount} 个点位登记项待补`} />
          <Step
            n={2}
            title="复核通过"
            done={step2Done}
            note={step2Done ? '无待复核点位 · 段落无重叠' : `待复核 ${pendingCount} 点位 · 段落问题 ${segProblems.length} 项`}
          />
          <Step
            n={3}
            title="整场放行"
            done={step3Done}
            note={!state.released ? '待提交' : dirty ? '有未提交的修改' : `已于 ${state.released.releasedAt} 放行`}
          />
        </div>
        <div className="progress-bar">
          <i style={{ width: `${progressPct}%` }} />
        </div>
        <p className="progress-note">
          正常 {reviewed.length - pendingCount} · 待复核 {pendingCount} · 已排片 {state.released ? state.released.points.length : 0}/{state.points.length}
        </p>
      </section>

      <div className="grid">
        <section className="card span2">
          <div className="card-head">
            <h2>① 配点表（点位登记）</h2>
            <span className="hint">
              相邻点位同一音乐时刻（±{MUSIC_MOMENT_TOLERANCE_S}s）发射角交叉且间距 &lt; {MIN_SEPARATION_M}m，或点火落入封锁段 → 待复核，不能排片
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>点位</th>
                  <th>型号</th>
                  <th>口径 mm</th>
                  <th>发射角 °</th>
                  <th>点火时间 s</th>
                  <th>安全距离 m</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((p, idx) => {
                  const fp = fieldProblems[idx].probs;
                  const tag = fp.length > 0 ? (
                    <span className="tag warn" title={fp.join('；')}>登记不全</span>
                  ) : p.issues.length > 0 ? (
                    <span className="tag bad" title={p.issues.join('；')}>待复核 · 禁排</span>
                  ) : (
                    <span className="tag ok">正常</span>
                  );
                  return (
                    <tr key={p.id} className={p.issues.length > 0 || fp.length > 0 ? 'row-bad' : ''}>
                      <td className="pt-name">{p.name}</td>
                      <td>
                        <select value={p.model} onChange={e => patchPoint(p.id, { model: e.target.value })}>
                          {MODEL_OPTIONS.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="number" min={0} value={p.caliber} onChange={e => patchPoint(p.id, { caliber: num(e.target.value) })} /></td>
                      <td><input type="number" min={0} max={359} value={p.angle} onChange={e => patchPoint(p.id, { angle: num(e.target.value) })} /></td>
                      <td>
                        <input type="number" min={0} value={p.fireTime} onChange={e => patchPoint(p.id, { fireTime: num(e.target.value) })} />
                        <small className="fmt">{formatTime(p.fireTime)}</small>
                      </td>
                      <td><input type="number" min={0} value={p.safety} onChange={e => patchPoint(p.id, { safety: num(e.target.value) })} /></td>
                      <td>{tag}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pairs">
            {pairs.map(({ a, b, dist }) => (
              <span key={a.id + b.id} className={dist < MIN_SEPARATION_M ? 'pair bad' : 'pair'}>
                {a.id}–{b.id} {dist.toFixed(1)}m{dist < MIN_SEPARATION_M ? '（不足 30m）' : ''}
              </span>
            ))}
          </div>
          <div className="issues">
            <h3>实时复核结果</h3>
            {currentProblems.length === 0 ? (
              <p className="ok-text">当前无待复核项，可提交整场。</p>
            ) : (
              <ul>
                {currentProblems.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>② 节目段落</h2>
            <span className="hint">段落相互重叠时整场提交将被拒绝</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>段落</th>
                <th>开始 s</th>
                <th>结束 s</th>
                <th>时长</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {state.segments.map(seg => {
                const invalid = !(seg.start < seg.end);
                const overlapped = segProblems.some(pr => pr.type === 'overlap' && (pr.a.id === seg.id || pr.b.id === seg.id));
                return (
                  <tr key={seg.id} className={invalid || overlapped ? 'row-bad' : ''}>
                    <td><input className="seg-name" value={seg.name} onChange={e => patchSegment(seg.id, { name: e.target.value })} /></td>
                    <td><input type="number" min={0} value={seg.start} onChange={e => patchSegment(seg.id, { start: num(e.target.value) })} /></td>
                    <td><input type="number" min={0} value={seg.end} onChange={e => patchSegment(seg.id, { end: num(e.target.value) })} /></td>
                    <td className="muted">{invalid ? '—' : `${formatTime(seg.start)}–${formatTime(seg.end)}`}</td>
                    <td>{invalid ? <span className="tag bad">无效</span> : overlapped ? <span className="tag bad">重叠</span> : <span className="tag ok">正常</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 className="blocked-title">封锁段（点火落入即待复核）</h3>
          <table>
            <thead>
              <tr>
                <th>封锁段</th>
                <th>开始 s</th>
                <th>结束 s</th>
                <th>区间</th>
              </tr>
            </thead>
            <tbody>
              {state.blocked.map(seg => (
                <tr key={seg.id} className="row-blocked">
                  <td><input className="seg-name" value={seg.name} onChange={e => patchBlocked(seg.id, { name: e.target.value })} /></td>
                  <td><input type="number" min={0} value={seg.start} onChange={e => patchBlocked(seg.id, { start: num(e.target.value) })} /></td>
                  <td><input type="number" min={0} value={seg.end} onChange={e => patchBlocked(seg.id, { end: num(e.target.value) })} /></td>
                  <td className="muted">{seg.start < seg.end ? `${formatTime(seg.start)}–${formatTime(seg.end)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>③ 时间轴</h2>
            {syncBadge}
          </div>
          <Timeline released={state.released} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>④ 点位平面图</h2>
            {syncBadge}
          </div>
          <PointMap released={state.released} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>⑤ 型号统计</h2>
            {syncBadge}
          </div>
          <ModelStats released={state.released} />
        </section>
      </div>
    </main>
  );
}
