import "server-only";
import { NextResponse } from "next/server";

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

/**
 * Bản BỀN (chia sẻ giữa các instance serverless) qua Upstash Redis REST — dùng
 * cho endpoint nhạy cảm (dò mật khẩu). Nếu chưa cấu hình Upstash → tự lùi về bộ
 * đếm in-memory (như limitByIp). Lỗi kho → fail-open (không khóa oan người dùng).
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
  if (!url || !tok) return rateLimit(key, limit, windowMs); // fallback in-memory (deterministic)
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
