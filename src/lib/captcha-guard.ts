import "server-only";
import { NextResponse } from "next/server";
import { limitByIpDurable } from "@/lib/rate-limit";
import { checkTurnstile } from "@/lib/turnstile";

/** Hạn mức mặc định cho lượt gửi KHÔNG xác minh được: 5 lần/giờ/IP. */
const UNVERIFIED_LIMIT = 5;
const UNVERIFIED_WINDOW_MS = 60 * 60_000;

/**
 * Cổng captcha dùng chung cho các route công khai.
 *
 * Trả về `null` nếu được đi tiếp, hoặc sẵn một `NextResponse` lỗi để route trả
 * thẳng về:
 *   - "verified"   → đi tiếp, không giới hạn thêm.
 *   - "failed"     → 400 captcha_failed (mã có nhưng Cloudflare bác).
 *   - "unverified" → cho đi tiếp NHƯNG chỉ vài lượt mỗi giờ trên mỗi IP (429).
 *
 * Nhánh "unverified" là chỗ quan trọng nhất: nó thay cho hành vi cũ "cứ cho
 * qua". Khách thật gặp trục trặc Turnstile vẫn gửi được form (vài lượt là quá
 * đủ cho một người), còn script spam thì mất hẳn khả năng nã hàng loạt bằng
 * một chuỗi cố định.
 *
 * @param bucket tên khóa hạn mức riêng cho từng form (vd "contact").
 */
export async function guardCaptcha(
  req: Request,
  bucket: string,
  token: string | null | undefined,
  opts?: { limit?: number; windowMs?: number },
): Promise<NextResponse | null> {
  const verdict = await checkTurnstile(token);
  if (verdict === "verified") return null;
  if (verdict === "failed") {
    return NextResponse.json(
      { error: "captcha_failed", message: "Xác minh chống robot thất bại. Vui lòng tải lại trang và thử lại." },
      { status: 400 },
    );
  }
  return limitByIpDurable(
    req,
    `nocaptcha:${bucket}`,
    opts?.limit ?? UNVERIFIED_LIMIT,
    opts?.windowMs ?? UNVERIFIED_WINDOW_MS,
  );
}
