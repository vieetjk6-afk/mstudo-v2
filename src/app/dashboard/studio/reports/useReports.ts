"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORY_LABEL, PAYMENT_KIND_LABEL, paymentMethodLabel, type StudioExpense } from "@/lib/types";
import { todayVN } from "@/lib/date";
import { blocksWrite, blockedWriteMessage } from "@/lib/accounting";
import { exportFinance, downloadCsv, financeCsvRows, type ExportStudio, type FinanceExport, type MoneyRow } from "@/lib/studio-export";
import type { PaymentRow, SalaryRow, SourceStat } from "./ReportsView";

/* ═══════════════════════════════════════════════════════════════════════════
   Phần LOGIC dùng chung của màn Thu chi (bản cũ ReportsView và bản mới
   ReportsV2): kỳ đang xem, lọc theo kỳ, tổng thu/chi, chuỗi 12 tháng, xuất
   file, thêm/xoá khoản chi, lưu mục tiêu. Hai bản chỉ khác nhau ở cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

export type ReportsInput = {
  ownerId: string;
  studio: ExportStudio;
  payments: PaymentRow[];
  salaries: SalaryRow[];
  initialExpenses: StudioExpense[];
  initialTarget: number;
  sourceStats: SourceStat[];
  closedUntil?: string | null;
};

export const emptyExpense = () => ({ title: "", amount: 0, category: "equipment", spent_at: todayVN(), note: "" });

export function useReports({ ownerId, studio, payments, salaries, initialExpenses, initialTarget, sourceStats, closedUntil = null }: ReportsInput) {
  const supabase = createClient();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [expenses, setExpenses] = useState<StudioExpense[]>(initialExpenses);
  const [target, setTarget] = useState(initialTarget);
  // Tổng kết theo THÁNG hay theo NĂM. Mọi con số trên trang (4 thẻ, hai danh
  // sách, file xuất ra) đều đọc từ một tiền tố ngày duy nhất bên dưới, nên
  // chuyển nút là cả trang đổi theo — không có chỗ nào còn tính riêng.
  const [period, setPeriod] = useState<"month" | "year">("month");

  const [exp, setExp] = useState(emptyExpense);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const mm = String(cursor.month + 1).padStart(2, "0");
  // Ngày trong DB là "YYYY-MM-DD" nên so tiền tố chuỗi là đủ: "2026" lọc cả
  // năm, "2026-08" lọc một tháng.
  const ym = period === "year" ? `${cursor.year}` : `${cursor.year}-${mm}`;
  const periodLabel = period === "year" ? `Năm ${cursor.year}` : `${MONTHS[cursor.month]} ${cursor.year}`;
  const periodWord = period === "year" ? "năm" : "tháng";

  const monthPayments = useMemo(() => payments.filter((p) => (p.paid_at || "").startsWith(ym)), [payments, ym]);
  const monthSalaries = useMemo(() => salaries.filter((s) => (s.paid_at || "").startsWith(ym)), [salaries, ym]);
  const monthExpenses = useMemo(() => expenses.filter((e) => (e.spent_at || "").startsWith(ym)), [expenses, ym]);

  const income = monthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const salaryOut = monthSalaries.reduce((s, p) => s + (p.salary || 0), 0);
  const otherOut = monthExpenses.reduce((s, p) => s + (p.amount || 0), 0);
  const profit = income - salaryOut - otherOut;
  // Mục tiêu được ĐẶT THEO THÁNG. Khi tổng kết cả năm phải nhân 12, nếu không
  // doanh thu 12 tháng đem so mục tiêu 1 tháng là lúc nào cũng "vượt mục tiêu".
  const periodTarget = period === "year" ? target * 12 : target;
  const targetPct = periodTarget > 0 ? Math.min(100, Math.round((income / periodTarget) * 100)) : 0;
  const margin = income > 0 ? Math.round((profit / income) * 100) : null;

  // Tiền mặt tách riêng: số studio phải thấy trong két. Chuyển khoản thì ngân
  // hàng đã giữ sổ hộ; lần thu cũ chưa ghi phương thức xếp vào "chưa rõ".
  const cashIn = monthPayments.filter((p) => p.method === "cash").reduce((s2, p) => s2 + (p.amount || 0), 0);
  const transferIn = monthPayments.filter((p) => p.method === "transfer").reduce((s2, p) => s2 + (p.amount || 0), 0);
  const unknownIn = income - cashIn - transferIn;

  /** Lưu mục tiêu doanh thu THÁNG. */
  async function saveTarget(input: number) {
    const v = Math.max(0, Math.round(Number(input) || 0));
    await supabase.from("profiles").update({ monthly_revenue_target: v }).eq("id", ownerId);
    setTarget(v);
  }

  // Chuỗi 12 tháng cho biểu đồ: xem theo NĂM thì đúng 12 tháng của năm đó, xem
  // theo THÁNG thì 12 tháng tính ngược từ tháng đang xem (không phải từ tháng
  // hiện tại — lùi về tháng 3 mà biểu đồ vẫn dừng ở hôm nay là đọc sai kỳ).
  const series = useMemo(() => {
    const out: { ym: string; label: string; income: number; expense: number; profit: number }[] = [];
    const months =
      period === "year"
        ? Array.from({ length: 12 }, (_, m) => new Date(cursor.year, m, 1))
        : Array.from({ length: 12 }, (_, i) => new Date(cursor.year, cursor.month - 11 + i, 1));
    for (const d of months) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inc = payments.filter((p) => (p.paid_at || "").startsWith(key)).reduce((s, p) => s + (p.amount || 0), 0);
      const ex =
        salaries.filter((s2) => (s2.paid_at || "").startsWith(key)).reduce((s, p) => s + (p.salary || 0), 0) +
        expenses.filter((e) => (e.spent_at || "").startsWith(key)).reduce((s, p) => s + (p.amount || 0), 0);
      out.push({ ym: key, label: `T${d.getMonth() + 1}`, income: inc, expense: ex, profit: inc - ex });
    }
    return out;
  }, [payments, salaries, expenses, cursor, period]);
  const chartMax = Math.max(1, ...series.map((s) => Math.max(s.income, s.expense)));
  const seriesTitle = period === "year" ? `Thu · chi 12 tháng năm ${cursor.year}` : "Thu · chi 12 tháng gần nhất";

  /** Dữ liệu chung cho cả bản Excel lẫn bản CSV — hai file luôn khớp nhau. */
  function financeData(): FinanceExport {
    const income: MoneyRow[] = monthPayments
      .map((p) => ({
        date: p.paid_at,
        kind: [PAYMENT_KIND_LABEL[p.kind], paymentMethodLabel(p.method)].filter(Boolean).join(" · "),
        title: `${PAYMENT_KIND_LABEL[p.kind]} · ${p.contract?.title || "Hợp đồng"}`,
        ref: p.contract?.title || "",
        amount: p.amount || 0,
      }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const outflow: MoneyRow[] = [
      ...monthSalaries.map((s) => ({
        date: s.paid_at || "",
        kind: "Tiền công",
        title: s.name,
        ref: s.contract?.title || "Không gắn hợp đồng",
        amount: s.salary || 0,
      })),
      ...monthExpenses.map((e) => ({
        date: e.spent_at,
        kind: "Chi phí khác",
        title: e.title,
        ref: EXPENSE_CATEGORY_LABEL[e.category || "other"] || e.category || "Khác",
        amount: e.amount || 0,
      })),
    ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

    return {
      periodLabel,
      income,
      outflow,
      salaryTotal: salaryOut,
      expenseTotal: otherOut,
      series: series.map((m) => ({ label: m.label, income: m.income, expense: m.expense })),
      seriesTitle,
      sources: sourceStats.map((s) => ({ label: s.label, count: s.count, value: s.value, collected: s.collected })),
      // Mục tiêu theo đúng kỳ đang xem (năm = mục tiêu tháng × 12).
      target: periodTarget,
    };
  }

  const fileBase = `thu-chi-${ym}`;

  async function exportExcel() {
    setExporting(true);
    try {
      await exportFinance(studio, financeData(), fileBase);
    } finally {
      setExporting(false);
    }
  }

  function exportCsv() {
    downloadCsv(financeCsvRows(studio, financeData()), fileBase);
  }

  /** Lùi/tiến một tháng, hoặc một năm khi đang tổng kết theo năm. */
  function move(d: number) {
    setCursor((c) => {
      if (period === "year") return { ...c, year: c.year + d };
      const m = c.month + d;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  /** Thêm khoản chi từ form `exp`. Trả về true khi đã lưu (form được làm trống). */
  async function addExpense(): Promise<boolean> {
    const amount = Math.max(0, Math.round(Number(exp.amount) || 0));
    if (!exp.title.trim() || !amount) return false;
    // Ghi lùi vào kỳ đã chốt: nói ra TRƯỚC khi gọi DB. Không có câu này thì
    // trigger chối, `error` bị bỏ qua, và form chỉ đứng im không nói gì.
    if (blocksWrite({ op: "insert", closedUntil, newDate: exp.spent_at })) {
      alert(blockedWriteMessage(closedUntil!));
      return false;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("studio_expenses")
      .insert({
        owner_id: ownerId,
        title: exp.title.trim(),
        amount,
        category: exp.category,
        spent_at: exp.spent_at,
        note: exp.note.trim() || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      alert(error.message);
      return false;
    }
    if (data) {
      setExpenses((p) => [...p, data as StudioExpense]);
      setExp(emptyExpense());
      return true;
    }
    return false;
  }

  /** Xoá một khoản chi. Trả về true khi đã xoá. */
  async function delExpense(id: string): Promise<boolean> {
    const row = expenses.find((e) => e.id === id);
    if (blocksWrite({ op: "delete", closedUntil, oldDate: row?.spent_at })) {
      alert(blockedWriteMessage(closedUntil!));
      return false;
    }
    const { error } = await supabase.from("studio_expenses").delete().eq("id", id);
    // Lỗi từng bị nuốt: hàng rào khoá sổ chối lệnh xoá mà dòng vẫn biến mất khỏi
    // màn hình, F5 lại thấy. Thông báo của trigger đã là tiếng Việt đầy đủ.
    if (error) {
      alert(error.message);
      return false;
    }
    setExpenses((p) => p.filter((e) => e.id !== id));
    return true;
  }

  return {
    cursor, setCursor, period, setPeriod, ym, periodLabel, periodWord, move,
    expenses, monthPayments, monthSalaries, monthExpenses,
    income, salaryOut, otherOut, profit, margin, cashIn, transferIn, unknownIn,
    target, periodTarget, targetPct, saveTarget,
    series, chartMax, seriesTitle,
    exporting, exportExcel, exportCsv,
    exp, setExp, busy, addExpense, delExpense,
  };
}
