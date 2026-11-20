import { NextResponse } from "next/server";
import { requireStudio } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { canActOnContract } from "@/lib/studio-roles";
import { limitByIpDurable } from "@/lib/rate-limit";
import { emailClient } from "@/lib/client-email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cùng nhóm vai trò với nút Gửi Zalo (api/studio/zalo/send). */
const SEND_ROLES = ["owner", "admin", "manager", "branch_manager", "staff"];

/**
 * GỬI HỢP ĐỒNG CHO KHÁCH QUA EMAIL — nút "Gửi qua email" ở tab Ký & gửi.
 *
 * Dành cho khách không dùng điện thoại (không Zalo được), hoặc studio muốn gửi
 * thêm một kênh. Người nhận LUÔN là email đang lưu trên chính hợp đồng — không
 * nhận địa chỉ tuỳ ý từ trình duyệt, để nút này không thành cổng gửi thư tới
 * bất kỳ ai. Lời nhắn chép gửi khách ghi "(mật khẩu là SĐT…)" tự đổi thành mã
 * số khi khách không có SĐT (xem @/lib/client-email).
 *
 * Body: { body: string, email: string } — `email` là địa chỉ đang hiện trên
 * màn hình; lệch với bản đã lưu (ô vừa sửa, chưa tự lưu xong) thì trả
 * `unsaved` để nút bảo studio đợi một giây rồi bấm lại.
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const profile = await requireStudio("full");
  if (!profile || !SEND_ROLES.includes(profile.actingRole as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const limited = await limitByIpDurable(req, `contract-email:${id}`, 10, 3600_000);
  if (limited) return limited;

  const b = (await req.json().catch(() => ({}))) as { body?: unknown; email?: unknown };
  const body = typeof b.body === "string" ? b.body.trim().slice(0, 4000) : "";
  if (!body) return NextResponse.json({ error: "missing_content" }, { status: 400 });

  const db = createAdminClient();
  const { data: c } = await db
    .from("studio_contracts")
    .select("id, owner_id, assigned_to, branch_id, client_email")
    .eq("id", id)
    .maybeSingle();
  if (!c || c.owner_id !== profile.id || !canActOnContract(profile, c)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const saved = ((c.client_email as string | null) || "").trim();
  if (!saved) return NextResponse.json({ error: "no_email" }, { status: 400 });
  if (typeof b.email === "string" && b.email.trim().toLowerCase() !== saved.toLowerCase()) {
    return NextResponse.json({ error: "unsaved" }, { status: 409 });
  }

  const r = await emailClient({ ownerId: profile.id, kind: "contract_share", body, contractId: id });
  if (!r.ok) {
    return NextResponse.json(
      { error: r.error === "email_not_configured" ? "not_configured" : r.error || "send_failed" },
      { status: r.error === "email_not_configured" ? 503 : 502 }
    );
  }
  return NextResponse.json({ ok: true, to: saved });
}
