"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Clock, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, PanelHead, Pill, EmptyState } from "@/components/studio/ui";
import { PRODUCT_STATUS_LABEL, type ProductStatus } from "@/lib/types";
import { fmtDate, todayVN } from "@/lib/date";
import {
  ORDER_STATUS_LABEL, ORDER_STATUS_TONE, dueLabel, lateness, sortByUrgency, type OrderStatus,
} from "@/lib/vendors";

export type ProductRow = {
  id: string;
  name: string;
  qty: number;
  cost: number;
  status: ProductStatus;
  note: string | null;
  assigned_to: string | null;
  contract: { id: string; title: string; client_name: string | null; delivery_due: string | null } | null;
};

type Staff = { id: string; full_name: string | null; email: string };

/** Đơn đặt ngoài đang chạy — hình dữ liệu đúng phần page.tsx đọc lên. */
export type VendorOrderRow = {
  id: string; vendor_name: string | null; contract_id: string | null;
  title: string; amount: number; status: OrderStatus; due_date: string | null;
};

const ORDER: ProductStatus[] = ["ordered", "in_progress", "done"];
/** Màu pill hạng mục sản xuất — cùng bộ màu trạng thái của bản thiết kế. */
const TONE: Record<ProductStatus, { fg: string; bg: string }> = {
  ordered: { fg: "var(--am)", bg: "var(--amS)" },
  in_progress: { fg: "var(--tl)", bg: "var(--tlS)" },
  done: { fg: "var(--gn)", bg: "var(--gnS)" },
};

export default function ProductionView({
  initial, staff, orders = [],
}: {
  initial: ProductRow[];
  staff: Staff[];
  /** Đơn đặt ngoài chưa giao khách (album in, makeup thuê ngoài, xe hoa…). */
  orders?: VendorOrderRow[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProductRow[]>(initial);
  const [filter, setFilter] = useState<ProductStatus | "all">("all");
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

  const visible = useMemo(() => {
    const list = filter === "all" ? rows.filter((r) => r.status !== "done") : rows.filter((r) => r.status === filter);
    return [...list].sort((a, b) => (a.contract?.delivery_due || "9999").localeCompare(b.contract?.delivery_due || "9999"));
  }, [rows, filter]);

  async function setStatus(id: string, status: ProductStatus) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    await supabase.from("contract_products").update({ status }).eq("id", id);
  }
  async function setAssignee(id: string, assigned_to: string | null) {
    setRows((p) => p.map((r) => (r.id === id ? { ...r, assigned_to } : r)));
    await supabase.from("contract_products").update({ assigned_to }).eq("id", id);
  }

  const tabs: { key: ProductStatus | "all"; label: string }[] = [
    { key: "all", label: "Đang xử lý" },
    { key: "ordered", label: PRODUCT_STATUS_LABEL.ordered },
    { key: "in_progress", label: PRODUCT_STATUS_LABEL.in_progress },
    { key: "done", label: PRODUCT_STATUS_LABEL.done },
  ];

  return (
    <div className="page-in flex flex-col gap-3.5">
      <p className="text-[13px]" style={{ color: "var(--tx2)" }}>
        Ảnh, video, in ấn… của mọi hợp đồng — giao việc cho nhân viên và theo dõi tiến độ.
      </p>

      {/* Tiến độ chung */}
      {rows.length > 0 && (
        <Panel className="px-[18px] py-4">
          <div className="mb-2 flex items-center justify-between text-[12.5px]">
            <span style={{ color: "var(--tx2)" }}>Tiến độ chung</span>
            <span className="tnum font-bold">{doneCount}/{rows.length} xong · {pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--ac)" }} />
          </div>
        </Panel>
      )}

      {/* ── Đơn đặt ngoài đang chạy ────────────────────────────────────────
          Tiến độ IN nằm cùng chỗ với tiến độ HẬU KỲ: studio hỏi "album của khách
          A xong chưa" ngay ở màn này, không phải mở thêm một màn khác. Chỉ hiện
          đơn CHƯA giao khách và xếp trễ-hẹn lên đầu (xem @/lib/vendors). */}
      {orders.length > 0 && (
        <Panel>
          <PanelHead icon={Truck} tone="amber" title="Đơn đặt ngoài đang chạy" count={String(orders.length)} />
          <div className="flex flex-col">
            {sortByUrgency(
              orders.map((o) => ({
                id: o.id, vendorId: null, vendorName: o.vendor_name, contractId: o.contract_id,
                title: o.title, amount: o.amount, status: o.status, dueDate: o.due_date, note: null,
              })),
              today
            ).map((o) => {
              const late = lateness(o, today);
              const job = rows.find((r) => r.contract?.id === o.contractId)?.contract;
              return (
                <Link
                  key={o.id}
                  href="/dashboard/studio/vendors"
                  className="flex flex-wrap items-center gap-3 px-[18px] py-[11px]"
                  style={{ borderTop: "1px solid var(--bd2)" }}
                >
                  <span className="min-w-[180px] flex-1">
                    <span className="block text-[13px] font-semibold">{o.title}</span>
                    <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {[o.vendorName, job?.client_name || job?.title].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <span
                    className="tnum flex-none text-[11.5px] font-bold"
                    style={{ color: late.level === "late" ? "var(--rd)" : late.level === "soon" ? "var(--am)" : "var(--tx3)" }}
                  >
                    {dueLabel(o, today)}
                  </span>
                  <Pill tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Pill>
                </Link>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Chưa có hạng mục nào thì bốn tab đều là số 0 — chẳng lọc được gì, chỉ
          đứng chắn giữa lời giới thiệu và ô hướng dẫn bắt đầu. Ẩn đi cho tài
          khoản mới, giống cách màn Đặt lịch làm với bộ lọc của nó. */}
      {rows.length > 0 && (
      <div role="tablist" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-[3px] self-start rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
        {tabs.map((t) => {
          const on = filter === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(t.key)}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
              style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
            >
              {t.label}
              <span className="text-[11px] font-bold opacity-75">
                {t.key === "all" ? (counts.ordered || 0) + (counts.in_progress || 0) : counts[t.key] || 0}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {visible.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Package}
            title="Không có hạng mục nào ở nhóm này"
            hint="Thêm hạng mục sản xuất trong hợp đồng (ảnh, video, in ấn) để theo dõi tiến độ ở đây."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((r) => {
            const overdue = r.status !== "done" && r.contract?.delivery_due && r.contract.delivery_due < today;
            return (
              <Panel key={r.id} className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                    <Package size={15} style={{ color: "var(--tx3)" }} />
                    {r.name}{r.qty > 1 ? ` ×${r.qty}` : ""}
                    <span className="rounded-[20px] px-2.5 py-0.5 text-[10.5px] font-bold" style={{ background: TONE[r.status].bg, color: TONE[r.status].fg }}>
                      {PRODUCT_STATUS_LABEL[r.status]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {r.contract ? (
                      <Link href={`/dashboard/studio/contracts/${r.contract.id}`} className="hover:underline">{r.contract.title}</Link>
                    ) : "—"}
                    {r.contract?.client_name ? ` · ${r.contract.client_name}` : ""}
                    {r.contract?.delivery_due ? (
                      <span style={{ color: overdue ? "var(--rd)" : "var(--tx3)", fontWeight: overdue ? 700 : 400 }}> · <Clock size={11} className="inline" /> giao {fmtDate(r.contract.delivery_due)}{overdue ? " · trễ" : ""}</span>
                    ) : ""}
                    {r.assigned_to ? ` · 👤 ${staffName(r.assigned_to)}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <select
                    className="input w-auto py-1.5 text-xs"
                    value={r.assigned_to ?? ""}
                    onChange={(e) => setAssignee(r.id, e.target.value || null)}
                    title="Giao cho nhân viên"
                  >
                    <option value="">— Chưa giao —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                    ))}
                  </select>
                  <select
                    className="input w-auto py-1.5 text-xs"
                    value={r.status}
                    onChange={(e) => setStatus(r.id, e.target.value as ProductStatus)}
                  >
                    {ORDER.map((s) => (
                      <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
