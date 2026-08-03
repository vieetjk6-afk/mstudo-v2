import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import PayrollView, { type PayrollRow } from "./PayrollView";


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
  const { data } = await supabase
    .from("contract_crew")
    .select(
      "id, name, phone, role, salary, status, paid, contract:studio_contracts!inner(id, owner_id, title, code, event_date)"
    )
    .eq("contract.owner_id", profile.id)
    .order("created_at", { ascending: false });

  return <PayrollView rows={(data ?? []) as unknown as PayrollRow[]} />;
}
