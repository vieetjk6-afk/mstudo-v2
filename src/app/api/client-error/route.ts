import { NextResponse } from "next/server";
import { limitByIp } from "@/lib/rate-limit";
import { logSystemError } from "@/lib/system-runs";

export const dynamic = "force-dynamic";

/**
 * Nhận báo cáo "trang vừa sập" từ error.tsx / global-error.tsx của trình duyệt.
 *
 * Công khai (khách xem album cũng có thể gặp lỗi) nên mọi thứ gửi lên đều là
 * dữ liệu KHÔNG tin được: cắt ngắn, bỏ query string, giới hạn 5 lượt / phút
 * mỗi IP, và KHÔNG nhắc admin — chỉ hiện ở trang Sức khoẻ hệ thống. Luôn trả
 * 204 để không lộ cho người gọi biết có ghi hay không.
 */
export async function POST(req: Request) {
  const limited = limitByIp(req, "client-error", 5, 60_000);
  if (limited) return limited;
  try {
    const raw = await req.text();
    if (raw.length <= 4000) {
      const b = JSON.parse(raw) as { message?: unknown; path?: unknown; digest?: unknown; name?: unknown };
      const message = typeof b.message === "string" ? b.message.trim().slice(0, 300) : "";
      const path = typeof b.path === "string" && b.path.startsWith("/") ? b.path.split(/[?#]/)[0].slice(0, 200) : "";
      if (message && path) {
        await logSystemError({
          source: "client",
          name: typeof b.name === "string" ? b.name.slice(0, 60) : "Error",
          message,
          path,
          sample: { digest: typeof b.digest === "string" ? b.digest.slice(0, 40) : null },
        });
      }
    }
  } catch {
    /* thân hỏng → bỏ qua */
  }
  return new NextResponse(null, { status: 204 });
}
