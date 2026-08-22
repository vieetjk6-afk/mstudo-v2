"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wand2, PlayCircle, Send, Eye, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Panel, ProgressBar } from "@/components/studio/ui";
import { fmtDayMonth } from "@/lib/date";
import { PRODUCT_STATUS_LABEL, type ProductStatus } from "@/lib/types";
import type { TaskRow } from "./StaffPortal";

/* ═══════════════════════════════════════════════════════════════════════════
   TAB "ẢNH CẦN SỬA" — hàng đợi hậu kỳ của người đang đăng nhập.

   Đọc CÙNG bảng với màn "Xử lý hình ảnh" của khu quản lý (contract_products), nên
   nhân viên bấm "Nhận việc" ở đây thì chủ studio thấy đổi trạng thái ở kia ngay.

   Bản thiết kế vẽ 4 trạng thái (Chờ nhận / Đang sửa / Chờ duyệt / Đã giao) và cột
   "62/80 ảnh". Bảng contract_products của repo có BA trạng thái (ordered /
   in_progress / done) và không đếm ảnh — nên máy trạng thái ở đây là ba bước, và
   thanh tiến độ vẽ theo bước thay vì theo số ảnh. Thêm "Chờ duyệt" lúc này sẽ là
   một cột không ai ghi vào, và cột đếm ảnh sẽ là số bịa.
   ═══════════════════════════════════════════════════════════════════════════ */

const FLOW: Record<ProductStatus, { next: ProductStatus | null; btn: string; Icon: typeof Send; toast: string }> = {
  ordered: { next: "in_progress", btn: "Nhận việc", Icon: PlayCircle, toast: "Đã nhận việc" },
  in_progress: { next: "done", btn: "Bàn giao", Icon: Send, toast: "Đã bàn giao" },
  done: { next: null, btn: "Xem lại", Icon: Eye, toast: "Đã giao trước đó" },
};

const TONE: Record<ProductStatus, { fg: string; soft: string; pct: number }> = {
  ordered: { fg: "var(--tx3)", soft: "var(--sf2)", pct: 5 },
  in_progress: { fg: "var(--bl)", soft: "var(--blS)", pct: 55 },
  done: { fg: "var(--gn)", soft: "var(--gnS)", pct: 100 },
};

type Filter = "all" | ProductStatus;

export default function TaskQueue({ rows, today, toast }: { rows: TaskRow[]; today: string; toast: (m: string) => void }) {
  const supabase = createClient();
  const [items, setItems] = useState(rows);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length, ordered: 0, in_progress: 0, done: 0 };
    for (const r of items) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [items]);

  const overdue = useMemo(
    () => items.filter((r) => r.status !== "done" && !!r.contract?.delivery_due && r.contract.delivery_due < today),
    [items, today]
  );

  const visible = useMemo(() => {
    const list = filter === "all" ? items : items.filter((r) => r.status === filter);
    // Hạn gần nhất lên đầu; việc chưa có hạn xuống cuối.
    return [...list].sort((a, b) => (a.contract?.delivery_due || "9999-99-99").localeCompare(b.contract?.delivery_due || "9999-99-99"));
  }, [items, filter]);

  async function push(r: TaskRow) {
    const flow = FLOW[r.status];
    if (!flow.next) {
      toast(`${flow.toast} · ${r.contract?.code ?? r.name}`);
      return;
    }
    const next = flow.next;
    setItems((p) => p.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    const { error } = await supabase.from("contract_products").update({ status: next }).eq("id", r.id);
    if (error) {
      setItems((p) => p.map((x) => (x.id === r.id ? r : x)));
      toast("Không cập nhật được — thử lại.");
      return;
    }
    toast(`${flow.toast} · ${r.contract?.code ?? r.name}`);
  }

  const CHIPS: { key: Filter; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "ordered", label: PRODUCT_STATUS_LABEL.ordered },
    { key: "in_progress", label: PRODUCT_STATUS_LABEL.in_progress },
    { key: "done", label: PRODUCT_STATUS_LABEL.done },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* ── Bộ lọc ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {CHIPS.map((c) => {
          const on = filter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className="flex flex-none items-center gap-1.5 rounded-[20px] px-3 py-[7px] text-[12px]"
              style={
                on
                  ? { background: "var(--acS)", border: "1px solid var(--acM)", color: "var(--ac)", fontWeight: 700 }
                  : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx3)", fontWeight: 550 }
              }
              aria-pressed={on}
            >
              {c.label} <span className="tnum">({counts[c.key] ?? 0})</span>
            </button>
          );
        })}
        {overdue.length > 0 && (
          <span
            className="ml-auto flex flex-none items-center gap-1.5 rounded-[20px] px-3 py-[7px] text-[12px] font-bold"
            style={{ background: "var(--rdS)", color: "var(--rd)" }}
          >
            <AlertCircle size={14} /> {overdue.length} việc trễ hạn
          </span>
        )}
      </div>

      {/* ── Bảng ────────────────────────────────────────────────────────── */}
      <Panel className="overflow-hidden">
        {/* Header chỉ hiện từ 900px — dưới đó mỗi hàng tự xếp thành thẻ dọc. */}
        <div
          className="hidden gap-3.5 px-[18px] py-2.5 min-[900px]:grid"
          style={{
            gridTemplateColumns: "minmax(200px,2.2fr) minmax(110px,1fr) minmax(90px,.8fr) minmax(110px,.9fr) minmax(120px,auto)",
            background: "var(--sf2)",
            borderBottom: "1px solid var(--bd2)",
          }}
        >
          {["Hạng mục", "Hạn giao", "Số lượng", "Trạng thái", ""].map((h, i) => (
            <span key={i} className="text-[11px] font-bold uppercase" style={{ letterSpacing: ".4px", color: "var(--tx3)" }}>{h}</span>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--gnS)" }}>
              <CheckCircle2 size={24} style={{ color: "var(--gn)" }} />
            </span>
            <p className="mt-2.5 text-[14.5px] font-bold">Không còn việc nào ở nhóm này</p>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Chọn nhóm khác, hoặc chờ studio giao việc mới.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {visible.map((r) => {
              const tone = TONE[r.status];
              const flow = FLOW[r.status];
              const due = r.contract?.delivery_due ?? null;
              const late = r.status !== "done" && !!due && due < today;
              return (
                <div
                  key={r.id}
                  className="grid gap-x-3.5 gap-y-2 px-[18px] py-3.5 min-[900px]:grid-cols-[minmax(200px,2.2fr)_minmax(110px,1fr)_minmax(90px,.8fr)_minmax(110px,.9fr)_minmax(120px,auto)] min-[900px]:items-center"
                  style={{ borderTop: "1px solid var(--bd2)" }}
                >
                  {/* Cột 1 — hạng mục + hợp đồng + khách */}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold" style={{ fontFamily: "ui-monospace, monospace", color: "var(--tx3)" }}>
                      {r.contract?.code || "—"}
                    </p>
                    <p className="mt-0.5 text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{r.name}</p>
                    <p className="truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      {r.contract?.client_name || r.contract?.title || "—"}
                    </p>
                  </div>

                  {/* Cột 2 — hạn giao */}
                  <div className="min-w-0">
                    <p className="tnum text-[12.5px] font-semibold" style={{ color: late ? "var(--rd)" : "var(--tx)" }}>
                      {due ? `${late ? "Trễ " : ""}${fmtDayMonth(due)}` : "Chưa đặt hạn"}
                    </p>
                    <p className="text-[11px] min-[900px]:hidden" style={{ color: "var(--tx3)" }}>Hạn giao</p>
                  </div>

                  {/* Cột 3 — số lượng + thanh tiến độ theo bước */}
                  <div className="min-w-0">
                    <p className="tnum text-[12.5px] font-semibold">{r.qty} cái</p>
                    <ProgressBar pct={tone.pct} color={tone.fg} className="mt-1.5" />
                  </div>

                  {/* Cột 4 — trạng thái */}
                  <div className="min-w-0">
                    <span
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-[11px] py-[5px] text-[11.5px] font-semibold"
                      style={{ background: tone.soft, color: tone.fg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
                      {PRODUCT_STATUS_LABEL[r.status]}
                    </span>
                  </div>

                  {/* Cột 5 — hành động */}
                  <div className="flex flex-wrap items-center gap-2 min-[900px]:justify-end">
                    <button
                      onClick={() => push(r)}
                      className="flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-[7px] text-[12px] font-bold"
                      style={
                        flow.next
                          ? { background: "var(--ac)", color: "#fff" }
                          : { background: "var(--sf)", border: "1px solid var(--bd)", color: "var(--tx2)" }
                      }
                    >
                      <flow.Icon size={14} /> {flow.btn}
                    </button>
                    {r.contract?.id && (
                      <Link
                        href={`/dashboard/studio/contracts/${r.contract.id}`}
                        className="flex-none rounded-[9px] px-3 py-[7px] text-[12px] font-semibold"
                        style={{ border: "1px solid var(--bd)", color: "var(--tx2)" }}
                      >
                        Chi tiết
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
        <Wand2 size={14} /> Cùng danh sách với màn “Xử lý hình ảnh” của khu quản lý — đổi ở đây là đổi ở đó.
      </p>
    </div>
  );
}
