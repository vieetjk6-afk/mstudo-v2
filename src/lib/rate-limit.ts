import "server-only";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Giới hạn tần suất nhẹ, lưu trong bộ nhớ tiến trình (sliding window). Mục tiêu:
 * chặn flood/brute-force từ một nguồn. Lưu ý: trên môi trường serverless nhiều
 * instance, bộ đếm KHÔNG chia sẻ giữa các instance — đây là lớp phòng thủ tối
 * thiểu (defense-in-depth). Để chống lạm dụng ở quy mô lớn nên dùng kho bền
 * (vd Upstash Ratelimit / Redis).
 */
const HITS = new Map<string, number[]>();
let lastSweep = 0;

/** Lấy IP client từ header proxy (Vercel đặt x-forwarded-for / x-real-ip). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Trả về true nếu request được PHÉP; false nếu vượt giới hạn.
 * @param key    khóa định danh (vd `contact:<ip>`)
 * @param limit  số lần tối đa trong cửa sổ
 * @param windowMs độ dài cửa sổ (ms)
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  // Dọn định kỳ để Map không phình vô hạn.
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, arr] of HITS) {
      const kept = arr.filter((t) => now - t < windowMs);
      if (kept.length === 0) HITS.delete(k);
      else HITS.set(k, kept);
    }
  }
  const arr = (HITS.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    HITS.set(key, arr);
    return false;
  }
  arr.push(now);
  HITS.set(key, arr);
  return true;
}

/** Tiện ích: kiểm tra theo IP; trả về Response 429 nếu vượt, ngược lại null. */
export function limitByIp(req: Request, bucket: string, limit: number, windowMs: number): NextResponse | null {
  if (rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs)) return null;
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}

/* ─── Bộ đếm bền trong Postgres (khi chưa có Upstash) ─────────────────────────
   Chưa cấu hình Upstash thì trước đây MỌI bucket rơi về bộ đếm trong bộ nhớ của
   từng máy chủ — kể cả bucket failClosed chống dò mật khẩu album / SĐT hợp
   đồng: kẻ dò gửi dồn để các lượt rải ra nhiều máy chủ serverless là vượt giới
   hạn. Nay bucket failClosed dùng hàm rate_limit_hit trong chính Postgres của
   Supabase (migrations/gioi_han_tan_suat.sql). Bucket thường (chống spam) vẫn
   đếm trong bộ nhớ: chúng được gọi nhiều hơn hẳn, không đáng một lượt DB mỗi lần.
   Chưa chạy migration thì lùi về bộ nhớ như cũ, và thôi hỏi lại trong 10 phút. */
let pgMissingUntil = 0;

/** Khoá gửi xuống DB: băm, để bảng không chứa IP / token thô. */
function pgKey(key: string): string {
  return createHash("sha256").update(key).digest("base64url").slice(0, 32);
}

/** Số lượt trong cửa sổ; "missing" = chưa chạy migration; "error" = DB lỗi. */
async function pgCount(key: string, windowMs: number): Promise<number | "missing" | "error"> {
  if (Date.now() < pgMissingUntil) return "missing";
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: pgKey(key),
      p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000)),
    });
    if (error) {
      // PGRST202 / 42883: hàm chưa có (chưa chạy SQL) → bộ nhớ, đừng gọi lại mỗi lượt.
      if (error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "")) {
        pgMissingUntil = Date.now() + 10 * 60_000;
        return "missing";
      }
      return "error";
    }
    const n = Number(data);
    return Number.isFinite(n) && n >= 1 ? n : "error";
  } catch {
    return "error";
  }
}

/** Bộ đếm nào đang canh các cửa nhạy cảm — cho trang Quản trị hệ thống. */
export async function rateLimitMode(): Promise<"upstash" | "postgres" | "memory"> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return "upstash";
  pgMissingUntil = 0; // admin vừa chạy SQL thì phải thấy ngay, không chờ 10 phút
  const n = await pgCount("rate-limit-mode-probe", 60_000);
  return typeof n === "number" ? "postgres" : "memory";
}

/**
 * Bản BỀN (chia sẻ giữa các instance serverless) qua Upstash Redis REST — dùng
 * cho endpoint nhạy cảm (dò mật khẩu). Chưa cấu hình Upstash: bucket failClosed
 * đếm trong Postgres (xem pgCount), bucket thường đếm in-memory (như limitByIp).
 * Lỗi kho → fail-open (không khóa oan người dùng), trừ khi failClosed.
 * Cần env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 */
export async function durableAllowed(
  key: string,
  limit: number,
  windowMs: number,
  failClosed = false
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) {
    if (failClosed) {
      const n = await pgCount(key, windowMs);
      if (typeof n === "number") return n <= limit;
      if (n === "error") return false; // không đo được ở cửa nhạy cảm → chặn tạm
    }
    return rateLimit(key, limit, windowMs); // fallback in-memory (deterministic)
  }
  const ttl = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(ttl), "NX"],
      ]),
      cache: "no-store",
    });
    // Kho lỗi: mặc định fail-open (không khóa oan). Với bucket nhạy cảm
    // (dò mật khẩu/PII) truyền failClosed=true để CHẶN khi không đo được —
    // thà chặn tạm còn hơn mở toang cửa brute-force khi Upstash gián đoạn.
    if (!res.ok) return !failClosed;
    // /pipeline có thể trả HTTP 200 nhưng phần tử lệnh là {error} (vd WRONGTYPE).
    // INCR thành công LUÔN trả về số đếm ≥ 1; nếu thiếu/không hữu hạn/<1 nghĩa là
    // lệnh hỏng → coi như KHÔNG đo được (đừng để mặc định 0 làm count<=limit đúng
    // rồi mở bucket dù failClosed).
    const data = (await res.json()) as Array<{ result?: number; error?: string }>;
    const count = Number(data?.[0]?.result);
    if (!Number.isFinite(count) || count < 1) return !failClosed;
    return count <= limit;
  } catch {
    return !failClosed;
  }
}

export async function limitByIpDurable(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
  opts?: { failClosed?: boolean }
): Promise<NextResponse | null> {
  const ok = await durableAllowed(`${bucket}:${clientIp(req)}`, limit, windowMs, opts?.failClosed);
  return ok ? null : NextResponse.json({ error: "rate_limited" }, { status: 429 });
}
