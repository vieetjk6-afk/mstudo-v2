import { NextResponse } from "next/server";
import { getProfileById, getSessionUser, needsMfa } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify-admin";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * GÓP Ý GIAO DIỆN MỚI — studio đang dùng thử bản V2 gửi về cho quản trị mstudo
 * (menu tài khoản → "Góp ý giao diện mới", hoặc lúc bấm "Về giao diện cũ").
 *
 * Đầu vào: POST { message, leaving?, path?, width? }
 *
 * Ghi vào hai nơi:
 *   • bảng `feedbacks` — hiện ở Cấu hình mstudo → "Góp ý & liên hệ", có nút đánh
 *     dấu đã xử lý. Bảng này không có trong schema.sql (tạo tay từ trước), nên
 *     lỗi ghi được bỏ qua;
 *   • thông báo cho mọi admin (chuông + trang Thông báo) kèm nội dung — chắc chắn
 *     tới tay admin kể cả khi máy chủ chưa có bảng `feedbacks`.
 *
 * Chỉ người đã đăng nhập mới gửi được (không cần captcha), mỗi người tối đa 5
 * lượt / 10 phút.
 */
const MAX_LEN = 3000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || (await needsMfa())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!rateLimit(`ui-feedback:${user.id}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    leaving?: boolean;
    path?: string;
    width?: number;
  };
  const text = body.message?.trim().slice(0, MAX_LEN);
  if (!text) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const me = await getProfileById(user.id);
  if (!me || !me.is_active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const name = (me.full_name as string | null)?.trim() || user.email || "Studio";
  const where = [
    typeof body.path === "string" && body.path.startsWith("/") ? `Trang: ${body.path.slice(0, 200)}` : null,
    typeof body.width === "number" && body.width > 0 ? (body.width < 1024 ? "điện thoại" : "máy tính") : null,
  ].filter(Boolean).join(" · ");
  const tag = body.leaving ? "[Giao diện mới · quay về bản cũ]" : "[Giao diện mới]";
  const message = `${tag} ${text}${where ? `\n\n${where}` : ""}`;

  try {
    await createAdminClient().from("feedbacks").insert({ name, email: user.email ?? null, message });
  } catch {
    /* bảng chưa có — vẫn còn thông báo bên dưới */
  }
  await notifyAdmins("contact", `Góp ý giao diện mới từ ${name}: ${text.slice(0, 500)}`, { url: "/dashboard/settings" });

  return NextResponse.json({ ok: true });
}
