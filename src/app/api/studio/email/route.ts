import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitByIpDurable } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));

/** Send a reminder/notification email to a client. Studio-plan accounts only. */
export async function POST(req: Request) {
  const me = await requireStudio("plus");
  if (!me) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Nhân viên thường (staff) không được dùng cổng gửi mail — nút Email chỉ nằm ở
  // các trang cấp quản lý. Chốt lại phía server để không gọi thẳng API vượt UI.
  if (me.actingRole === "staff") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Chống biến cổng này thành RELAY thư rác/lừa đảo: giới hạn theo studio (kèm IP).
  // 20 thư/giờ dư cho nhắc lịch/xin đánh giá bình thường nhưng chặn gửi hàng loạt.
  const limited = await limitByIpDurable(req, `studio-email:${me.id}`, 20, 3600_000);
  if (limited) return limited;

  const { to, subject, message } = (await req.json().catch(() => ({}))) as {
    to?: string;
    subject?: string;
    message?: string;
  };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "bad_email" }, { status: 400 });
  }

  // Người nhận PHẢI là khách của chính studio này (email có trong hợp đồng hoặc
  // báo giá của studio). Trước đây `to` chỉ kiểm định dạng → một thành viên studio
  // có thể gửi thư nội dung tuỳ ý tới ĐỊA CHỈ BẤT KỲ qua hạ tầng gửi của nền tảng.
  const admin = createAdminClient();
  const likeTo = to.replace(/[%_\\]/g, "\\$&"); // chặn ký tự đại diện của LIKE
  const [{ data: c }, { data: q }] = await Promise.all([
    admin.from("studio_contracts").select("id").eq("owner_id", me.id).ilike("client_email", likeTo).limit(1),
    admin.from("studio_quotes").select("id").eq("owner_id", me.id).ilike("client_email", likeTo).limit(1),
  ]);
  if (!(c && c.length) && !(q && q.length)) {
    return NextResponse.json({ error: "recipient_not_a_client" }, { status: 403 });
  }

  const body = (message || "").trim();
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222;line-height:1.6">${esc(body).replace(/\n/g, "<br>")}</div>`;

  const r = await sendEmail({ to, subject: subject?.trim() || "Thông báo từ studio", html });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "not_configured" ? 503 : 500 });
  return NextResponse.json({ ok: true });
}
