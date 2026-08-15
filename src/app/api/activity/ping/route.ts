import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * Ghi nhận một lượt mở khu quản lý.
 *
 * Gọi từ <ActivityPing /> trong layout dashboard, đã chặn lặp phía trình duyệt
 * (sessionStorage). Ở đây vẫn tự chốt lần nữa bằng dữ liệu trong DB: chặn phía
 * client chỉ là để đỡ gọi mạng, không phải để tin.
 *
 * Ghi bằng SERVICE-ROLE chứ không phải client của người dùng: bộ đếm này dùng để
 * quyết định chuyện kinh doanh (ai còn dùng, ai nên gọi lại), nên người dùng
 * không được tự sửa số của mình. Migration activity_tracking.sql cố ý KHÔNG cấp
 * quyền UPDATE các cột này cho `authenticated`.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: prev } = await db
    .from("profiles")
    .select("last_active_at, last_active_day, active_days, visit_count, studio_owner_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!prev) return NextResponse.json({ error: "no_profile" }, { status: 404 });

  const patch = nextActivity(
    {
      last_active_at: (prev.last_active_at as string | null) ?? null,
      last_active_day: (prev.last_active_day as string | null) ?? null,
      active_days: (prev.active_days as number) ?? 0,
      visit_count: (prev.visit_count as number) ?? 0,
    },
    new Date(),
  );
  // Vẫn trong cùng phiên và cùng ngày → không có gì mới, khỏi ghi DB.
  if (!patch) return NextResponse.json({ ok: true, skipped: true });

  await db.from("profiles").update(patch).eq("id", user.id);

  // Nhân viên mở app cũng là studio đó đang hoạt động: chỉ cập nhật MỐC THỜI
  // GIAN của chủ studio, KHÔNG cộng active_days/visit_count của chủ — nếu không
  // một studio 5 nhân viên sẽ trông chăm chỉ gấp 5 lần thực tế.
  const ownerId = prev.studio_owner_id as string | null;
  if (ownerId) {
    await db
      .from("profiles")
      .update({ last_active_at: patch.last_active_at })
      .eq("id", ownerId)
      // Chỉ đẩy mốc TIẾN LÊN — nhân viên ở múi giờ lệch hoặc request tới muộn
      // không được kéo lùi mốc của chủ studio.
      .lt("last_active_at", patch.last_active_at);
  }

  return NextResponse.json({ ok: true });
}
