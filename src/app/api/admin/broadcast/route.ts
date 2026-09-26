import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectivePlan, studioTier } from "@/lib/plans";
import { sendPushToOwners } from "@/lib/push";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Target = "everyone" | "all" | "studio" | "booking";

/**
 * Gửi thông báo hệ thống (hiển thị ngay trong webapp qua chuông thông báo và
 * bảng popup nổi). Chỉ admin. Mỗi tài khoản nhận 1 dòng trong studio_notifications.
 *
 * body: { message: string, target, push?: boolean, important?: boolean }
 *   everyone — MỌI tài khoản đang hoạt động (kể cả nhân viên phụ, tài khoản free)
 *   all      — mọi tài khoản chủ studio (có quyền dùng studio)
 *   studio   — chỉ gói Studio (đầy đủ hợp đồng/tài chính)
 *   booking  — chỉ Photographer/Basic (đặt lịch)
 *   important — bật popup nổi bắt buộc xác nhận
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    message?: unknown;
    target?: unknown;
    push?: unknown;
    important?: unknown;
  };
  const message = String(body.message ?? "").trim();
  const target = (["everyone", "all", "studio", "booking"].includes(String(body.target))
    ? body.target
    : "everyone") as Target;
  const wantPush = body.push === true;
  const important = body.important === true;

  if (!message) return NextResponse.json({ error: "empty_message" }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: "too_long" }, { status: 413 });

  const db = createAdminClient();

  // "everyone" gồm cả nhân viên phụ; các đối tượng còn lại chỉ tính chủ tài khoản.
  let query = db
    .from("profiles")
    .select("id, role, plan, plan_expires_at, is_active, studio_owner_id")
    .eq("is_active", true);
  if (target !== "everyone") query = query.is("studio_owner_id", null);

  const { data: profiles, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const owners = (profiles ?? []) as Pick<
    Profile,
    "id" | "role" | "plan" | "plan_expires_at" | "is_active" | "studio_owner_id"
  >[];

  const recipients = owners.filter((p) => {
    if (target === "everyone") return true; // mọi tài khoản
    const tier = studioTier(effectivePlan(p.plan, p.plan_expires_at), p.role === "admin");
    if (target === "studio") return tier === "full";
    if (target === "booking") return tier === "booking";
    // "all" — bất kỳ ai CÓ quyền dùng studio. Phải dùng `!== "none"` chứ không
    // liệt kê full/booking: studioTier() map Photographer Plus thành "plus", nên
    // liệt kê tay sẽ bỏ sót nhóm này (họ vẫn vào được dashboard studio đầy đủ).
    // Cả app dùng `tier !== "none"` để nghĩa là "có quyền studio".
    return tier !== "none";
  });

  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const rows = recipients.map((p) => ({
    owner_id: p.id,
    contract_id: null,
    kind: "announcement",
    message,
    important,
  }));

  // Chèn theo lô để tránh payload quá lớn. Nếu cột "important" chưa được thêm
  // vào DB (chưa chạy migration) thì tự bỏ cột đó và chèn lại — không làm hỏng gửi.
  const CHUNK = 500;
  let dropImportant = false;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const payload = dropImportant
      ? slice.map(({ important: _important, ...rest }) => rest)
      : slice;
    const { error: insErr } = await db.from("studio_notifications").insert(payload);
    if (insErr) {
      if (!dropImportant && /important/i.test(insErr.message)) {
        dropImportant = true;
        i -= CHUNK; // thử lại lô này không kèm "important"
        continue;
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  // Web push (khi bật): báo cả khi studio không mở webapp. No-op nếu chưa cấu hình VAPID.
  let pushed = 0;
  if (wantPush) {
    pushed = await sendPushToOwners(
      recipients.map((p) => p.id),
      { title: "Thông báo hệ thống", body: message, url: "/dashboard/studio/notifications", tag: "mstudo-announcement" }
    );
  }

  return NextResponse.json({ ok: true, sent: rows.length, pushed });
}
