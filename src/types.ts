export interface FirePoint {
  id: string;
  name: string;
  model: string;
  caliber: number; // 口径，mm
  azimuth: number; // 发射方位角，0-359，正北为 0，顺时针
  x: number; // 场地坐标，米（东向）
  y: number; // 场地坐标，米（北向）
  ignite: number; // 点火时间，秒（音乐时刻）
  safe: number; // 安全距离，米
}

export interface Segment {
  id: string;
  name: string;
  start: number; // 秒
  end: number; // 秒
  blocked: boolean; // 封锁段：禁止点火
}

export type IssueKind = "cross" | "blocked";

export interface PointIssue {
  kind: IssueKind;
  text: string;
}

export interface ValidationResult {
  issues: Record<string, PointIssue[]>;
  overlaps: [Segment, Segment][];
  invalidSegmentIds: string[];
  pending: Set<string>;
}

export interface Snapshot {
  points: FirePoint[];
  segments: Segment[];
  at: string; // 放行时间
}

export interface PersistedState {
  points: FirePoint[];
  segments: Segment[];
  snapshot: Snapshot | null;
}
