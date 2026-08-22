import { Shirt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStudio } from "@/lib/auth-guards";
import { getFeatureFlags, rentalComingSoon } from "@/lib/feature-flags";
import type { RentalItem, RentalOrder, RentalOrderItem, RentalOrderWithItems } from "@/lib/types";
import RentalManager from "./RentalManager";
import { applyBranch, getBranchScope } from "@/lib/branches";

export default async function RentalPage() {
  const profile = await requireStudio();
  if (!profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <h1 className="font-serif text-2xl font-medium">Cần gói Studio</h1>
          <a href="/dashboard/upgrade" className="btn-primary mt-5">Xem gói Studio</a>
        </div>
      </div>
    );
  }

  // "Sắp ra mắt": khoá với studio, admin vẫn vào để hoàn thiện.
  if (rentalComingSoon(await getFeatureFlags()) && profile.actingRole !== "admin") {
    return (
      <div className="mx-auto max-w-lg text-center">
        <div className="card p-8">
          <Shirt size={28} className="mx-auto mb-3" style={{ color: "#d0687a" }} />
          <h1 className="font-serif text-2xl font-medium">Phòng váy · Sắp ra mắt</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>Tính năng quản lý kho trang phục & đơn cho thuê đang được hoàn thiện. Bọn mình sẽ thông báo khi sẵn sàng — cảm ơn bạn đã chờ nhé!</p>
        </div>
      </div>
    );
  }


  const supabase = createClient();

  // Kho trang phục nằm ở một cơ sở cụ thể nên lọc được theo chi nhánh. ĐƠN THUÊ
  // thì không: bảng rental_orders chưa có cột chi nhánh, và một đơn có thể lấy đồ
  // ở cơ sở này trả ở cơ sở khác — lọc bừa sẽ làm mất đơn khỏi màn hình.
  const branchSel = (await getBranchScope(profile.id, profile.actingBranchId as string | null, profile.actingRole as string)).selected;
  const [itemsRes, ordersRes] = await Promise.all([
    applyBranch(
      supabase.from("rental_items").select("*").eq("owner_id", profile.id),
      branchSel
    )
      .order("category")
      .order("name"),
    supabase
      .from("rental_orders")
      .select("*")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  const items = (itemsRes.data ?? []) as RentalItem[];
  const orders = (ordersRes.data ?? []) as RentalOrder[];

  // Fetch the line items for the orders we loaded and group them by order.
  let ordersWithItems: RentalOrderWithItems[] = orders.map((o) => ({ ...o, items: [] }));
  if (orders.length > 0) {
    const { data: lineRows } = await supabase
      .from("rental_order_items")
      .select("*")
      .in("order_id", orders.map((o) => o.id));
    const lines = (lineRows ?? []) as RentalOrderItem[];
    const byOrder = new Map<string, RentalOrderItem[]>();
    for (const l of lines) {
      const arr = byOrder.get(l.order_id) ?? [];
      arr.push(l);
      byOrder.set(l.order_id, arr);
    }
    ordersWithItems = orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
  }

  return (
    <RentalManager
      ownerId={profile.id}
      initialItems={items}
      initialOrders={ordersWithItems}
    />
  );
}
