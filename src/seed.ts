import type { FirePoint, Segment } from "./types";

// 预置四点：P1/P2 同音乐时刻、相邻且发射角交叉；P3 点火落在封锁段；P4 合格
export const SEED_POINTS: FirePoint[] = [
  {
    id: "p1",
    name: "P1 东岸礼炮",
    model: "礼花弹 A 型",
    caliber: 120,
    azimuth: 68,
    x: 10,
    y: 20,
    ignite: 12,
    safe: 30,
  },
  {
    id: "p2",
    name: "P2 西岸礼炮",
    model: "礼花弹 A 型",
    caliber: 120,
    azimuth: 194,
    x: 22,
    y: 32,
    ignite: 12,
    safe: 30,
  },
  {
    id: "p3",
    name: "P3 看台前冷焰",
    model: "冷焰火 C 型",
    caliber: 38,
    azimuth: 0,
    x: 55,
    y: 50,
    ignite: 42,
    safe: 12,
  },
  {
    id: "p4",
    name: "P4 终场扇形架",
    model: "扇形架 S 型",
    caliber: 76,
    azimuth: 225,
    x: 90,
    y: 75,
    ignite: 70,
    safe: 25,
  },
];

// 预置三段节目：第二段为封锁段（30s-55s，覆盖 P3 的 42s）
export const SEED_SEGMENTS: Segment[] = [
  { id: "s1", name: "序幕·迎宾", start: 0, end: 30, blocked: false },
  { id: "s2", name: "封锁·装弹静默", start: 30, end: 55, blocked: true },
  { id: "s3", name: "终章·齐放", start: 55, end: 96, blocked: false },
];
