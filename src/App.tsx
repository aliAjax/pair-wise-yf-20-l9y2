import { useEffect, useMemo, useState } from "react";
import type { FirePoint, Segment, Snapshot } from "./types";
import { SEED_POINTS, SEED_SEGMENTS } from "./seed";
import {
  validate,
  segmentOverlaps,
  loadState,
  saveState,
  isScheduled,
  formatTime,
} from "./lib";
import PointMap from "./components/PointMap";
import PointPanel from "./components/PointPanel";
import SegmentPanel from "./components/SegmentPanel";
import Timeline from "./components/Timeline";
import StatsPanel from "./components/StatsPanel";
import SubmitBar from "./components/SubmitBar";
import "./styles.css";

interface Banner {
  type: "reject" | "release";
  text: string;
}

let seq = 100;
const nextId = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;

export default function App() {
  const initial = useMemo(loadState, []);
  const [points, setPoints] = useState<FirePoint[]>(initial.points);
  const [segments, setSegments] = useState<Segment[]>(initial.segments);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initial.snapshot);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.points[0]?.id ?? null
  );
  const [banner, setBanner] = useState<Banner | null>(null);

  // 数据只存本地：草稿与已放行版本均持久化，刷新保留
  useEffect(() => {
    saveState({ points, segments, snapshot });
  }, [points, segments, snapshot]);

  const result = useMemo(() => validate(points, segments), [points, segments]);
  const overlaps = useMemo(() => segmentOverlaps(segments), [segments]);
  const overlapKeys = useMemo(() => {
    const set = new Set<string>();
    overlaps.forEach(([a, b]) => {
      set.add(a.id);
      set.add(b.id);
    });
    return set;
  }, [overlaps]);
  const invalidIds = useMemo(
    () => new Set(result.invalidSegmentIds),
    [result.invalidSegmentIds]
  );

  const scheduled = useMemo(() => {
    const set = new Set<string>();
    points.forEach((p) => {
      if (isScheduled(snapshot, p)) set.add(p.id);
    });
    return set;
  }, [points, snapshot]);

  const canSubmit =
    points.length > 0 &&
    result.pending.size === 0 &&
    overlaps.length === 0 &&
    result.invalidSegmentIds.length === 0;

  /* ---------- 点位编辑 ---------- */

  const updatePoint = (id: string, patch: Partial<FirePoint>) => {
    setPoints((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setBanner(null);
  };
  const deletePoint = (id: string) => {
    setPoints((ps) => ps.filter((p) => p.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
    setBanner(null);
  };
  const addPoint = () => {
    const p: FirePoint = {
      id: nextId("p"),
      name: `P${points.length + 1} 新点位`,
      model: "礼花弹 A 型",
      caliber: 76,
      azimuth: 0,
      x: 60,
      y: 50,
      ignite: 0,
      safe: 20,
    };
    setPoints((ps) => [...ps, p]);
    setSelectedId(p.id);
    setBanner(null);
  };

  /* ---------- 段落编辑 ---------- */

  const updateSegment = (id: string, patch: Partial<Segment>) => {
    setSegments((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setBanner(null);
  };
  const deleteSegment = (id: string) => {
    setSegments((ss) => ss.filter((s) => s.id !== id));
    setBanner(null);
  };
  const addSegment = () => {
    const max = segments.reduce((m, s) => Math.max(m, s.end), 0);
    setSegments((ss) => [
      ...ss,
      {
        id: nextId("s"),
        name: `段落 ${ss.length + 1}`,
        start: max,
        end: max + 20,
        blocked: false,
      },
    ]);
    setBanner(null);
  };

  /* ---------- 整场提交 ---------- */

  const handleSubmit = () => {
    const pendingList = points.filter((p) => result.pending.has(p.id));
    // 规则：任一点位待复核或段落重叠即拒绝；配点表和进度不变（草稿不被修改）
    if (pendingList.length > 0 || overlaps.length > 0) {
      const reasons: string[] = [];
      if (pendingList.length > 0)
        reasons.push(
          `${pendingList.length} 个点位待复核（${pendingList
            .map((p) => p.name)
            .join("、")}），不能排片`
        );
      if (overlaps.length > 0)
        reasons.push(
          `${overlaps.length} 组段落重叠（${overlaps
            .map(([a, b]) => `「${a.name}」×「${b.name}」`)
            .join("、")}）`
        );
      setBanner({
        type: "reject",
        text: `整场提交被拒绝：${reasons.join("；")}。配点表与进度保持不变。`,
      });
      return;
    }

    // 放行：锁定快照，时间轴 / 点位图 / 型号统计同步
    const now = new Date();
    const snap: Snapshot = {
      points: points.map((p) => ({ ...p })),
      segments: segments.map((s) => ({ ...s })),
      at: `${formatTime(
        now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
      )} 锁定`,
    };
    setSnapshot(snap);
    setBanner({
      type: "release",
      text: `整场已放行：${snap.points.length} 个点位全部排片，时间轴、点位图与型号统计已同步。`,
    });
  };

  const handleReset = () => {
    if (!window.confirm("清空本地数据并恢复预置四点 / 三段节目？")) return;
    setPoints(SEED_POINTS.map((p) => ({ ...p })));
    setSegments(SEED_SEGMENTS.map((s) => ({ ...s })));
    setSnapshot(null);
    setSelectedId(SEED_POINTS[0].id);
    setBanner(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>烟花燃放点位复核台</h1>
          <p className="sub">
            同音乐时刻相邻（&lt;30m）且发射角交叉、或点火落入封锁段 →
            待复核且不排片；整场提交存在待复核点位或段落重叠即拒绝。
          </p>
        </div>
        <div className="top-right">
          <span className={`status ${snapshot ? "status-ok" : ""}`}>
            {snapshot ? "● 已放行版本生效中" : "○ 未放行（草稿）"}
          </span>
          <span className="storage">数据仅存本地 · 刷新保留</span>
        </div>
      </header>

      {banner && (
        <div className={`banner banner-${banner.type}`}>
          {banner.type === "reject" ? "⛔ " : "✓ "}
          {banner.text}
        </div>
      )}

      <SubmitBar
        total={points.length}
        pendingCount={result.pending.size}
        overlapCount={overlaps.length}
        invalidCount={result.invalidSegmentIds.length}
        hasSnapshot={!!snapshot}
        canSubmit={canSubmit}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

      <div className="grid">
        <div className="col col-left">
          <PointMap
            points={points}
            segments={segments}
            issues={result.issues}
            scheduled={scheduled}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={(id, x, y) => updatePoint(id, { x, y })}
          />
          <SegmentPanel
            segments={segments}
            overlapKeys={overlapKeys}
            invalidIds={invalidIds}
            onUpdate={updateSegment}
            onDelete={deleteSegment}
            onAdd={addSegment}
          />
        </div>
        <div className="col col-right">
          <PointPanel
            points={points}
            issues={result.issues}
            scheduled={scheduled}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updatePoint}
            onDelete={deletePoint}
            onAdd={addPoint}
          />
        </div>
      </div>

      <div className="grid grid-bottom">
        <Timeline snapshot={snapshot} />
        <StatsPanel snapshot={snapshot} />
      </div>
    </div>
  );
}
