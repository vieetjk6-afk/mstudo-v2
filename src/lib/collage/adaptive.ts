/* ═══════════════════════════════════════════════════════════════════════════
   BỘ DÀN ẢNH THÍCH NGHI — chép từ Albumi (repo Album-layout, core/adaptive.ts).

   Một bố cục là một cây chia khung kiểu "guillotine": mỗi nút là một hàng (ảnh
   đặt cạnh nhau) hoặc một cột (ảnh xếp chồng). Biết tỉ lệ từng ảnh thì tính
   được CHÍNH XÁC kích thước tự nhiên của từng nút (kể cả khe giữa ảnh), nên
   khung sinh ra gần đúng tỉ lệ ảnh và ảnh ít bị cắt. Bộ dàn thử hàng trăm cấu
   trúc rồi chấm điểm, trả các phương án tốt nhất.
   ═══════════════════════════════════════════════════════════════════════════ */
import type { Rect } from "./types";
import { rng } from "./rng";

export interface LayoutPhoto {
  id: string;
  /** rộng / cao */
  aspect: number;
  score: number;
}

export type LayoutNode = { t: "leaf"; i: number } | { t: "row" | "col"; kids: LayoutNode[] };

export interface Cell {
  rect: Rect;
  photoId: string;
}

export interface AdaptiveCandidate {
  key: string;
  cells: Cell[];
  cost: number;
}

/** Hàm affine: chiều rộng tự nhiên khi biết chiều cao, W(h) = A·h + B. */
interface Affine {
  A: number;
  B: number;
}

function affine(node: LayoutNode, photos: LayoutPhoto[], gap: number): Affine {
  if (node.t === "leaf") return { A: photos[node.i].aspect, B: 0 };
  const parts = node.kids.map((k) => affine(k, photos, gap));
  const g = gap * (parts.length - 1);
  if (node.t === "row") {
    return { A: parts.reduce((s, p) => s + p.A, 0), B: parts.reduce((s, p) => s + p.B, 0) + g };
  }
  // cột: h = Σ (w − B_k)/A_k + g  ⇒  w = (h + S2 − g)/S1
  const S1 = parts.reduce((s, p) => s + 1 / p.A, 0);
  const S2 = parts.reduce((s, p) => s + p.B / p.A, 0);
  return { A: 1 / S1, B: (S2 - g) / S1 };
}

function placeNode(node: LayoutNode, rect: Rect, photos: LayoutPhoto[], gap: number, out: Cell[]) {
  if (node.t === "leaf") {
    out.push({ rect, photoId: photos[node.i].id });
    return;
  }
  const parts = node.kids.map((k) => affine(k, photos, gap));
  const g = gap * (node.kids.length - 1);
  if (node.t === "row") {
    const nat = parts.map((p) => Math.max(1e-6, p.A * rect.h + p.B));
    const total = nat.reduce((s, v) => s + v, 0);
    const avail = rect.w - g;
    let x = rect.x;
    node.kids.forEach((k, i) => {
      const w = (nat[i] / total) * avail;
      placeNode(k, { x, y: rect.y, w, h: rect.h }, photos, gap, out);
      x += w + gap;
    });
  } else {
    const nat = parts.map((p) => Math.max(1e-6, (rect.w - p.B) / p.A));
    const total = nat.reduce((s, v) => s + v, 0);
    const avail = rect.h - g;
    let y = rect.y;
    node.kids.forEach((k, i) => {
      const h = (nat[i] / total) * avail;
      placeNode(k, { x: rect.x, y, w: rect.w, h }, photos, gap, out);
      y += h + gap;
    });
  }
}

export function layoutTree(node: LayoutNode, box: Rect, photos: LayoutPhoto[], gap: number): Cell[] {
  const out: Cell[] = [];
  placeNode(node, box, photos, gap, out);
  return out;
}

export function treeKey(node: LayoutNode): string {
  if (node.t === "leaf") return "x";
  return (node.t === "row" ? "R(" : "C(") + node.kids.map(treeKey).join(",") + ")";
}

const leaf = (i: number): LayoutNode => ({ t: "leaf", i });
const group = (t: "row" | "col", kids: LayoutNode[]): LayoutNode => (kids.length === 1 ? kids[0] : { t, kids });

/** Mọi cách chia n phần tử liên tiếp thành k nhóm, mỗi nhóm không quá maxPart. */
export function compositions(n: number, k: number, maxPart: number): number[][] {
  const out: number[][] = [];
  const rec = (left: number, parts: number[]) => {
    if (parts.length === k - 1) {
      if (left >= 1 && left <= maxPart) out.push([...parts, left]);
      return;
    }
    for (let p = 1; p <= Math.min(maxPart, left - (k - parts.length - 1)); p++) rec(left - p, [...parts, p]);
  };
  if (k >= 1 && n >= k) rec(n, []);
  return out;
}

function lines(indices: number[], parts: number[], outer: "row" | "col"): LayoutNode {
  const inner = outer === "row" ? "col" : "row";
  let at = 0;
  const kids = parts.map((p) => group(inner, indices.slice(at, (at += p)).map(leaf)));
  return group(outer, kids);
}

function randomTree(indices: number[], r: () => number, depth = 0): LayoutNode {
  if (indices.length === 1) return leaf(indices[0]);
  if (indices.length <= 3 && r() < 0.5) return group(r() < 0.5 ? "row" : "col", indices.map(leaf));
  const cut = 1 + Math.floor(r() * (indices.length - 1));
  const t: "row" | "col" = (depth + (r() < 0.75 ? 0 : 1)) % 2 === 0 ? "row" : "col";
  return { t, kids: [randomTree(indices.slice(0, cut), r, depth + 1), randomTree(indices.slice(cut), r, depth + 1)] };
}

/** Sinh các cấu trúc cây ứng viên cho n ảnh. */
export function candidateTrees(n: number, heroIndex: number, seed = 1): LayoutNode[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  const trees: LayoutNode[] = [];
  if (n === 1) return [leaf(0)];
  const maxPart = 4;
  for (let k = 1; k <= Math.min(n, 4); k++) {
    for (const parts of compositions(n, k, maxPart)) {
      trees.push(lines(idx, parts, "col")); // các hàng xếp chồng
      trees.push(lines(idx, parts, "row")); // các cột đặt cạnh nhau
    }
  }
  // Ảnh chính chiếm một bên, các ảnh còn lại xếp ở bên kia.
  const rest = idx.filter((i) => i !== heroIndex);
  for (let k = 1; k <= Math.min(rest.length, 3); k++) {
    for (const parts of compositions(rest.length, k, 3)) {
      const side = lines(rest, parts, "col");
      const below = lines(rest, parts, "row");
      trees.push({ t: "row", kids: [leaf(heroIndex), side] });
      trees.push({ t: "row", kids: [side, leaf(heroIndex)] });
      trees.push({ t: "col", kids: [leaf(heroIndex), below] });
      trees.push({ t: "col", kids: [below, leaf(heroIndex)] });
    }
  }
  // Cấu trúc bất đối xứng ngẫu nhiên (mosaic) cho vẻ hiện đại.
  if (n >= 3) {
    const r = rng(seed * 7919 + n);
    for (let s = 0; s < 40; s++) trees.push(randomTree(idx, r));
  }
  const seen = new Set<string>();
  return trees.filter((t) => {
    const k = treeKey(t);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Chấm điểm: càng thấp càng tốt. */
export function scoreCells(cells: Cell[], photos: LayoutPhoto[]): number {
  const byId = new Map(photos.map((p) => [p.id, p]));
  const areas = cells.map((c) => c.rect.w * c.rect.h);
  const total = areas.reduce((s, a) => s + a, 0) || 1;
  let crop = 0;
  let penalty = 0;
  cells.forEach((c, i) => {
    const p = byId.get(c.photoId);
    if (!p) return;
    const ca = c.rect.w / c.rect.h;
    const r = ca / p.aspect;
    crop += (areas[i] / total) * (1 - Math.min(r, 1 / r));
    if (ca > 3.2 || ca < 0.3) penalty += 0.4;
  });
  const maxA = Math.max(...areas);
  const minA = Math.min(...areas);
  if (cells.length > 1 && minA / maxA < 0.12) penalty += 0.35;
  // Ảnh điểm cao nhất nên nằm ở khung lớn.
  if (cells.length > 2) {
    const best = [...photos].sort((a, b) => b.score - a.score)[0];
    const bestCell = cells.findIndex((c) => c.photoId === best.id);
    if (bestCell >= 0) {
      const rank = [...areas].sort((a, b) => b - a).indexOf(areas[bestCell]);
      penalty += 0.06 * rank;
    }
  }
  return crop * 2.5 + penalty;
}

export function adaptiveCandidates(
  photos: LayoutPhoto[],
  box: Rect,
  gap: number,
  opts: { limit?: number; seed?: number } = {},
): AdaptiveCandidate[] {
  if (!photos.length || box.w <= 0 || box.h <= 0) return [];
  const heroIndex = photos.reduce((b, p, i) => (p.score > photos[b].score ? i : b), 0);
  const trees = candidateTrees(photos.length, heroIndex, opts.seed ?? 1);
  const out = trees.map((t) => {
    const cells = layoutTree(t, box, photos, gap);
    return { key: treeKey(t), cells, cost: scoreCells(cells, photos) };
  });
  out.sort((a, b) => a.cost - b.cost);
  return out.slice(0, opts.limit ?? 24);
}
