import { NextResponse } from "next/server";
import { getSessionUser, getProfileById } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/**
 * Ghi nhật ký khi một tài khoản bật / tắt xác thực 2 lớp. Chủ studio cần thấy
 * "kế toán vừa TẮT 2 lớp" — đó chính là việc kẻ chiếm tài khoản sẽ làm đầu tiên.
 *
 * Không tin lời trình duyệt về TRẠNG THÁI: đọc lại danh sách yếu tố của chính
 * người dùng từ Supabase rồi mới ghi.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { event } = (await req.json().catch(() => ({}))) as { event?: string };
  if (event !== "enroll" && event !== "unenroll") return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const db = createAdminClient();
  const { data } = await db.auth.admin.mfa.listFactors({ userId: user.id });
  const verified = (data?.factors ?? []).filter((f) => f.status === "verified").length;
  if ((event === "enroll") !== verified > 0) return NextResponse.json({ ok: true, skipped: true });

  const me = await getProfileById(user.id);
  const ownerId = (me?.studio_owner_id as string | null) || user.id;
  await logAction(db, {
    ownerId,
    actorId: user.id,
    action: event === "enroll" ? "mfa.enroll" : "mfa.unenroll",
    entity: "account",
    entityId: user.id,
    summary: `${me?.full_name || user.email} ${event === "enroll" ? "bật" : "TẮT"} xác thực 2 lớp`,
  });
  return NextResponse.json({ ok: true });
}
