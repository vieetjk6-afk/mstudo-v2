import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import { getBranches } from "@/lib/branches";
import { todayVN } from "@/lib/date";
import { addDays, mondayOf } from "@/lib/appointments";
import { statsByBranch, type BranchStats } from "@/lib/branch-rules";
import type { StudioBranch } from "@/lib/types";
import BranchesManager, { type BranchStaff } from "./BranchesManager";

/* ═══════════════════════════════════════════════════════════════════════════
   CHI NHÁNH STUDIO — /dashboard/studio/branches

   Nhiều cơ sở trong CÙNG một tài khoản: mỗi chi nhánh có đội ngũ, lịch và sổ thu
   chi riêng, chủ studio xem gộp hoặc tách. Trang này là nơi khai chi nhánh và
   đối chiếu chúng với nhau; việc lọc từng màn theo chi nhánh do ô chọn trên
   thanh trên cùng lo (xem components/BranchSwitcher.tsx).
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function BranchesPage() {
  const profile = await requireStudio("full");
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Chi nhánh studio chỉ dành cho tài khoản gói <b>Studio</b>.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  const today = todayVN();
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);

  const [branches, { data: contracts }, { data: expenses }, { data: crew }, { data: appointments }] = await Promise.all([
    getBranches(profile.id),
    // Hợp đồng TỪ ĐẦU THÁNG: đủ để so hai cơ sở với nhau mà không phải quét cả
    // lịch sử. Kèm hạng mục + khoản thu để tính giá trị và tiền thực thu.
    supabase
      .from("studio_contracts")
      .select("id, branch_id, status, contract_items(qty, unit_price), contract_payments(amount)")
      .eq("owner_id", profile.id)
      .gte("event_date", monthStart)
      .neq("status", "cancelled"),
    supabase.from("studio_expenses").select("branch_id, amount").eq("owner_id", profile.id).gte("spent_at", monthStart),
    supabase.from("studio_crew").select("branch_id").eq("owner_id", profile.id),
    supabase
      .from("studio_appointments")
      .select("branch_id")
      .eq("owner_id", profile.id)
      .gte("appt_date", weekStart)
      .lte("appt_date", weekEnd)
      .neq("status", "cancelled"),
  ]);

  // RLS bảng profiles chỉ cho đọc dòng của chính mình → service-role để liệt kê
  // nhân viên của studio (đã giới hạn theo studio_owner_id).
  const { data: staff } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email, studio_role, studio_branch_id")
    .eq("studio_owner_id", profile.id)
    .order("full_name");

  const staffRows = (staff ?? []) as BranchStaff[];

  const stats = statsByBranch(branches, {
    contracts: (contracts ?? []).map((c) => ({
      branch_id: (c.branch_id as string | null) ?? null,
      items: (c.contract_items ?? []) as { qty: number; unit_price: number }[],
      payments: (c.contract_payments ?? []) as { amount: number }[],
    })),
    expenses: (expenses ?? []) as { branch_id: string | null; amount: number }[],
    staff: staffRows.map((s) => ({ studio_branch_id: s.studio_branch_id })),
    crew: (crew ?? []) as { branch_id: string | null }[],
    appointments: (appointments ?? []) as { branch_id: string | null }[],
  });

  // Map không truyền qua ranh giới server → client được, chuyển thành mảng.
  const statList: BranchStats[] = [...stats.values()];

  return (
    <BranchesManager
      ownerId={profile.id}
      canEdit={profile.actingRole !== "staff"}
      initial={branches as StudioBranch[]}
      stats={statList}
      staff={staffRows}
      monthLabel={`${Number(today.slice(5, 7))}/${today.slice(0, 4)}`}
    />
  );
}
