import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { brandFrom } from "@/lib/studio-brand";
import PayrollView, { type PayrollRow } from "./PayrollView";
import { applyBranch, getBranchScope } from "@/lib/branches";
import type { TimesheetRow } from "@/lib/timesheet";


export default async function PayrollPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Tính năng này chỉ dành cho tài khoản gói Studio.</p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }
  if (profile.actingRole === "staff") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Không có quyền</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Mục lương chỉ dành cho quản lý / kế toán.</p>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // Tiền công là dữ liệu nhạy cảm nhất của màn này — phải theo phạm vi chi nhánh.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  const { data } = await applyBranch(
    supabase
      .from("contract_crew")
      .select(
        "id, name, phone, role, salary, status, paid, contract:studio_contracts!inner(id, owner_id, title, code, event_date, branch_id)"
      )
      .eq("contract.owner_id", profile.id),
    scope.selected,
    "contract.branch_id"
  ).order("created_at", { ascending: false });

  // Giờ làm THỰC TẾ + đơn giá giờ. Query RIÊNG và bọc try/catch: project chưa
  // chạy supabase/migrations/crew_timesheet.sql thì hai thứ này chưa tồn tại, và
  // màn Đối soát tiền công KHÔNG được sập vì thiếu phần đối chiếu.
  let sheet: TimesheetRow[] = [];
  let rates: Record<string, number> = {};
  try {
    const [{ data: ts }, { data: crew }] = await Promise.all([
      supabase
        .from("crew_timesheet")
        .select("id, phone, name, contract_id, work_date, started_at, ended_at, note")
        .eq("owner_id", profile.id)
        .order("work_date", { ascending: false })
        .limit(2000),
      supabase.from("studio_crew").select("phone, hourly_rate").eq("owner_id", profile.id),
    ]);
    sheet = ((ts ?? []) as {
      id: string; phone: string; name: string | null; contract_id: string | null;
      work_date: string; started_at: string | null; ended_at: string | null; note: string | null;
    }[]).map((r) => ({
      id: r.id, phone: r.phone, name: r.name, contractId: r.contract_id,
      workDate: r.work_date, startedAt: r.started_at, endedAt: r.ended_at, note: r.note,
    }));
    for (const c of (crew ?? []) as { phone: string; hourly_rate: number | null }[]) {
      const d = (c.phone ?? "").replace(/\D/g, "");
      if (d && c.hourly_rate) rates[d] = c.hourly_rate;
    }
  } catch {
    /* chưa chạy migration crew_timesheet.sql → màn vẫn chạy, chỉ không có cột giờ */
  }

  return (
    <PayrollView
      timesheet={sheet}
      rates={rates}
      rows={(data ?? []) as unknown as PayrollRow[]}
      studio={{
        name: brandFrom(profile).name,
        phone: (profile.pl_phone as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      }}
    />
  );
}
