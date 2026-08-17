import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { LEAD_SOURCE_LABEL, contractTotal, sumAmounts, type StudioExpense } from "@/lib/types";
import { brandFrom } from "@/lib/studio-brand";
import ReportsView, { type PaymentRow, type SalaryRow, type SourceStat } from "./ReportsView";


export default async function ReportsPage() {
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
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Mục tài chính chỉ dành cho quản lý / kế toán.</p>
        </div>
      </div>
    );
  }

  const supabase = createClient();
  // srcContracts độc lập với 3 truy vấn còn lại → gộp chung một Promise.all thay
  // vì await nối tiếp sau đó (bớt một round-trip tuần tự).
  const [{ data: payments }, { data: salaries }, { data: expenses }, { data: srcContracts }] = await Promise.all([
    supabase
      .from("contract_payments")
      .select("id, amount, kind, paid_at, contract:studio_contracts!inner(owner_id, title)")
      .eq("contract.owner_id", profile.id),
    supabase
      .from("contract_crew")
      .select("id, name, salary, paid, paid_at, contract:studio_contracts!inner(owner_id, title)")
      .eq("contract.owner_id", profile.id)
      .eq("paid", true),
    supabase.from("studio_expenses").select("*").eq("owner_id", profile.id),
    // Lead-source analytics: value & collected per acquisition channel (all-time).
    supabase
      .from("studio_contracts")
      .select("source, contract_items(qty, unit_price), contract_payments(amount)")
      .eq("owner_id", profile.id)
      .neq("status", "cancelled"),
  ]);
  const srcMap = new Map<string, { count: number; value: number; collected: number }>();
  for (const c of (srcContracts ?? []) as unknown as Array<{
    source: string | null;
    contract_items: { qty: number; unit_price: number }[];
    contract_payments: { amount: number }[];
  }>) {
    const key = c.source || "other";
    const cur = srcMap.get(key) || { count: 0, value: 0, collected: 0 };
    cur.count += 1;
    cur.value += contractTotal(c.contract_items || []);
    cur.collected += sumAmounts(c.contract_payments || []);
    srcMap.set(key, cur);
  }
  const sourceStats: SourceStat[] = [...srcMap.entries()]
    .map(([source, v]) => ({ source, label: LEAD_SOURCE_LABEL[source] || source, ...v }))
    .sort((a, b) => b.value - a.value);

  return (
    <ReportsView
      ownerId={profile.id}
      studio={{
        name: brandFrom(profile).name,
        phone: (profile.pl_phone as string | null) ?? null,
        email: (profile.email as string | null) ?? null,
      }}
      payments={(payments ?? []) as unknown as PaymentRow[]}
      salaries={(salaries ?? []) as unknown as SalaryRow[]}
      initialExpenses={(expenses ?? []) as StudioExpense[]}
      initialTarget={Number(profile.monthly_revenue_target) || 0}
      sourceStats={sourceStats}
    />
  );
}
