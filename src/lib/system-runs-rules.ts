/*
 * LUẬT THUẦN của "Sức khoẻ hệ thống" — không import gì của Next / Supabase.
 *
 * Tách khỏi ./system-runs.ts (server-only) vì ba nơi cùng cần: máy chủ, màn
 * quản trị phía trình duyệt (nhãn, hạn mức) và bài kiểm thử nạp thẳng bằng
 * `node --experimental-strip-types` (desktop/test/system-runs.mjs).
 */

export type CronDef = { name: string; label: string; intervalHours: number };

/**
 * Các việc tự động PHẢI chạy — chép từ vercel.json (đổi lịch ở đó thì sửa ở
 * đây). face-scan cố ý không có: route đó chưa ghi nhật ký lượt chạy.
 */
export const CRONS: CronDef[] = [
  { name: "backup", label: "Sao lưu toàn hệ thống", intervalHours: 24 },
  { name: "plan-expiry", label: "Hạ gói hết hạn về free", intervalHours: 24 },
  { name: "automations", label: "Việc tự động theo hợp đồng", intervalHours: 24 },
  { name: "reminders", label: "Email nhắc việc cho studio", intervalHours: 24 },
  { name: "zalo:money", label: "Zalo: nhắc thanh toán & báo giá", intervalHours: 24 },
  { name: "zalo:work", label: "Zalo: nhắc lịch chụp & chọn ảnh", intervalHours: 24 },
  { name: "cleanup-proofs", label: "Dọn ảnh chuyển khoản cũ", intervalHours: 24 },
  { name: "cleanup-drive-cache", label: "Dọn bộ nhớ đệm ảnh Drive", intervalHours: 24 },
  { name: "cleanup-wedding-photos", label: "Dọn ảnh thiệp cưới mồ côi", intervalHours: 168 },
  { name: "cleanup-faces", label: "Dọn vector khuôn mặt album giao khách lâu", intervalHours: 24 },
];

/** Trần gói Supabase Free (docs/supabase-usage.md). */
export const LIMITS = { dbBytes: 500 * 1024 * 1024, storageBytes: 1024 * 1024 * 1024 };

/** /api/cron/zalo chạy HAI lịch, phân biệt bằng ?only= — mỗi lịch một tên. */
export function zaloCronName(url: string): string {
  let only: string | null = null;
  try {
    only = new URL(url, "http://x").searchParams.get("only");
  } catch {
    /* URL lạ → tên chung */
  }
  return only === "money" || only === "work" ? `zalo:${only}` : "zalo";
}

/* ─── Tóm tắt kết quả một lượt chạy ─────────────────────────────────────── */

const MAX_DETAIL_BYTES = 1800;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function compact(v: unknown, depth: number): unknown {
  if (v === null || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "string") return cut(v, 200);
  if (Array.isArray(v)) {
    const head = v.slice(0, 8).map((x) => (typeof x === "object" && x !== null ? "…" : compact(x, depth + 1)));
    return v.length > 8 ? [...head, `+${v.length - 8}`] : head;
  }
  if (typeof v === "object") {
    if (depth >= 2) return "…";
    const out: Record<string, unknown> = {};
    const keys = Object.keys(v as object);
    for (const k of keys.slice(0, 24)) out[cut(k, 40)] = compact((v as Record<string, unknown>)[k], depth + 1);
    if (keys.length > 24) out["…"] = keys.length - 24;
    return out;
  }
  return undefined;
}

/**
 * Thu thân JSON của route cron thành bản tóm tắt nhỏ (≤ ~2 KB) để lưu vào
 * system_runs.detail. Bảng nhật ký phải nhỏ; một cron trả về danh sách dài
 * không được biến nó thành bản sao dữ liệu.
 */
export function summarizeBody(body: unknown): Record<string, unknown> | null {
  if (body === null || body === undefined) return null;
  const c = typeof body === "object" && !Array.isArray(body) ? compact(body, 0) : { value: compact(body, 1) };
  const obj = c as Record<string, unknown>;
  if (JSON.stringify(obj).length <= MAX_DETAIL_BYTES) return obj;
  // Vẫn to: giữ các trường đơn (số, cờ, chuỗi ngắn) tới khi đầy.
  const out: Record<string, unknown> = {};
  let size = 2;
  for (const [k, v] of Object.entries(obj)) {
    const small = typeof v === "string" ? cut(v, 80) : typeof v === "object" && v !== null ? "…" : v;
    const add = JSON.stringify(k).length + JSON.stringify(small ?? null).length + 2;
    if (size + add > MAX_DETAIL_BYTES - 20) {
      out.truncated = true;
      break;
    }
    out[k] = small;
    size += add;
  }
  return out;
}

/** Thân phản hồi dạng chữ → tóm tắt. Không phải JSON thì giữ một đoạn đầu. */
export function summarizeText(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    return summarizeBody(JSON.parse(text));
  } catch {
    return { text: cut(text.replace(/\s+/g, " ").trim(), 300) };
  }
}

/** Một dòng ngắn cho bảng trên trang Sức khoẻ: câu lỗi, hoặc các số khác 0. */
export function summaryLine(detail: unknown, ok: boolean): string {
  if (!detail || typeof detail !== "object") return "";
  const d = detail as Record<string, unknown>;
  if (!ok) {
    const e = d.error ?? d.message ?? d.text;
    if (typeof e === "string" && e) return cut(e, 160);
  }
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d)) {
    if (k === "ok" || k === "status") continue;
    if (typeof v === "number" && v !== 0) parts.push(`${k} ${v}`);
    else if (typeof v === "string" && v && /^(skipped|reason|note|error|file|mode|only)$/.test(k)) parts.push(`${k}: ${cut(v, 60)}`);
    else if (v === true && k === "skipped") parts.push("bỏ qua");
    else if (v === false && k === "done") parts.push("chưa xong, chạy tiếp lượt sau");
    else if (Array.isArray(v) && v.length) parts.push(`${k} ${v.length}`);
    else if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) parts.push(`${k} ${Object.keys(v).length}`);
  }
  return cut(parts.join(" · "), 160) || (ok ? "không có việc gì phải làm" : "");
}

/* ─── Quá hạn ───────────────────────────────────────────────────────────── */

const HOUR = 3600_000;

/** Ngưỡng quá hạn: 2 chu kỳ + 3 giờ (cron Vercel Hobby nổ bất kỳ lúc nào trong giờ). */
export const staleAfterMs = (intervalHours: number) => (2 * intervalHours + 3) * HOUR;

/**
 * Một cron "quá hạn" khi lượt TỐT gần nhất đã cũ hơn ngưỡng. Việc chưa từng
 * chạy tốt thì tính từ lượt cron ĐẦU TIÊN hệ thống ghi được — vừa cài xong mà
 * đỏ cả bảng là báo động giả; và chưa có lượt nào của bất kỳ cron nào thì
 * không cái gì quá hạn cả.
 */
export function isCronStale(
  def: CronDef,
  lastOkAt: string | null | undefined,
  firstRunAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const from = Date.parse(lastOkAt || firstRunAt || "");
  if (!Number.isFinite(from)) return false;
  return now - from > staleAfterMs(def.intervalHours);
}

export type RunRow = {
  kind: string;
  name: string;
  ok: boolean;
  detail: unknown;
  duration_ms: number | null;
  started_at: string;
  last_ok_at: string | null;
};
export type RunState = { first_run_at: string | null; runs: RunRow[] };

export type CronHealth = {
  name: string;
  label: string;
  intervalHours: number;
  last: { ok: boolean; at: string; durationMs: number | null; summary: string } | null;
  lastOkAt: string | null;
  stale: boolean;
};

/** Ghép bản kê cron với trạng thái đọc từ system_run_state(). */
export function cronHealth(state: RunState | null, now = Date.now()): CronHealth[] {
  const by = new Map((state?.runs ?? []).filter((r) => r.kind === "cron").map((r) => [r.name, r]));
  return CRONS.map((def) => {
    const r = by.get(def.name);
    return {
      ...def,
      last: r ? { ok: !!r.ok, at: r.started_at, durationMs: r.duration_ms ?? null, summary: summaryLine(r.detail, !!r.ok) } : null,
      lastOkAt: r?.last_ok_at ?? null,
      stale: isCronStale(def, r?.last_ok_at, state?.first_run_at, now),
    };
  });
}

/* ─── Chữ ký lỗi ────────────────────────────────────────────────────────── */

/** Bỏ query string — nơi token, mã OTP, SĐT hay nằm. */
export const stripQuery = (path: string) => (path || "").split(/[?#]/)[0];

/**
 * Chuẩn hoá để cùng MỘT lỗi cho cùng một chữ ký: uuid, chuỗi hex dài, số và
 * nội dung trong nháy đều là dữ liệu của từng request, không phải bản chất lỗi.
 */
export function normalizeMessage(msg: string): string {
  return (msg || "")
    .split("\n")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .replace(/"[^"]{0,200}"|'[^']{0,200}'/g, "<s>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/** Đường dẫn cụ thể → dạng route: đoạn là uuid / số / token dài thành [id]. */
export function normalizePath(path: string): string {
  return stripQuery(path)
    .split("/")
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(seg) || /^\d+$/.test(seg) || (seg.length >= 16 && /\d/.test(seg)) ? "[id]" : seg))
    .join("/")
    .slice(0, 200);
}

/** Băm 64-bit (2 × FNV-1a) → 16 ký tự hex. Thuần JS để chạy được mọi runtime. */
function hash(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b) + a;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(a) + hex(b);
}

export function errorSignature(name: string, message: string, routePath: string): string {
  return hash(`${name || "Error"}|${normalizeMessage(message)}|${normalizePath(routePath)}`);
}

/**
 * Lỗi KHÔNG đáng ghi: tín hiệu điều khiển của Next (notFound / redirect),
 * request bị huỷ giữa chừng, và mọi thứ dưới /api/cron/ (nhật ký cron đã lo).
 */
export function isNoise(err: unknown, path: string): boolean {
  if (stripQuery(path).startsWith("/api/cron/")) return true;
  const e = (err ?? {}) as { name?: unknown; message?: unknown; digest?: unknown; code?: unknown };
  const digest = typeof e.digest === "string" ? e.digest : "";
  if (/^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)|^DYNAMIC_SERVER_USAGE|^BAILOUT_TO_CLIENT_SIDE_RENDERING/.test(digest)) return true;
  const name = typeof e.name === "string" ? e.name : "";
  const code = typeof e.code === "string" ? e.code : "";
  const msg = typeof e.message === "string" ? e.message : typeof err === "string" ? err : "";
  if (name === "AbortError" || name === "ResponseAborted") return true;
  if (code === "ECONNRESET" || code === "EPIPE" || code === "ERR_STREAM_PREMATURE_CLOSE") return true;
  return /\baborted\b|ECONNRESET|socket hang up|NEXT_REDIRECT|NEXT_NOT_FOUND/i.test(msg);
}

/**
 * Hãm ghi lỗi TRONG BỘ NHỚ của từng máy chủ: cùng chữ ký tối đa 1 lần / 60
 * giây, cả máy tối đa 20 lần / phút. Một lỗi lặp trong vòng lặp nóng không
 * được biến thành nghìn lượt ghi database — đúng lúc database đang khổ nhất.
 */
export function createThrottle(opts: { perSignatureMs?: number; perMinute?: number } = {}) {
  const perSig = opts.perSignatureMs ?? 60_000;
  const perMin = opts.perMinute ?? 20;
  const last = new Map<string, number>();
  let windowStart = 0;
  let used = 0;
  return function allow(signature: string, now = Date.now()): boolean {
    if (now - windowStart >= 60_000) {
      windowStart = now;
      used = 0;
      for (const [k, t] of last) if (now - t >= perSig) last.delete(k);
    }
    const prev = last.get(signature);
    if (prev !== undefined && now - prev < perSig) return false;
    if (used >= perMin) return false;
    used++;
    last.set(signature, now);
    return true;
  };
}
