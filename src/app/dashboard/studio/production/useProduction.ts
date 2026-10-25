"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProductStatus } from "@/lib/types";
import { todayVN } from "@/lib/date";
import type { VendorOrder } from "@/lib/vendors";
import type { ProductRow, VendorOrderRow } from "./ProductionView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Xử lý hình ảnh (bản cũ ProductionView và bản
   mới ProductionV2): danh sách hạng mục, đổi trạng thái, giao người làm, số
   đếm. Hai bản chỉ khác nhau ở cách vẽ — mọi câu ghi Supabase nằm ở đây.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ProductionStaff = { id: string; full_name: string | null; email: string };

/** Thứ tự các bước của một hạng mục: đã đặt → đang làm → đã giao. */
export const PRODUCT_ORDER: ProductStatus[] = ["ordered", "in_progress", "done"];

/** Đơn đặt ngoài (dạng page.tsx đọc lên) → dạng luật thuần của @/lib/vendors. */
export const toVendorOrder = (o: VendorOrderRow): VendorOrder => ({
  id: o.id,
  vendorId: null,
  vendorName: o.vendor_name,
  contractId: o.contract_id,
  title: o.title,
  amount: o.amount,
  status: o.status,
  dueDate: o.due_date,
  note: null,
});

export function useProduction(initial: ProductRow[], staff: ProductionStaff[]) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProductRow[]>(initial);
  const today = todayVN();

  const staffName = (id: string | null) => {
    if (!id) return "";
    const s = staff.find((x) => x.id === id);
    return s ? s.full_name || s.email : "";
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, ordered: 0, in_progress: 0, done: 0 };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);
  const doneCount = counts.done || 0;
  const pct = rows.length ? Math.round((doneCount / rows.length) * 100) : 0;

  async function setStatus(id: string, status: ProductStatus) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("contract_products").update({ status }).eq("id", id);
  }
  async function setAssignee(id: string, assigned_to: string | null) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, assigned_to } : r)));
    await supabase.from("contract_products").update({ assigned_to }).eq("id", id);
  }

  return { rows, today, staffName, counts, doneCount, pct, setStatus, setAssignee };
}
