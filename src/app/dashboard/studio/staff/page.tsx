import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { getActiveBranches, getBranches } from "@/lib/branches";
import { crewPortalUrl } from "@/lib/crew-show";
import { ensureCrewToken } from "@/lib/crew-token";
import { branchName } from "@/lib/branch-rules";
import { canAssignBranch, canManageRoles, forcedBranchScope, isBranchScopedRole } from "@/lib/studio-roles";
import type { StudioCrew } from "@/lib/types";
import StaffAndCrew from "./StaffAndCrew";
import type { StaffRow } from "./StaffManager";
import type { RankRow } from "./RankingList";
import type { CrewRole } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÂN SỰ — /dashboard/studio/staff

   Ba tab: tài khoản nhân viên + vai trò, sổ thợ freelancer, và xếp hạng thợ.
   Hai route cũ chuyển hướng về đây: /dashboard/studio/crew → ?tab=crew,
   /dashboard/studio/ranking → ?tab=ranking.

   Quyền vào màn: từ QUẢN LÝ trở lên (sổ thợ là việc của quản lý). Nhưng tab
   "Nhân viên & phân quyền" chỉ CHỦ STUDIO thấy — tạo tài khoản và đổi vai trò là
   đường leo thang đặc quyền ngắn nhất, không mở cho quản lý.
   ═══════════════════════════════════════════════════════════════════════════ */

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
  const role = ctx.actingRole as string;
  const MANAGERS = ["owner", "admin", "manager", "branch_manager"];
  if (!MANAGERS.includes(role)) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không có quyền</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Mục nhân sự dành cho quản lý trở lên.
          </p>
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const myBranch = (ctx.actingBranchId as string | null) ?? null;
  // Quản lý chi nhánh bị GHIM vào cơ sở của mình — ở đây nghĩa là chỉ thấy nhân
  // sự và sổ thợ của cơ sở đó. `forcedBranchScope` trả "none" khi vai trò bị ghim
  // mà chưa được gán chi nhánh (fail-closed), nên trường hợp cấu hình thiếu cũng
  // không lọt dữ liệu cơ sở khác.
  const pinned = forcedBranchScope(role, myBranch);

  const [{ data: crewRows }, { data: assignments }, branches, allBranches] = await Promise.all([
    (pinned ? applyPin(supabase.from("studio_crew").select("*").eq("owner_id", ctx.id), pinned) : supabase.from("studio_crew").select("*").eq("owner_id", ctx.id)).order("name"),
    supabase
      .from("contract_crew")
      // name/role/salary: dùng cho TAB XẾP HẠNG (gộp từ màn /ranking cũ) —
      // cùng một truy vấn, không thêm vòng gọi DB nào.
      .select("phone, name, role, status, salary, contract:studio_contracts!inner(owner_id)")
      .eq("contract.owner_id", ctx.id)
      .not("phone", "is", null),
    getActiveBranches(ctx.id),
    getBranches(ctx.id),
  ]);

  // Mã link đăng ký thợ. Chỉ chủ/quản lý được cấp mã mới; nhân viên chỉ đọc.
  const { token: crewToken, error: tokenError } = await ensureCrewToken(
    ctx.id as string,
    (ctx.crew_token as string | null) ?? null,
    role !== "staff"
  );

  // RLS bảng profiles chỉ cho đọc dòng của chính mình → service-role để liệt kê
  // nhân viên của studio (đã giới hạn theo studio_owner_id).
  let staffQuery = createAdminClient()
    .from("profiles")
    .select("id, email, full_name, studio_role, studio_branch_id, is_active, created_at")
    .eq("studio_owner_id", ctx.id);
  if (pinned) {
    staffQuery = pinned === "none" ? staffQuery.is("studio_branch_id", null) : staffQuery.eq("studio_branch_id", pinned);
  }
  const { data: staff } = await staffQuery.order("created_at", { ascending: false });

  // Độ tin cậy của từng thợ theo SĐT (trên mọi hợp đồng của studio này).
  const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
  const stats: Record<string, { total: number; accepted: number; declined: number }> = {};
  type Assign = { phone: string | null; name: string | null; role: CrewRole; status: string; salary: number | null };
  const assignRows = (assignments ?? []) as unknown as Assign[];
  const rankMap = new Map<string, RankRow>();
  for (const a of assignRows) {
    const p = digits(a.phone);
    if (!p) continue;
    if (!stats[p]) stats[p] = { total: 0, accepted: 0, declined: 0 };
    stats[p].total += 1;
    if (a.status === "accepted") stats[p].accepted += 1;
    else if (a.status === "declined") stats[p].declined += 1;

    // Xếp hạng: gom theo SĐT, đếm buổi đã nhận và cộng tiền công của các buổi đó.
    const r = rankMap.get(p) ?? { key: p, name: a.name || p, role: a.role, jobs: 0, accepted: 0, earned: 0 };
    r.jobs += 1;
    if (a.status === "accepted") {
      r.accepted += 1;
      r.earned += a.salary || 0;
    }
    if (a.name) r.name = a.name;
    rankMap.set(p, r);
  }
  const ranked = Array.from(rankMap.values()).sort((x, y) => y.accepted - x.accepted || y.earned - x.earned);

  const branchOpts = branches.map((b) => ({ id: b.id, name: b.name }));

  return (
    <StaffAndCrew
      canSeeStaffTab={canManageRoles(role) || role === "manager"}
      staffProps={{
        initial: (staff ?? []) as StaffRow[],
        branches: branchOpts,
        canManageRoles: canManageRoles(role),
        canAssignBranch: canAssignBranch(role),
        lockedBranchName: isBranchScopedRole(role) ? branchName(myBranch, allBranches) : null,
      }}
      crewProps={{
        ownerId: ctx.id,
        initial: (crewRows ?? []) as StudioCrew[],
        stats,
        registerUrl: crewToken ? crewPortalUrl(crewToken) : "",
        registerError: crewToken ? null : tokenError,
        branches: branchOpts,
      }}
      ranked={ranked}
    />
  );
}

/** Ghim truy vấn vào chi nhánh bắt buộc. Cùng luật với `applyBranch` của
 *  lib/branches, viết tại chỗ vì đây là truy vấn `studio_crew` đã dựng dở. */
function applyPin<Q>(q: Q, pinned: string): Q {
  const b = q as unknown as { eq(c: string, v: unknown): Q; is(c: string, v: unknown): Q };
  return pinned === "none" ? b.is("branch_id", null) : b.eq("branch_id", pinned);
}
