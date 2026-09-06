import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import BoardView, { type BoardCard } from "./BoardView";
import { applyBranch, getBranchScope } from "@/lib/branches";


export default async function BoardPage() {
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

  const supabase = await createClient();
  let q = supabase
    .from("studio_contracts")
    .select("id, title, client_name, status, event_date, delivery_due, contract_items(qty, unit_price), contract_tasks(done)")
    .eq("owner_id", profile.id);
  if (profile.actingRole === "staff") q = q.eq("assigned_to", profile.actingUserId);
  q = applyBranch(q, (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected);
  const { data } = await q.order("event_date", { ascending: true, nullsFirst: false });

  return <BoardView initial={(data ?? []) as unknown as BoardCard[]} />;
}
