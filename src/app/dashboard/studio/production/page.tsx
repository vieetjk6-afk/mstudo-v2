import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import ProductionView, { type ProductRow } from "./ProductionView";
import { applyBranch, getBranchScope } from "@/lib/branches";


export default async function ProductionPage() {
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

  const supabase = createClient();
  // Phạm vi chi nhánh (vai trò "Toàn quyền chi nhánh" bị ghim). Lọc qua hợp đồng
  // cha vì contract_products không mang cột chi nhánh.
  const scope = await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string);
  let q = supabase
    .from("contract_products")
    .select("id, name, qty, cost, status, note, assigned_to, contract:studio_contracts!inner(id, owner_id, title, client_name, delivery_due, assigned_to, branch_id)")
    .eq("contract.owner_id", profile.id)
    .order("created_at", { ascending: true });
  if (profile.actingRole === "staff") q = q.eq("contract.assigned_to", profile.actingUserId);
  q = applyBranch(q, scope.selected, "contract.branch_id");
  const { data } = await q;

  // RLS bảng profiles chỉ cho đọc dòng của chính mình → dùng service-role để
  // liệt kê nhân viên của studio (đã giới hạn theo studio_owner_id).
  const { data: staff } = await createAdminClient()
    .from("profiles")
    .select("id, full_name, email")
    .eq("studio_owner_id", profile.id)
    .order("full_name");

  return (
    <ProductionView
      initial={(data ?? []) as unknown as ProductRow[]}
      staff={(staff ?? []) as { id: string; full_name: string | null; email: string }[]}
    />
  );
}
