import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudio } from "@/lib/auth-guards";
import ProductionView, { type ProductRow, type VendorOrderRow } from "./ProductionView";
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

  // Đơn đặt ngoài CÒN ĐANG CHẠY của studio — để tiến độ in nằm cùng chỗ với tiến
  // độ hậu kỳ, đúng như docs/goi-y-hoan-thien-app.md mục 6 yêu cầu: studio hỏi
  // "album của khách A xong chưa" ở đây chứ không đi mở một màn khác.
  // Bọc try/catch: project chưa chạy migrations/vendors.sql thì bảng chưa có, và
  // màn Xử lý hình ảnh KHÔNG được sập vì thiếu phần đó.
  let orders: VendorOrderRow[] = [];
  try {
    const { data: o } = await supabase
      .from("vendor_orders")
      .select("id, vendor_name, contract_id, title, amount, status, due_date")
      .eq("owner_id", profile.id)
      .neq("status", "delivered")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(200);
    orders = (o ?? []) as VendorOrderRow[];
  } catch {
    /* chưa chạy migrations/vendors.sql → không có khối đơn đặt ngoài */
  }

  return (
    <ProductionView
      orders={orders}
      initial={(data ?? []) as unknown as ProductRow[]}
      staff={(staff ?? []) as { id: string; full_name: string | null; email: string }[]}
    />
  );
}
