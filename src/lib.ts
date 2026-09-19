import type {
  FirePoint,
  Segment,
  ValidationResult,
  PointIssue,
  Snapshot,
  PersistedState,
} from "./types";
import { SEED_POINTS, SEED_SEGMENTS } from "./seed";

export const MIN_DISTANCE = 30; // 相邻点位最小距离（米）
export const RAY_LENGTH = 100; // 发射轨迹判定长度（米）
const STORAGE_KEY = "fireworks-review-console-v1";

/* ---------- 时间 ---------- */

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** 解析 mm:ss，非法返回 null */
export function parseTime(text: string): number | null {
  const m = /^\s*(\d{1,3}):([0-5]?\d)\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function timeClampLabel(sec: number, span: number): string {
  return formatTime(sec) + (sec >= span ? "+" : "");
}

/* ---------- 几何 ---------- */

export function distance(a: FirePoint, b: FirePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 方位角转单位方向（0=北，顺时针） */
export function rayVector(azimuth: number): { dx: number; dy: number } {
  const rad = ((azimuth % 360) * Math.PI) / 180;
  return { dx: Math.sin(rad), dy: Math.cos(rad) };
}

/** 计算两发射线在各自正前方 RAY_LENGTH 内是否交叉，返回交叉点或 null */
export function rayIntersection(
  a: FirePoint,
  b: FirePoint
): { x: number; y: number } | null {
  const u = rayVector(a.azimuth);
  const v = rayVector(b.azimuth);
  const wx = b.x - a.x;
  const wy = b.y - a.y;
  const det = v.dx * u.dy - u.dx * v.dy;
  if (Math.abs(det) < 1e-9) return null; // 平行
  const t = (v.dx * wy - wy * 0 - wx * v.dy) / det; // a 方向参数
  const k = (u.dx * wy - wx * u.dy) / det; // b 方向参数
  if (t > 0.01 && k > 0.01 && t <= RAY_LENGTH && k <= RAY_LENGTH) {
    return { x: a.x + u.dx * t, y: a.y + u.dy * t };
  }
  return null;
}

/* ---------- 复核判定 ---------- */

/** 时间是否落在封锁段内（半开区间 [start,end)） */
export function isInBlocked(sec: number, segments: Segment[]): Segment[] {
  return segments.filter((s) => s.blocked && sec >= s.start && sec < s.end);
}

/** 段落重叠对（仅对有效段落） */
export function segmentOverlaps(segments: Segment[]): [Segment, Segment][] {
  const valid = segments.filter((s) => s.end > s.start);
  const pairs: [Segment, Segment][] = [];
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i];
      const b = valid[j];
      if (a.start < b.end && b.start < a.end) pairs.push([a, b]);
    }
  }
  return pairs;
}

export function validate(
  points: FirePoint[],
  segments: Segment[]
): ValidationResult {
  const issues: Record<string, PointIssue[]> = {};
  const addIssue = (id: string, issue: PointIssue) => {
    (issues[id] ||= []).push(issue);
  };

  // 规则一：同音乐时刻（点火时间相同）内，相邻（距离<30m）且发射角交叉
  const byTime = new Map<number, FirePoint[]>();
  for (const p of points) {
    const list = byTime.get(p.ignite) ?? [];
    list.push(p);
    byTime.set(p.ignite, list);
  }
  for (const list of byTime.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const d = distance(a, b);
        if (d < MIN_DISTANCE) {
          const hit = rayIntersection(a, b);
          if (hit) {
            const desc = `与 ${b.name} 同刻点火、相距 ${d.toFixed(1)}m（<${MIN_DISTANCE}m）且发射角交叉`;
            addIssue(a.id, { kind: "cross", text: desc });
            addIssue(b.id, {
              kind: "cross",
              text: `与 ${a.name} 同刻点火、相距 ${d.toFixed(1)}m（<${MIN_DISTANCE}m）且发射角交叉`,
            });
          }
        }
      }
    }
  }

  // 规则二：点火落在封锁段
  for (const p of points) {
    for (const s of isInBlocked(p.ignite, segments)) {
      addIssue(p.id, {
        kind: "blocked",
        text: `点火 ${formatTime(p.ignite)} 落在封锁段「${s.name}」(${formatTime(
          s.start
        )}-${formatTime(s.end)})`,
      });
    }
  }

  const overlaps = segmentOverlaps(segments);
  const invalidSegmentIds = segments
    .filter((s) => s.end <= s.start)
    .map((s) => s.id);
  const pending = new Set(Object.keys(issues));

  return { issues, overlaps, invalidSegmentIds, pending };
}

/* ---------- 型号统计 ---------- */

export interface ModelStat {
  model: string;
  caliber: number;
  count: number;
  ids: string[];
}

export function modelStats(points: FirePoint[]): ModelStat[] {
  const map = new Map<string, ModelStat>();
  for (const p of points) {
    const key = `${p.model}__${p.caliber}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      cur.ids.push(p.id);
    } else {
      map.set(key, {
        model: p.model,
        caliber: p.caliber,
        count: 1,
        ids: [p.id],
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.model === b.model ? a.caliber - b.caliber : a.model.localeCompare(b.model)
  );
}

/* ---------- 本地持久化 ---------- */

export function loadState(): PersistedState {
  const fallback: PersistedState = {
    points: SEED_POINTS,
    segments: SEED_SEGMENTS,
    snapshot: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.points) || !Array.isArray(parsed.segments)) {
      return fallback;
    }
    return {
      points: parsed.points,
      segments: parsed.segments,
      snapshot: parsed.snapshot ?? null,
    };
  } catch {
    return fallback;
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默降级
  }
}

export function isScheduled(snapshot: Snapshot | null, p: FirePoint): boolean {
  if (!snapshot) return false;
  return snapshot.points.some(
    (q) =>
      q.id === p.id &&
      q.ignite === p.ignite &&
      q.x === p.x &&
      q.y === p.y &&
      q.azimuth === p.azimuth &&
      q.model === p.model &&
      q.caliber === p.caliber &&
      q.safe === p.safe
  );
}
