import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { kiemSoDem, ngayUtc } from "@/lib/luu-luong-rules";

export const dynamic = "force-dynamic";

/**
 * Nhận số byte trình duyệt đã đọc thẳng từ Supabase (@/lib/supabase/client) để
 * cộng vào ước tính egress của tháng (bảng system_usage). Không cần đăng nhập —
 * trang khách cũng đọc Supabase — nên có trần mỗi lần gửi và giới hạn tần suất
 * theo IP; tệ nhất ai đó chỉ làm số ước tính cao lên. Luôn trả 204.
 */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "?";
  const xong = new NextResponse(null, { status: 204 });
  if (!rateLimit(`usage-egress:${ip}`, 20, 60_000)) return xong;
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 512) return xong;
    raw = JSON.parse(text);
  } catch {
    return xong;
  }
  const so = kiemSoDem(raw);
  if (!so) return xong;
  try {
    await createAdminClient().rpc("usage_add", {
      p_day: ngayUtc(),
      p_source: "supabase-trinh-duyet",
      p_metric: "egress",
      p_bytes: so.bytes,
      p_requests: so.requests,
    });
  } catch {
    /* chưa chạy migration / lỗi tạm — số ước tính, bỏ qua */
  }
  return xong;
}
