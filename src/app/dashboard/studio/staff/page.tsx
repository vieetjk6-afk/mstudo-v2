import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { getActiveBranches } from "@/lib/branches";
import StaffManager, { type StaffRow } from "./StaffManager";


export default async function StaffPage() {
  const ctx = await requireStudio();
  if (!ctx) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  if (ctx.actingRole !== "owner" && ctx.actingRole !== "admin") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Chỉ chủ studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Chỉ chủ studio mới quản lý được nhân viên.</p>
        </div>
      </div>
    );
  }

  // Dùng service-role: RLS bảng profiles chỉ cho đọc dòng của chính mình, nên
  // chủ studio (không phải admin) sẽ không liệt kê được nhân viên bằng client
  // thường. Truy vấn đã giới hạn theo studio_owner_id = ctx.id nên an toàn.
  const supabase = createAdminClient();
  const [{ data }, branches] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, studio_role, studio_branch_id, is_active, created_at")
      .eq("studio_owner_id", ctx.id)
      .order("created_at", { ascending: false }),
    getActiveBranches(ctx.id as string),
  ]);

  return (
    <StaffManager
      initial={(data ?? []) as StaffRow[]}
      branches={branches.map((b) => ({ id: b.id, name: b.name }))}
    />
  );
}
