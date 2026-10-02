/**
 * 궤도형 뉴스맵 트리 — design/newsmap-prototype/NewsMap.dc.html의 배치·자동 정렬을 옮긴 것.
 *
 * - 단계가 깊어질 때마다 카드·궤도 크기가 SHRINK배로 줄고, 카메라는 1/SHRINK배로 확대된다.
 *   그래서 가운데에 오는 카드는 몇 단계를 내려가도 화면에서 같은 크기로 보인다.
 * - 자동 정렬은 물리 시뮬레이션이다. 매 프레임 힘을 받아 움직이다가 자리를 잡으면 멈춘다.
 *
 * 좌표는 중앙 카드가 (0, 0)인 월드 좌표다. 화면 크기와 카메라는 호출하는 쪽이 정한다.
 * 상태를 직접 바꾸는 함수(add*, remove*, stepLayout)는 트리 객체를 제자리에서 수정한다.
 */

import type { NewsCard } from '../data/mockData';

export const SHRINK = 0.6;
export const ROOT_SIZE = 260;
export const CARD_SIZE = 180;
/** 중앙 카드 둘레의 첫 궤도 (연관 뉴스가 놓이는 타원) */
export const ROOT_ORBIT = { rx: 300, ry: 200 };
/** 아무것도 펼치지 않았을 때 중앙 카드 키워드가 놓이는 바깥 궤도 */
export const KEYWORD_ORBIT = { rx: 440, ry: 268 };
export const KEYWORD_SIZE = 80;
/** 단계별 궤도 진하기 구간 수 (가운데 카드에서 멀어질수록 연해진다) */
export const RING_LEVELS = 6;

export type MapNode = {
  id: string;
  parent: string | null;
  level: number;
  x: number;
  y: number;
  /** 부모로부터의 목표 거리(궤도 반지름). 자동 정렬은 각도만 바꾸고 이 거리는 지킨다. */
  r0?: number;
  /** 1단계 카드의 목표 각도(절대값) */
  abs?: number;
  /** 2단계 이하 카드의 목표 각도(부모의 바깥 방향 기준) */
  slot?: number;
  expanded: boolean;
  /** 재검색 횟수. mock 서비스가 다음 결과 묶음을 고를 때 쓴다. */
  batch: number;
  news: NewsCard;
};

export type MapTree = {
  seq: number;
  nodes: Record<string, MapNode>;
  order: string[];
};

export type Vec = { x: number; y: number };
export type Bounds = { x0: number; x1: number; y0: number; y1: number; minSize: number };

const DEG = Math.PI / 180;

// ── 크기·배율 ──────────────────────────────────────────────────────

export function baseOf(n: Pick<MapNode, 'level'>): number {
  return n.level === 0 ? ROOT_SIZE : CARD_SIZE;
}

export function sizeOf(n: Pick<MapNode, 'level'>): number {
  return n.level === 0 ? ROOT_SIZE : CARD_SIZE * SHRINK ** (n.level - 1);
}

/** 이 카드의 하위 카드가 놓이는 궤도 반지름 */
export function ringRadius(n: Pick<MapNode, 'level'>): number {
  return 250 * SHRINK ** Math.max(0, n.level - 1);
}

/** 이 카드를 가운데에 둘 때의 기본 카메라 배율 */
export function zoomFor(n: Pick<MapNode, 'level'>): number {
  return n.level <= 1 ? 1 : 1 / SHRINK ** (n.level - 1);
}

// ── 트리 구성 ──────────────────────────────────────────────────────

export function createTree(root: NewsCard, related: NewsCard[]): MapTree {
  const tree: MapTree = { seq: 0, nodes: {}, order: [] };
  tree.nodes.root = { id: 'root', parent: null, level: 0, x: 0, y: 0, expanded: true, batch: 0, news: root };
  tree.order.push('root');
  addRootChildren(tree, related);
  return tree;
}

function add(tree: MapTree, node: Omit<MapNode, 'id'>): MapNode {
  const n: MapNode = { ...node, id: `k${tree.seq++}` };
  const p = n.parent ? tree.nodes[n.parent] : undefined;
  if (p && n.r0 === undefined) n.r0 = Math.hypot(n.x - p.x, n.y - p.y);
  tree.nodes[n.id] = n;
  tree.order.push(n.id);
  return n;
}

/** 중앙 카드의 연관 뉴스를 첫 궤도에 대각선 방향(-45°부터 균등)으로 놓는다. */
export function addRootChildren(tree: MapTree, related: NewsCard[]): MapNode[] {
  const step = 360 / Math.max(1, related.length);
  return related.map((news, i) => {
    const a = (-45 + step * i) * DEG;
    return add(tree, {
      parent: 'root', level: 1, abs: a,
      x: ROOT_ORBIT.rx * Math.cos(a), y: ROOT_ORBIT.ry * Math.sin(a),
      expanded: false, batch: 0, news,
    });
  });
}

/** 하위 뉴스를 부모의 바깥쪽 부채꼴(±50°)에 놓는다. 처음에는 궤도 안쪽에서 시작해 퍼진다. */
export function addChildren(tree: MapTree, parentId: string, kids: NewsCard[]): MapNode[] {
  const n = tree.nodes[parentId];
  if (!n) return [];
  if (n.level === 0) return addRootChildren(tree, kids);
  const p = tree.nodes[n.parent!];
  const dir = Math.atan2(n.y - p.y, n.x - p.x);
  const R = ringRadius(n);
  const slots = kids.length === 1 ? [0] : kids.map((_, i) => -50 + (100 * i) / (kids.length - 1));
  return kids.map((news, i) => {
    const a = dir + slots[i] * DEG;
    return add(tree, {
      parent: parentId, level: n.level + 1,
      x: n.x + R * 0.35 * Math.cos(a), y: n.y + R * 0.35 * Math.sin(a), r0: R, slot: slots[i] * DEG,
      expanded: false, batch: 0, news,
    });
  });
}

/** 하위 카드를 모두 지우고 지운 ID를 돌려준다. */
export function removeDescendants(tree: MapTree, id: string): string[] {
  const removed: string[] = [];
  const visit = (pid: string) => {
    for (const cid of tree.order) {
      const c = tree.nodes[cid];
      if (c && c.parent === pid) {
        visit(cid);
        delete tree.nodes[cid];
        removed.push(cid);
      }
    }
  };
  visit(id);
  const gone = new Set(removed);
  tree.order = tree.order.filter((x) => !gone.has(x));
  return removed;
}

/** 조상 ID 집합 */
export function ancestors(tree: MapTree, id: string): Set<string> {
  const out = new Set<string>();
  let cur = tree.nodes[id];
  while (cur && cur.parent) {
    out.add(cur.parent);
    cur = tree.nodes[cur.parent];
  }
  return out;
}

/** id → 부모 → … → root */
export function chainOf(tree: MapTree, id: string): string[] {
  const out = [id];
  let cur = tree.nodes[id];
  while (cur && cur.parent) {
    out.push(cur.parent);
    cur = tree.nodes[cur.parent];
  }
  return out;
}

/** 중앙 카드 말고 펼친 카드가 없을 때만 중앙 키워드 궤도를 보인다. */
export function showsKeywords(tree: MapTree): boolean {
  return tree.order.every((id) => {
    const n = tree.nodes[id];
    return n.level === 0 || !n.expanded;
  });
}

// ── 자동 정렬 (물리 시뮬레이션) ────────────────────────────────────
//  1) 궤도: 부모와의 거리를 궤도 반지름(r0)으로 유지
//  2) 방향: 하위 카드는 부모의 바깥쪽(조부모→부모 방향) 부채꼴 자리(slot)를 향한다
//  3) 충돌: 같은 부모의 형제끼리는 서로 밀고, 다른 가지끼리 부딪히면 두 가지의 머리(공통 조상
//     바로 아래 카드)를 통째로 밀어낸다. 그래서 가지끼리 카드가 섞이지 않는다.
//  카드가 움직이면 하위 가지 전체가 같이 따라간다. 중앙 카드는 고정.

function wrap(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** 한 단계 진행하고 남은 운동 에너지를 돌려준다. vel은 프레임 사이에 유지한다. */
export function stepLayout(tree: MapTree, vel: Record<string, Vec>): number {
  const ids = tree.order.filter((id) => tree.nodes[id]);
  const chains: Record<string, string[]> = {};
  const F: Record<string, Vec> = {};
  for (const id of ids) {
    chains[id] = chainOf(tree, id).reverse(); // root → … → id
    F[id] = { x: 0, y: 0 };
    if (!vel[id]) vel[id] = { x: 0, y: 0 };
  }

  for (const id of ids) {
    const n = tree.nodes[id];
    if (!n.parent) continue;
    const p = tree.nodes[n.parent];
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    const d = Math.hypot(dx, dy) || 0.01;
    const r0 = n.r0 ?? d;
    // 1) 궤도 반지름 — 안쪽으로는 단단히, 바깥으로는 붐비면 조금 넓어질 수 있게
    const kr = ((r0 - d) / d) * 0.1 * (d < r0 ? 2.5 : 1);
    F[id].x += dx * kr;
    F[id].y += dy * kr;
    // 2) 부채꼴 방향
    let target: number;
    if (n.abs !== undefined) target = n.abs;
    else {
      const g = p.parent ? tree.nodes[p.parent] : undefined;
      const base = g ? Math.atan2(p.y - g.y, p.x - g.x) : 0;
      target = base + (n.slot ?? 0);
    }
    const th = Math.atan2(dy, dx);
    const ka = wrap(target - th) * d * 0.03;
    F[id].x += -Math.sin(th) * ka;
    F[id].y += Math.cos(th) * ka;
  }

  // 3) 충돌
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = tree.nodes[ids[i]];
      const b = tree.nodes[ids[j]];
      const sa = sizeOf(a);
      const sb = sizeOf(b);
      const gap = 0.16 * Math.min(sa, sb) + 3;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const over = (sa + sb) / 2 + gap - d;
      if (over <= 0) continue;
      const ca = chains[a.id];
      const cb = chains[b.id];
      let k = 0;
      while (k < ca.length && k < cb.length && ca[k] === cb[k]) k++;
      // k: 공통 조상 다음 위치. 한쪽이 다른 쪽의 조상이면 자손 쪽 가지만 민다.
      const ha = ca[k];
      const hb = cb[k];
      const ux = dx / d;
      const uy = dy / d;
      const f = over * 0.35;
      if (!ha) { F[hb].x += ux * f; F[hb].y += uy * f; continue; }
      if (!hb) { F[ha].x -= ux * f; F[ha].y -= uy * f; continue; }
      const na = tree.nodes[ha];
      const nb = tree.nodes[hb];
      let wa = na.level === 0 ? 0 : 0.5;
      let wb = nb.level === 0 ? 0 : 0.5;
      if (wa && wb) {
        const s1 = sizeOf(na);
        const s2 = sizeOf(nb);
        wa = (s2 * s2) / (s1 * s1 + s2 * s2);
        wb = 1 - wa;
      } else if (wa) wa = 1;
      else if (wb) wb = 1;
      F[ha].x -= ux * f * wa; F[ha].y -= uy * f * wa;
      F[hb].x += ux * f * wb; F[hb].y += uy * f * wb;
    }
  }

  // 적분: 부모의 이동량을 자식이 물려받는다 (가지 전체가 같이 움직임)
  const disp: Record<string, Vec> = {};
  let energy = 0;
  const sorted = ids.slice().sort((x, y) => tree.nodes[x].level - tree.nodes[y].level);
  for (const id of sorted) {
    const n = tree.nodes[id];
    if (!n.parent) {
      disp[id] = { x: 0, y: 0 };
      vel[id] = { x: 0, y: 0 };
      continue;
    }
    const v = vel[id];
    v.x = (v.x + F[id].x) * 0.78;
    v.y = (v.y + F[id].y) * 0.78;
    const pd = disp[n.parent] ?? { x: 0, y: 0 };
    disp[id] = { x: v.x + pd.x, y: v.y + pd.y };
    n.x += disp[id].x;
    n.y += disp[id].y;
    energy += Math.hypot(v.x, v.y) / sizeOf(n);
  }
  return energy;
}

// ── 카메라 범위 ────────────────────────────────────────────────────

/** 트리 전체(카드 + 중앙 키워드 궤도)를 감싸는 사각형과 가장 작은 카드 크기 */
export function treeBounds(tree: MapTree): Bounds {
  const b: Bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, minSize: Infinity };
  for (const id of tree.order) {
    const n = tree.nodes[id];
    const s = sizeOf(n);
    b.x0 = Math.min(b.x0, n.x - s / 2); b.x1 = Math.max(b.x1, n.x + s / 2);
    b.y0 = Math.min(b.y0, n.y - s / 2); b.y1 = Math.max(b.y1, n.y + s / 2);
    b.minSize = Math.min(b.minSize, s);
  }
  if (showsKeywords(tree)) {
    const kx = KEYWORD_ORBIT.rx + KEYWORD_SIZE / 2;
    const ky = KEYWORD_ORBIT.ry + KEYWORD_SIZE / 2;
    b.x0 = Math.min(b.x0, -kx); b.x1 = Math.max(b.x1, kx);
    b.y0 = Math.min(b.y0, -ky); b.y1 = Math.max(b.y1, ky);
  }
  return b;
}

/**
 * 최소 배율: 트리 전체가 화면에 들어오는 배율
 * 최대 배율: 가장 작은(깊은) 카드가 화면에서 300px로 보이는 배율
 */
export function zoomLimits(tree: MapTree, focus: MapNode, viewport: { width: number; height: number }) {
  const b = treeBounds(tree);
  const base = zoomFor(focus);
  const fit = Math.min((viewport.width * 0.86) / (b.x1 - b.x0), (viewport.height * 0.72) / (b.y1 - b.y0));
  return { min: Math.min(fit, base), max: Math.max(300 / b.minSize, base) };
}

/** 화면 가운데가 트리 사각형 밖으로 나가지 않도록 이동량을 제한한다. */
export function clampPan(pan: Vec, z: number, focus: MapNode, tree: MapTree): Vec {
  const b = treeBounds(tree);
  const cx = Math.min(b.x1, Math.max(b.x0, focus.x - pan.x / z));
  const cy = Math.min(b.y1, Math.max(b.y0, focus.y - pan.y / z));
  return { x: (focus.x - cx) * z, y: (focus.y - cy) * z };
}

// ── 그리기용 경로 ──────────────────────────────────────────────────

export function orbitArc(cx: number, cy: number, rx: number, ry: number): string {
  return `M${(cx - rx).toFixed(1)} ${cy.toFixed(1)} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 `;
}

/**
 * 궤도 경로를 진하기 구간별로 모은다. 가운데 카드(자신)의 1궤도가 가장 진하고,
 * 트리에서 멀어질수록 연해진다.
 * 구간 = (궤도 주인 카드와 가운데 카드 사이의 가지 거리) + (그 카드의 몇 번째 궤도인지)
 */
export function ringPaths(tree: MapTree, focusId: string): string[] {
  const buckets = Array<string>(RING_LEVELS).fill('');
  const focusChain = chainOf(tree, focusId);
  const hops = (id: string) => {
    const c = chainOf(tree, id);
    for (let i = 0; i < c.length; i++) {
      const j = focusChain.indexOf(c[i]);
      if (j >= 0) return i + j;
    }
    return 99;
  };
  const addRing = (ownerId: string, idx: number, d: string) => {
    buckets[Math.min(RING_LEVELS - 1, hops(ownerId) + idx)] += d;
  };

  addRing('root', 0, orbitArc(0, 0, ROOT_ORBIT.rx, ROOT_ORBIT.ry));
  if (showsKeywords(tree)) addRing('root', 1, orbitArc(0, 0, KEYWORD_ORBIT.rx, KEYWORD_ORBIT.ry));
  for (const id of tree.order) {
    const n = tree.nodes[id];
    if (n.level === 0 || !n.expanded) continue;
    // 궤도는 실제 하위 카드들의 평균 거리로 그려 카드와 어긋나지 않게 한다
    const kids = tree.order.filter((k) => tree.nodes[k].parent === id);
    const rr = kids.length
      ? kids.reduce((acc, k) => acc + Math.hypot(tree.nodes[k].x - n.x, tree.nodes[k].y - n.y), 0) / kids.length
      : ringRadius(n);
    addRing(id, 0, orbitArc(n.x, n.y, rr, rr));
  }
  return buckets;
}

/** 부모 카드 가장자리에서 자식 카드 가장자리까지의 직선 연결선 */
export function edgePaths(tree: MapTree): string {
  let d = '';
  for (const id of tree.order) {
    const n = tree.nodes[id];
    if (!n.parent) continue;
    const p = tree.nodes[n.parent];
    const ps = sizeOf(p);
    const s = sizeOf(n);
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    const L = Math.hypot(dx, dy) || 1;
    const sx = p.x + (dx / L) * (ps * 0.47);
    const sy = p.y + (dy / L) * (ps * 0.47);
    const ex = n.x - (dx / L) * (s * 0.47);
    const ey = n.y - (dy / L) * (s * 0.47);
    d += `M${sx.toFixed(2)} ${sy.toFixed(2)} L${ex.toFixed(2)} ${ey.toFixed(2)} `;
  }
  return d;
}

/** 중앙 키워드 궤도의 카드: 위·오른쪽·아래·왼쪽 */
export function keywordSlots(keywords: string[]) {
  const pos = [
    { x: 0, y: -KEYWORD_ORBIT.ry },
    { x: KEYWORD_ORBIT.rx, y: 0 },
    { x: 0, y: KEYWORD_ORBIT.ry },
    { x: -KEYWORD_ORBIT.rx, y: 0 },
  ];
  return keywords.slice(0, pos.length).map((keyword, i) => ({ keyword, ...pos[i] }));
}

/** 중앙 카드 가장자리에서 키워드 카드 가장자리까지의 점선 */
export function keywordEdgePaths(count: number): string {
  const inner = ROOT_SIZE / 2 - 8;
  const outY = KEYWORD_ORBIT.ry - KEYWORD_SIZE / 2;
  const outX = KEYWORD_ORBIT.rx - KEYWORD_SIZE / 2;
  return [
    `M0 ${-inner} L0 ${-outY}`,
    `M${inner} 0 L${outX} 0`,
    `M0 ${inner} L0 ${outY}`,
    `M${-inner} 0 L${-outX} 0`,
  ].slice(0, count).join(' ');
}

// ── 미니맵 ─────────────────────────────────────────────────────────

export type MiniMap = {
  scale: number;
  x0: number;
  y0: number;
  edges: string;
  dots: Array<{ id: string; x: number; y: number; size: number }>;
  view: { x: number; y: number; w: number; h: number };
};

/** 전체 노드와 현재 화면 영역(월드 좌표)을 width×height 안에 맞춘다. */
export function miniMap(
  tree: MapTree,
  view: { x0: number; x1: number; y0: number; y1: number },
  width = 204,
  height = 120,
): MiniMap {
  let bx0 = view.x0, bx1 = view.x1, by0 = view.y0, by1 = view.y1;
  for (const id of tree.order) {
    const n = tree.nodes[id];
    const h = sizeOf(n) / 2;
    bx0 = Math.min(bx0, n.x - h); bx1 = Math.max(bx1, n.x + h);
    by0 = Math.min(by0, n.y - h); by1 = Math.max(by1, n.y + h);
  }
  const padW = (bx1 - bx0) * 0.06;
  const padH = (by1 - by0) * 0.06;
  bx0 -= padW; bx1 += padW; by0 -= padH; by1 += padH;
  const m = Math.min(width / (bx1 - bx0), height / (by1 - by0));
  const ox = bx0 - (width / m - (bx1 - bx0)) / 2;
  const oy = by0 - (height / m - (by1 - by0)) / 2;
  let edges = '';
  const dots: MiniMap['dots'] = [];
  for (const id of tree.order) {
    const n = tree.nodes[id];
    const px = (n.x - ox) * m;
    const py = (n.y - oy) * m;
    if (n.parent) {
      const p = tree.nodes[n.parent];
      edges += `M${((p.x - ox) * m).toFixed(1)} ${((p.y - oy) * m).toFixed(1)} L${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    dots.push({ id, x: px, y: py, size: Math.max(3, sizeOf(n) * m) });
  }
  return {
    scale: m, x0: ox, y0: oy, edges, dots,
    view: { x: (view.x0 - ox) * m, y: (view.y0 - oy) * m, w: (view.x1 - view.x0) * m, h: (view.y1 - view.y0) * m },
  };
}

export function shortTitle(title: string): string {
  return title.length > 12 ? `${title.slice(0, 12)}…` : title;
}
