/* Bộ sinh số giả ngẫu nhiên CÓ SEED (xorshift32): cùng seed → cùng layout, nên
   "Tạo lại" chỉ cần đổi seed và kết quả lặp lại được khi kiểm thử. */

export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Xáo trộn (Fisher–Yates) theo bộ sinh có seed — trả mảng MỚI. */
export function shuffle<T>(arr: readonly T[], r: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Chọn một phần tử theo trọng số (trọng số ≤ 0 coi như không chọn). */
export function weightedPick<T>(items: readonly T[], weight: (t: T) => number, r: () => number): T | undefined {
  const w = items.map((t) => Math.max(0, weight(t)));
  const total = w.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return items[0];
  let x = r() * total;
  for (let i = 0; i < items.length; i++) {
    x -= w[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

let counter = 0;
/** id ngắn, đủ khác nhau trong một bộ layout (không cần duy nhất toàn cục). */
export function uid(prefix = "id"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
