import { NextResponse } from "next/server";
import { requireDesktopOwner } from "@/lib/desktop/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Cấp một ĐƯỜNG ĐĂNG NHẬP DÙNG MỘT LẦN cho máy đã kết nối (MStudo Desktop).
 *
 * VÌ SAO CẦN: cửa sổ studio trong app desktop là WebView2 nhúng, và ở đó việc
 * đăng nhập bằng form web hay hỏng theo cách người dùng không tự gỡ được:
 * Google chặn thẳng đăng nhập trong webview nhúng ("browser may not be secure"),
 * captcha Turnstile lắm lúc không chạy, cookie phiên thì không có menu trình
 * duyệt nào để xóa. Trong khi đó máy này ĐÃ được chủ studio xác thực một lần
 * bằng mã kết nối `msd_...` — bắt đăng nhập lại lần nữa bên trong app vừa thừa
 * vừa là chỗ duy nhất hay hỏng.
 *
 * Đổi lại: app gửi mã thiết bị, máy chủ sinh mã đăng nhập một lần (magic link
 * của Supabase) cho ĐÚNG chủ máy đó, app mở /auth/desktop để đổi lấy phiên.
 *
 * Phạm vi quyền KHÔNG rộng thêm: mã thiết bị vốn đã đọc/ghi được toàn bộ dữ
 * liệu studio qua /api/desktop/*, nên phiên web cấp ra đúng bằng quyền sẵn có
 * của chính chủ studio đó.
 *
 * CHỈ nhận mã thiết bị (`via === "device"`): phiên web thì đã đăng nhập rồi,
 * không có lý do gì phải xin thêm đường đăng nhập mới.
 */
export async function POST(req: Request) {
  const auth = await requireDesktopOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.via !== "device") {
    return NextResponse.json({ error: "device_only" }, { status: 403 });
  }

  // Chặn lạm dụng: mỗi máy chỉ xin vài mã mỗi 5 phút. Đăng nhập tự động chỉ
  // chạy khi mở app hoặc khi bị đá về trang đăng nhập, nên hạn mức này thoải
  // mái cho dùng thật mà vẫn chặn vòng lặp xin mã liên tục.
  if (!rateLimit(`desktop-session:${auth.deviceId || auth.ownerId}`, 5, 5 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const db = createAdminClient();
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(auth.ownerId);
  const email = userRes?.user?.email;
  if (userErr || !email) {
    return NextResponse.json({ error: "no_email" }, { status: 400 });
  }

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    // Không lộ chi tiết ra client, nhưng phải ghi lại — đây là chỗ duy nhất
    // biết được vì sao đăng nhập tự động im lặng không chạy.
    console.error("[api/desktop/session] generateLink lỗi", error?.message);
    return NextResponse.json({ error: "link_failed" }, { status: 502 });
  }

  const { origin } = new URL(req.url);
  const next = "/dashboard/studio";
  return NextResponse.json({
    url: `${origin}/auth/desktop?token_hash=${encodeURIComponent(tokenHash)}&next=${encodeURIComponent(next)}`,
    email,
  });
}
