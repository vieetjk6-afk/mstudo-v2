import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardCaptcha } from "@/lib/captcha-guard";
import { limitByIp } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/** Public: submit a contact / feedback message from mstudo.com homepage. */
export async function POST(req: Request) {
  const limited = limitByIp(req, "contact", 5, 60_000);
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    message?: string;
    captcha?: string;
  };

  // Cổng captcha: mã hợp lệ thì đi thẳng; mã bị Cloudflare bác thì 400; không
  // xác minh được (widget không chạy / chưa cấu hình) thì vẫn cho gửi nhưng chỉ
  // vài lượt mỗi giờ trên mỗi IP.
  const captcha = await guardCaptcha(req, "contact", body.captcha);
  if (captcha) return captcha;

  const name = body.name?.trim();
  const message = body.message?.trim().slice(0, 5000);
  if (!name || !message) {
    return NextResponse.json({ error: "Vui lòng nhập tên và nội dung." }, { status: 400 });
  }

  const db = createAdminClient();
  const { error } = await db.from("feedbacks").insert({
    name,
    email: body.email?.trim() || null,
    message,
  });

  if (error) {
    // If the feedbacks table doesn't exist yet, return a soft error.
    if (error.code === "42P01") {
      return NextResponse.json({ error: "table_missing" }, { status: 500 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Báo cho quản trị viên có liên hệ / góp ý mới.
  await notifyAdmins("contact", `Liên hệ / góp ý mới từ ${name}${body.email ? ` (${body.email.trim()})` : ""}`);

  return NextResponse.json({ ok: true });
}
