// 领域模型与复核规则：点位、节目段、封锁段、复核判定、统计

export interface Point {
  id: string;
  name: string;
  x: number; // 平面图坐标，单位米
  y: number; // 平面图坐标，单位米
  model: string; // 烟花型号
  caliber: number; // 口径 mm
  angle: number; // 发射角（方位角，0°=正北，顺时针）
  fireTime: number; // 点火时间（秒，相对整场开始）
  safety: number; // 安全距离 m
}

export interface Segment {
  id: string;
  name: string;
  start: number; // 秒
  end: number; // 秒
}

export interface ReviewedPoint extends Point {
  issues: string[];
}

export interface ReleasedShow {
  points: Point[];
  segments: Segment[];
  blocked: Segment[];
  releasedAt: string;
}

export interface AppState {
  points: Point[];
  segments: Segment[];
  blocked: Segment[];
  released: ReleasedShow | null;
}

export const MIN_SEPARATION_M = 30; // 相邻点位最小间距
export const MUSIC_MOMENT_TOLERANCE_S = 1; // 同一音乐时刻判定容差（秒）

export const MODEL_OPTIONS = ['礼花弹', '组合烟花', '罗马烛光', '吐珠类', '架子烟花', '冷焰火'];

// 预置四个点位（B、C 故意构成一组待复核冲突，便于演示规则）
export const presetPoints: Point[] = [
  { id: 'A', name: '点位 A · 东岸', x: 40, y: 190, model: '礼花弹', caliber: 100, angle: 30, fireTime: 10, safety: 80 },
  { id: 'B', name: '点位 B · 浮台一', x: 120, y: 120, model: '组合烟花', caliber: 38, angle: 55, fireTime: 70, safety: 50 },
  { id: 'C', name: '点位 C · 浮台二', x: 145, y: 105, model: '组合烟花', caliber: 38, angle: 250, fireTime: 70, safety: 50 },
  { id: 'D', name: '点位 D · 西岸', x: 200, y: 80, model: '礼花弹', caliber: 75, angle: 320, fireTime: 160, safety: 60 },
];

// 预置三段节目
export const presetSegments: Segment[] = [
  { id: 'S1', name: '开场 · 迎宾', start: 0, end: 60 },
  { id: 'S2', name: '高潮 · 绽放', start: 60, end: 150 },
  { id: 'S3', name: '终场 · 谢幕', start: 150, end: 210 },
];

// 预置封锁段
export const presetBlocked: Segment[] = [
  { id: 'B1', name: '无人机编队封锁', start: 75, end: 90 },
];

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// 方位角 → 屏幕向量（x 向右，y 向下；0°=正北，顺时针）
export function dirVec(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

// 两条发射射线是否在各自弹着方向上相交
export function raysCross(a: Point, b: Point): boolean {
  const da = dirVec(a.angle);
  const db = dirVec(b.angle);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const det = db.x * da.y - da.x * db.y;
  const EPS = 1e-9;
  if (Math.abs(det) < EPS) {
    // 平行：仅当共线且相向而行时视为交叉
    const cross = dx * da.y - dy * da.x;
    const dot = da.x * db.x + da.y * db.y;
    return Math.abs(cross) < 1e-6 && dot < 0;
  }
  const t = (db.x * dy - db.y * dx) / det;
  const s = (da.x * dy - da.y * dx) / det;
  return t > 0 && s > 0;
}

// 登记项完整性校验
export function pointFieldProblems(p: Point): string[] {
  const probs: string[] = [];
  if (!p.model.trim()) probs.push('型号未填');
  if (!(p.caliber > 0)) probs.push('口径需大于 0mm');
  if (!(p.angle >= 0 && p.angle < 360)) probs.push('发射角需在 0–359°');
  if (!(p.fireTime >= 0)) probs.push('点火时间需 ≥ 0s');
  if (!(p.safety > 0)) probs.push('安全距离需大于 0m');
  return probs;
}

// 复核：封锁段 + 相邻点位同音乐时刻交叉且间距不足
export function reviewPoints(points: Point[], blocked: Segment[]): ReviewedPoint[] {
  const issues: string[][] = points.map(() => []);

  points.forEach((p, i) => {
    const hit = blocked.find(seg => p.fireTime >= seg.start && p.fireTime <= seg.end);
    if (hit) {
      issues[i].push(
        `点火 ${formatTime(p.fireTime)} 落在封锁段「${hit.name}」(${formatTime(hit.start)}–${formatTime(hit.end)})，不能排片`
      );
    }
  });

  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = distance(a, b);
    if (d >= MIN_SEPARATION_M) continue;
    if (Math.abs(a.fireTime - b.fireTime) > MUSIC_MOMENT_TOLERANCE_S) continue;
    if (!raysCross(a, b)) continue;
    const dTxt = d.toFixed(1);
    issues[i].push(`与相邻 ${b.name} 同一音乐时刻发射角交叉，间距 ${dTxt}m < ${MIN_SEPARATION_M}m，不能排片`);
    issues[i + 1].push(`与相邻 ${a.name} 同一音乐时刻发射角交叉，间距 ${dTxt}m < ${MIN_SEPARATION_M}m，不能排片`);
  }

  return points.map((p, i) => ({ ...p, issues: issues[i] }));
}

export type SegmentProblem =
  | { type: 'invalid'; seg: Segment }
  | { type: 'overlap'; a: Segment; b: Segment };

export function findSegmentProblems(segments: Segment[]): SegmentProblem[] {
  const problems: SegmentProblem[] = [];
  segments.forEach(seg => {
    if (!(seg.start < seg.end)) problems.push({ type: 'invalid', seg });
  });
  const sorted = [...segments].sort((x, y) => x.start - y.start || x.end - y.end);
  for (let i = 0; i + 1 < sorted.length; i++) {
    if (sorted[i].end > sorted[i + 1].start) {
      problems.push({ type: 'overlap', a: sorted[i], b: sorted[i + 1] });
    }
  }
  return problems;
}

export function adjacentPairs(points: Point[]): Array<{ a: Point; b: Point; dist: number }> {
  const pairs: Array<{ a: Point; b: Point; dist: number }> = [];
  for (let i = 0; i + 1 < points.length; i++) {
    pairs.push({ a: points[i], b: points[i + 1], dist: distance(points[i], points[i + 1]) });
  }
  return pairs;
}

export function modelStats(points: Point[]): Array<{ model: string; count: number; calibers: number[] }> {
  const map = new Map<string, { model: string; count: number; calibers: number[] }>();
  points.forEach(p => {
    const entry = map.get(p.model) ?? { model: p.model, count: 0, calibers: [] };
    entry.count += 1;
    entry.calibers.push(p.caliber);
    map.set(p.model, entry);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.model.localeCompare(b.model));
}
