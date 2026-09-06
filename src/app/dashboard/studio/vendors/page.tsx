import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import VendorsView, { type ContractOption, type OrderRow, type VendorRow } from "./VendorsView";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI — /dashboard/studio/vendors

   Album in, makeup thuê ngoài, xe hoa, địa điểm: trước đây tất cả chỉ là một
   dòng chi trong studio_expenses, nên không ai trả lời được "đơn album của
   khách A đã in xong chưa".

   Hai bảng đọc ở đây có thể CHƯA TỒN TẠI (project chưa chạy
   supabase/migrations/vendors.sql) — bọc try/catch để màn hiện trạng thái rỗng
   kèm hướng dẫn, thay vì đổ lỗi 500 vào mặt studio.
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function VendorsPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            Quản lý nhà cung cấp và đơn đặt ngoài dành cho tài khoản gói Studio.
          </p>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  const supabase = await createClient();

  let vendors: VendorRow[] = [];
  let orders: OrderRow[] = [];
  let migrated = true;
  try {
    const [{ data: v, error: vErr }, { data: o }] = await Promise.all([
      supabase.from("studio_vendors").select("*").eq("owner_id", profile.id).order("name"),
      supabase
        .from("vendor_orders")
        .select("id, vendor_id, vendor_name, contract_id, title, amount, status, due_date, note")
        .eq("owner_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (vErr) migrated = false;
    vendors = (v ?? []) as VendorRow[];
    orders = (o ?? []) as OrderRow[];
  } catch {
    migrated = false;
  }

  const { data: contracts } = await supabase
    .from("studio_contracts")
    .select("id, title, code, client_name")
    .eq("owner_id", profile.id)
    .in("status", ["approved", "in_progress", "completed"])
    .order("event_date", { ascending: false })
    .limit(200);

  return (
    <>
      {!migrated && (
        <div
          className="mb-3.5 rounded-[12px] px-4 py-3 text-[12.5px] font-semibold"
          style={{ background: "var(--amS)", color: "var(--am)", border: "1px solid var(--bd)" }}
        >
          Chưa chạy <code>supabase/migrations/vendors.sql</code> — màn này sẽ trống cho tới khi bạn chạy nó
          trong Supabase SQL Editor.
        </div>
      )}
      <VendorsView
        ownerId={profile.id}
        initialVendors={vendors}
        initialOrders={orders}
        contracts={(contracts ?? []) as ContractOption[]}
        readOnly={profile.actingRole === "staff"}
      />
    </>
  );
}
