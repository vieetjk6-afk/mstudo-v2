"use client";

import { useState } from "react";
import { FileSpreadsheet, Lock, LockOpen, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { XlsxSheet } from "@/lib/xlsx";
import { vnd } from "@/lib/types";
import { todayVN } from "@/lib/date";
import {
  categoryLabel,
  endOfMonth,
  isLocked,
  periodSummary,
  receivables,
  totalReceivable,
  type MoneyRow,
  type ReceivableInput,
} from "@/lib/accounting";

/* ═══════════════════════════════════════════════════════════════════════════
   XUẤT KẾ TOÁN & KHOÁ SỔ — thẻ trong màn Thu chi & công nợ.

   Hai việc studio có doanh thu thật cần mà app chưa có:

    1. Bản XUẤT theo kỳ đưa kế toán: ba sheet (Thu · Chi · Công nợ) trong MỘT
       file, đúng khoảng ngày studio chọn.
    2. KHOÁ SỔ. Báo cáo tháng trước đã gửi kế toán, rồi ai đó sửa một hợp đồng
       cũ và con số tháng trước đổi — không ai phát hiện, bản đã gửi thành sai.
       Mốc khoá biến "đừng sửa số cũ" từ lời dặn miệng thành hàng rào.

   Số liệu tự truy vấn theo khoảng ngày người dùng chọn, không dùng lại state
   của màn Thu chi: màn đó xoay quanh THÁNG/NĂM, còn kế toán hỏi theo kỳ tuỳ ý
   (quý, nửa năm, từ ngày ký tới hôm nay).
   ═══════════════════════════════════════════════════════════════════════════ */

const firstOfMonth = () => `${todayVN().slice(0, 7)}-01`;

export default function AccountingExportCard({
  ownerId,
  initialClosedUntil,
  canClose,
}: {
  ownerId: string;
  /** Mốc khoá sổ hiện tại ('YYYY-MM-DD') hoặc null. */
  initialClosedUntil: string | null;
  /** Chỉ chủ studio / kế toán mới được khoá & mở khoá. */
  canClose: boolean;
}) {
  const supabase = createClient();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayVN());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [closedUntil, setClosedUntil] = useState(initialClosedUntil);
  const [closing, setClosing] = useState(false);

  /** Nạp đúng ba khối số liệu của kỳ. */
  async function loadPeriod() {
    const [{ data: pay }, { data: exp }, { data: con }] = await Promise.all([
      supabase
        .from("contract_payments")
        .select("amount, kind, paid_at, note, contract:studio_contracts!inner(owner_id, code, title, client_name)")
        .eq("contract.owner_id", ownerId)
        .gte("paid_at", from)
        .lte("paid_at", to),
      supabase
        .from("studio_expenses")
        .select("title, amount, category, spent_at")
        .eq("owner_id", ownerId)
        .gte("spent_at", from)
        .lte("spent_at", to),
      supabase
        .from("studio_contracts")
        .select("id, code, title, client_name, event_date, status, contract_items(qty, unit_price), contract_payments(amount)")
        .eq("owner_id", ownerId)
        .limit(1000),
    ]);

    type PayRow = {
      amount: number; kind: string; paid_at: string; note: string | null;
      contract: { code: string | null; title: string; client_name: string | null } | null;
    };
    const income: MoneyRow[] = ((pay ?? []) as unknown as PayRow[]).map((p) => ({
      date: p.paid_at,
      amount: p.amount,
      label: p.note || p.kind,
      contractCode: p.contract?.code ?? null,
      contractTitle: p.contract?.title ?? null,
      clientName: p.contract?.client_name ?? null,
    }));
    const expense: MoneyRow[] = ((exp ?? []) as { title: string; amount: number; category: string | null; spent_at: string }[]).map((e) => ({
      date: e.spent_at,
      amount: e.amount,
      label: e.title,
      category: e.category,
    }));

    type ConRow = {
      id: string; code: string | null; title: string; client_name: string | null;
      event_date: string | null; status: string;
      contract_items: { qty: number; unit_price: number }[];
      contract_payments: { amount: number }[];
    };
    const rows: ReceivableInput[] = ((con ?? []) as unknown as ConRow[]).map((c) => ({
      contractId: c.id,
      code: c.code,
      title: c.title,
      clientName: c.client_name,
      eventDate: c.event_date,
      status: c.status,
      total: (c.contract_items ?? []).reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0),
      paid: (c.contract_payments ?? []).reduce((s, p) => s + (p.amount || 0), 0),
    }));

    return { income, expense, debts: receivables(rows) };
  }

  async function exportXlsx() {
    setBusy(true);
    setMsg(null);
    try {
      const { income, expense, debts } = await loadPeriod();
      const sum = periodSummary(income, expense, from, to);
      // Dùng đúng bộ style đã khai ở @/lib/xlsx (chuỗi có tên), không tự chế
      // đối tượng style — bộ ghi chỉ hiểu các tên đó.
      const head = (cells: string[]) => cells.map((v) => ({ v, s: "head" as const }));
      const kyLabel = `${from.split("-").reverse().join("/")} – ${to.split("-").reverse().join("/")}`;

      const sheets: XlsxSheet[] = [
        {
          name: "Thu",
          cols: [12, 14, 26, 20, 30],
          freezeRows: 2,
          rows: [
            [{ v: `SỔ THU · ${kyLabel}`, s: "title" as const }],
            head(["Ngày", "Số tiền", "Hợp đồng", "Khách hàng", "Nội dung"]),
            ...income
              .filter((r) => r.date >= from && r.date <= to)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((r) => [r.date, { v: r.amount, s: "moneyIn" as const }, r.contractCode || r.contractTitle || "", r.clientName || "", r.label]),
            [{ v: "TỔNG THU", s: "totalLabel" as const }, { v: sum.income, s: "totalMoney" as const }],
          ],
        },
        {
          name: "Chi",
          cols: [12, 14, 20, 34],
          freezeRows: 2,
          rows: [
            [{ v: `SỔ CHI · ${kyLabel}`, s: "title" as const }],
            head(["Ngày", "Số tiền", "Nhóm", "Nội dung"]),
            ...expense
              .filter((r) => r.date >= from && r.date <= to)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((r) => [r.date, { v: r.amount, s: "moneyOut" as const }, categoryLabel(r.category), r.label]),
            [{ v: "TỔNG CHI", s: "totalLabel" as const }, { v: sum.expense, s: "totalMoney" as const }],
            [],
            [{ v: "Theo nhóm", s: "section" as const }],
            ...sum.byCategory.map((c) => ["", { v: c.amount, s: "money" as const }, c.category, `${c.count} khoản`]),
          ],
        },
        {
          name: "Công nợ",
          cols: [14, 26, 20, 14, 14, 14],
          freezeRows: 2,
          rows: [
            // Công nợ là số liệu tại THỜI ĐIỂM XUẤT, không theo kỳ — nói rõ trên
            // giấy, nếu không kế toán sẽ đọc nó như một con số của kỳ.
            [{ v: `CÔNG NỢ tại ngày ${todayVN().split("-").reverse().join("/")} (không theo kỳ)`, s: "title" as const }],
            head(["Mã HĐ", "Hợp đồng", "Khách hàng", "Giá trị", "Đã thu", "Còn lại"]),
            ...debts.map((d) => [d.code || "", d.title, d.clientName || "", { v: d.total, s: "money" as const }, { v: d.paid, s: "money" as const }, { v: d.remaining, s: "moneyOut" as const }]),
            [{ v: "TỔNG CÒN PHẢI THU", s: "totalLabel" as const }, "", "", "", "", { v: totalReceivable(debts), s: "totalMoney" as const }],
          ],
        },
      ];

      // Nạp trễ: @/lib/xlsx kéo theo JSZip (~95 KB) để dựng OOXML. Nhập tĩnh
      // thì cả gói đó nằm trong bundle của trang Báo cáo dù người dùng chưa bấm
      // "Xuất Excel" lần nào. Ở đây mới là lúc thực sự cần tới nó.
      const { downloadXlsx } = await import("@/lib/xlsx");
      await downloadXlsx(sheets, `so-ke-toan-${from}-${to}.xlsx`);
      setMsg(`Đã xuất: thu ${vnd(sum.income)} · chi ${vnd(sum.expense)} · lãi ${vnd(sum.profit)}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Không xuất được file.");
    }
    setBusy(false);
  }

  async function closeBooks(until: string | null) {
    setClosing(true);
    setMsg(null);
    const { error } = await supabase.from("profiles").update({ books_closed_until: until }).eq("id", ownerId);
    setClosing(false);
    if (error) {
      const missing = error.code === "42703" || error.code === "PGRST204";
      return setMsg(
        missing ? "Cần chạy supabase/migrations/accounting.sql trước khi khoá sổ." : error.message
      );
    }
    setClosedUntil(until);
    setMsg(until ? `Đã khoá sổ tới ${until.split("-").reverse().join("/")}.` : "Đã mở khoá sổ.");
  }

  const suggestClose = endOfMonth(todayVN().slice(0, 7));
  /** Kỳ đang chọn có nằm trong vùng đã khoá không — để cảnh báo trước khi xuất. */
  const periodLocked = isLocked(to, closedUntil);

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
        <FileSpreadsheet size={18} style={{ color: "var(--ac, var(--gold))" }} /> Xuất kế toán & khoá sổ
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text3)" }}>
        Một file Excel ba sheet: <b>Thu</b> · <b>Chi</b> · <b>Công nợ</b>, đúng khoảng ngày bạn chọn.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold" style={{ color: "var(--text2)" }}>Từ ngày</span>
          <input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold" style={{ color: "var(--text2)" }}>Đến ngày</span>
          <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={exportXlsx} disabled={busy || from > to} className="btn-primary">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          {busy ? "Đang xuất…" : "Xuất Excel"}
        </button>
      </div>

      {/* ── Khoá sổ ──────────────────────────────────────────────────────── */}
      <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold">
          {closedUntil ? <Lock size={14} style={{ color: "var(--warn, var(--gold))" }} /> : <LockOpen size={14} style={{ color: "var(--text3)" }} />}
          {closedUntil
            ? `Sổ đã khoá tới ${closedUntil.split("-").reverse().join("/")}`
            : "Chưa khoá kỳ nào"}
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--text3)" }}>
          Khoá sổ để số liệu của kỳ đã gửi kế toán không đổi khi ai đó sửa một hợp đồng cũ. Khoá sổ{" "}
          <b>không xoá gì</b> — chỉ đánh mốc và cảnh báo khi có người định sửa số trước mốc đó.
        </p>
        {canClose && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {suggestClose && (
              <button onClick={() => closeBooks(suggestClose)} disabled={closing} className="btn-ghost text-[12.5px]">
                <Lock size={14} /> Khoá tới hết tháng này
              </button>
            )}
            <button onClick={() => closeBooks(to)} disabled={closing} className="btn-ghost text-[12.5px]">
              <Lock size={14} /> Khoá tới {to.split("-").reverse().join("/")}
            </button>
            {closedUntil && (
              <button onClick={() => closeBooks(null)} disabled={closing} className="btn-ghost text-[12.5px]">
                <LockOpen size={14} /> Mở khoá
              </button>
            )}
          </div>
        )}
        {periodLocked && (
          <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--warn, var(--gold))" }}>
            Kỳ đang chọn nằm trong vùng đã khoá — số liệu ở đây được coi là đã chốt.
          </p>
        )}
      </div>

      {msg && (
        <p className="mt-3 flex items-start gap-1.5 text-[12px]" style={{ color: "var(--text2)" }}>
          <Check size={14} style={{ flex: "none", marginTop: 1 }} /> {msg}
        </p>
      )}
    </div>
  );
}
