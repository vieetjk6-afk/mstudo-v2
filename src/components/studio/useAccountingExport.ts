"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { XlsxSheet } from "@/lib/xlsx";
import { vnd, paymentMethodLabel } from "@/lib/types";
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

/* Trạng thái + thao tác của thẻ "Xuất kế toán & khoá sổ" — dùng chung cho bản
   cũ (AccountingExportCard) và bản giao diện mới (AccountingExportCardV2).
   Xem ghi chú đầu AccountingExportCard.tsx về lý do tự truy vấn theo kỳ. */

const firstOfMonth = () => `${todayVN().slice(0, 7)}-01`;

export function useAccountingExport(ownerId: string, initialClosedUntil: string | null) {
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
        .select("amount, kind, method, paid_at, note, contract:studio_contracts!inner(owner_id, code, title, client_name)")
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
      amount: number; kind: string; method: string | null; paid_at: string; note: string | null;
      contract: { code: string | null; title: string; client_name: string | null } | null;
    };
    const income: MoneyRow[] = ((pay ?? []) as unknown as PayRow[]).map((p) => ({
      date: p.paid_at,
      amount: p.amount,
      // Kế toán cần tách tiền mặt khỏi chuyển khoản khi đối chiếu quỹ / sao kê.
      label: [p.note || p.kind, paymentMethodLabel(p.method)].filter(Boolean).join(" · "),
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

  return { from, setFrom, to, setTo, busy, msg, closedUntil, closing, exportXlsx, closeBooks, suggestClose, periodLocked };
}

export type AccountingExportState = ReturnType<typeof useAccountingExport>;
