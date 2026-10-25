"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/studio/Toast";
import { todayVN } from "@/lib/date";
import {
  expenseFor, isClosed, nextStatus, sortByUrgency, summarize, type OrderStatus, type VendorOrder,
} from "@/lib/vendors";
import type { ContractOption, OrderRow, VendorRow } from "./VendorsView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Nhà cung cấp & đơn đặt ngoài (bản cũ
   VendorsView và bản mới VendorsV2): danh sách, bản nháp đang sửa, MỌI câu ghi
   Supabase (lưu đơn + đúng một dòng chi, chuyển bước, xoá, lưu nhà cung cấp) và
   thông báo. Hai bản chỉ khác nhau ở cách vẽ.

   Tiền: mỗi đơn sinh ĐÚNG MỘT dòng trong sổ chi, gắn bằng `vendor_order_id` và
   ghi bằng upsert — xem `expenseFor` và migration vendors.sql. Không có chỗ nào
   trong màn này ghi dòng chi thứ hai.
   ═══════════════════════════════════════════════════════════════════════════ */

export type OrderDraft = {
  id: string | null; vendor_id: string; contract_id: string; title: string;
  amount: number; status: OrderStatus; due_date: string; note: string;
};

export const emptyOrder = (): OrderDraft => ({
  id: null, vendor_id: "", contract_id: "", title: "", amount: 0, status: "sent", due_date: "", note: "",
});

export const emptyVendor = (): VendorRow =>
  ({ id: "", name: "", kind: "album", phone: "", contact: "", note: "", active: true }) as VendorRow;

/** Đơn đang hiện → bản nháp để sửa. */
export const draftOf = (o: VendorOrder): OrderDraft => ({
  id: o.id, vendor_id: o.vendorId ?? "", contract_id: o.contractId ?? "", title: o.title,
  amount: o.amount, status: o.status, due_date: o.dueDate ?? "", note: o.note ?? "",
});

export function useVendors({
  ownerId, initialVendors, initialOrders, contracts,
}: {
  ownerId: string;
  initialVendors: VendorRow[];
  initialOrders: OrderRow[];
  contracts: ContractOption[];
}) {
  const supabase = createClient();
  const { toast, toastNode } = useToast();
  const today = todayVN();

  const [vendors, setVendors] = useState(initialVendors);
  const [orders, setOrders] = useState(initialOrders);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [vDraft, setVDraft] = useState<VendorRow | null>(null);
  const [busy, setBusy] = useState(false);
  /** Ẩn đơn đã giao khách — mặc định ẩn, vì màn này để theo dõi việc CHƯA xong. */
  const [showDone, setShowDone] = useState(false);

  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? null;

  const model = useMemo<VendorOrder[]>(
    () =>
      orders.map((o) => ({
        id: o.id,
        vendorId: o.vendor_id,
        vendorName: o.vendor_name ?? vendorName(o.vendor_id),
        contractId: o.contract_id,
        title: o.title,
        amount: o.amount,
        status: o.status,
        dueDate: o.due_date,
        note: o.note,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, vendors]
  );

  const sum = useMemo(() => summarize(model, today), [model, today]);
  const shown = useMemo(
    () => sortByUrgency(showDone ? model : model.filter((o) => !isClosed(o.status)), today),
    [model, showDone, today]
  );
  const contractLabel = (id: string | null) => {
    const c = contracts.find((x) => x.id === id);
    return c ? `${c.code ? `${c.code} · ` : ""}${c.client_name || c.title}` : null;
  };

  /* ── Ghi đơn + dòng chi ────────────────────────────────────────────────── */

  async function saveOrder() {
    if (!draft) return;
    if (!draft.title.trim()) return toast("Chưa có nội dung đơn.");
    setBusy(true);
    const payload = {
      owner_id: ownerId,
      vendor_id: draft.vendor_id || null,
      vendor_name: vendorName(draft.vendor_id || null),
      contract_id: draft.contract_id || null,
      title: draft.title.trim(),
      amount: Math.max(0, Math.round(draft.amount) || 0),
      status: draft.status,
      due_date: draft.due_date || null,
      note: draft.note.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = draft.id
      ? await supabase.from("vendor_orders").update(payload).eq("id", draft.id).select("*").maybeSingle()
      : await supabase.from("vendor_orders").insert(payload).select("*").maybeSingle();
    if (res.error || !res.data) {
      setBusy(false);
      const missing = res.error?.code === "42P01" || res.error?.code === "PGRST205";
      return toast(missing ? "Cần chạy supabase/migrations/vendors.sql trước." : res.error?.message ?? "Không lưu được.");
    }
    const row = res.data as OrderRow;

    // MỘT dòng chi cho MỘT đơn. upsert theo `vendor_order_id` (cột unique) — sửa
    // giá đơn ba lần vẫn chỉ một dòng chi, không phải ba.
    const e = expenseFor(
      { ...row, vendorId: row.vendor_id, vendorName: row.vendor_name, contractId: row.contract_id, dueDate: row.due_date },
      today
    );
    const { error: expErr } = await supabase
      .from("studio_expenses")
      .upsert({ owner_id: ownerId, vendor_order_id: row.id, contract_id: row.contract_id, ...e }, { onConflict: "vendor_order_id" });
    if (expErr) toast(`Đã lưu đơn, nhưng chưa ghi được vào sổ chi: ${expErr.message}`);

    setOrders((p) => (draft.id ? p.map((x) => (x.id === row.id ? row : x)) : [row, ...p]));
    setDraft(null);
    setBusy(false);
  }

  async function advance(o: VendorOrder) {
    const next = nextStatus(o.status);
    if (!next) return;
    setBusy(true);
    const { error } = await supabase
      .from("vendor_orders")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    setBusy(false);
    if (error) return toast(error.message);
    setOrders((p) => p.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
  }

  async function removeOrder(id: string) {
    setBusy(true);
    // Dòng chi đi theo nhờ `on delete cascade` ở migration — tiền của một đơn
    // không còn tồn tại thì cũng không được nằm lại trong báo cáo.
    const { error } = await supabase.from("vendor_orders").delete().eq("id", id);
    setBusy(false);
    if (error) return toast(error.message);
    setOrders((p) => p.filter((x) => x.id !== id));
    setDraft(null);
  }

  async function saveVendor() {
    if (!vDraft) return;
    if (!vDraft.name.trim()) return toast("Chưa có tên nhà cung cấp.");
    setBusy(true);
    const payload = {
      owner_id: ownerId, name: vDraft.name.trim(), kind: vDraft.kind,
      phone: vDraft.phone?.trim() || null, contact: vDraft.contact?.trim() || null,
      note: vDraft.note?.trim() || null, active: vDraft.active,
    };
    const res = vDraft.id
      ? await supabase.from("studio_vendors").update(payload).eq("id", vDraft.id).select("*").maybeSingle()
      : await supabase.from("studio_vendors").insert(payload).select("*").maybeSingle();
    setBusy(false);
    if (res.error || !res.data) {
      const missing = res.error?.code === "42P01" || res.error?.code === "PGRST205";
      return toast(missing ? "Cần chạy supabase/migrations/vendors.sql trước." : res.error?.message ?? "Không lưu được.");
    }
    const row = res.data as VendorRow;
    setVendors((p) => (vDraft.id ? p.map((x) => (x.id === row.id ? row : x)) : [...p, row]));
    setVDraft(null);
  }

  return {
    today, toast, toastNode, vendors, orders, draft, setDraft, vDraft, setVDraft, busy, showDone, setShowDone,
    vendorName, model, sum, shown, contractLabel, saveOrder, advance, removeOrder, saveVendor,
  };
}
