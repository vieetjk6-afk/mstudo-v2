"use client";

import { useMemo, useState } from "react";
import DateInput from "@/components/DateInput";
import { ChevronLeft, ChevronRight, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Download, FileSpreadsheet, Receipt, Target, PieChart, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import MoneyInput from "@/components/MoneyInput";
import { Panel, PanelHead, EmptyState, StatCard } from "@/components/studio/ui";
import { vnd, vndShort, EXPENSE_CATEGORY_LABEL, PAYMENT_KIND_LABEL, type StudioExpense, type PaymentKind } from "@/lib/types";
import { fmtDayMonth, todayVN } from "@/lib/date";
import type { FunnelStage } from "@/lib/lead-source";
import {
  exportFinance,
  downloadCsv,
  financeCsvRows,
  type ExportStudio,
  type FinanceExport,
  type MoneyRow,
} from "@/lib/studio-export";

export type PaymentRow = {
  id: string;
  amount: number;
  kind: PaymentKind;
  paid_at: string;
  contract: { title: string } | null;
};
export type SalaryRow = {
  id: string;
  name: string;
  salary: number;
  paid: boolean;
  paid_at: string | null;
  contract: { title: string } | null;
};
export type SourceStat = { source: string; label: string; count: number; value: number; collected: number; bookings: number };

const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

const TABS: [string, string][] = [
  ["in", "Tiền vào"],
  ["out", "Tiền ra"],
  ["chart", "Biểu đồ & mục tiêu"],
];

export default function ReportsView({
  ownerId,
  studio,
  payments,
  salaries,
  initialExpenses,
  initialTarget,
  sourceStats,
  funnel,
}: {
  ownerId: string;
  /** Thông tin studio in ở đầu file Excel/CSV xuất ra. */
  studio: ExportStudio;
  payments: PaymentRow[];
  salaries: SalaryRow[];
  initialExpenses: StudioExpense[];
  initialTarget: number;
  sourceStats: SourceStat[];
  funnel: FunnelStage[];
}) {
  const supabase = createClient();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [expenses, setExpenses] = useState<StudioExpense[]>(initialExpenses);
  const [target, setTarget] = useState(initialTarget);
  const [targetEdit, setTargetEdit] = useState(false);
  const [targetInput, setTargetInput] = useState(initialTarget || 0);
  const [tab, setTab] = useState<string>("in");
  const [showAdd, setShowAdd] = useState(false);
  // Tổng kết theo THÁNG hay theo NĂM. Mọi con số trên trang (4 thẻ, hai danh
  // sách, file xuất ra) đều đọc từ một tiền tố ngày duy nhất bên dưới, nên
  // chuyển nút là cả trang đổi theo — không có chỗ nào còn tính riêng.
  const [period, setPeriod] = useState<"month" | "year">("month");

  const [exp, setExp] = useState({ title: "", amount: 0, category: "equipment", spent_at: todayVN(), note: "" });
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

  async function saveTarget() {
    const v = Math.max(0, Math.round(Number(targetInput) || 0));
    await supabase.from("profiles").update({ monthly_revenue_target: v }).eq("id", ownerId);
    setTarget(v);
    setTargetEdit(false);
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
        kind: PAYMENT_KIND_LABEL[p.kind],
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

  async function addExpense() {
    const amount = Math.max(0, Math.round(Number(exp.amount) || 0));
    if (!exp.title.trim() || !amount) return;
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
    if (!error && data) {
      setExpenses((p) => [...p, data as StudioExpense]);
      setExp({ title: "", amount: 0, category: "equipment", spent_at: todayVN(), note: "" });
    }
  }

  async function delExpense(id: string) {
    await supabase.from("studio_expenses").delete().eq("id", id);
    setExpenses((p) => p.filter((e) => e.id !== id));
  }

  const btn = "flex flex-none items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold";
  const btnStyle = { border: "1px solid var(--bd)", background: "var(--sf)" };

  // Gộp chi lương + chi khác thành một dòng thời gian cho tab "Tiền ra".
  const outRows = [
    ...monthSalaries.map((s) => ({
      id: `s-${s.id}`, date: s.paid_at || "", title: `Tiền công · ${s.name}`,
      sub: s.contract?.title || "Không gắn hợp đồng", amount: s.salary, canDelete: false as const,
    })),
    ...monthExpenses.map((e) => ({
      id: `e-${e.id}`, date: e.spent_at, title: e.title,
      sub: EXPENSE_CATEGORY_LABEL[e.category || "other"] || e.category || "Chi phí khác",
      amount: e.amount, canDelete: true as const, rawId: e.id,
    })),
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="page-in flex flex-col gap-3.5">
      {/* ── 4 thẻ số liệu tháng ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
        <StatCard icon={TrendingUp} tone="green" label="Doanh thu (đã thu)" value={vndShort(income)} sub={`${monthPayments.length} lần thu trong ${periodWord}`} />
        <StatCard icon={TrendingDown} tone="amber" label="Chi tiền công" value={vndShort(salaryOut)} sub={`${monthSalaries.length} khoản đã trả`} />
        <StatCard icon={Receipt} tone="red" label="Chi phí khác" value={vndShort(otherOut)} sub={`${monthExpenses.length} khoản chi`} />
        <StatCard
          icon={Wallet}
          tone={profit >= 0 ? "brand" : "red"}
          label="Lợi nhuận"
          value={vndShort(profit)}
          sub={margin != null ? `biên ${margin}%` : "chưa có doanh thu"}
          delta={margin != null ? `${margin}%` : undefined}
          deltaTone={margin == null ? "gray" : margin >= 60 ? "green" : margin >= 45 ? "amber" : "red"}
        />
      </div>

      {/* ── Tab + tháng + hành động ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="tablist" aria-label="Nhóm số liệu" className="flex flex-wrap gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {TABS.map(([key, label]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="whitespace-nowrap rounded-[8px] px-[15px] py-[6.5px] text-[12.5px] font-semibold"
                style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Chọn kỳ tổng kết: theo tháng hay cả năm. */}
        <div role="group" aria-label="Kỳ tổng kết" className="flex gap-[3px] rounded-[11px] p-[3px]" style={{ background: "var(--sf2)", border: "1px solid var(--bd)" }}>
          {([["month", "Theo tháng"], ["year", "Theo năm"]] as const).map(([key, label]) => {
            const on = period === key;
            return (
              <button
                key={key}
                aria-pressed={on}
                onClick={() => setPeriod(key)}
                className="whitespace-nowrap rounded-[8px] px-[13px] py-[6.5px] text-[12.5px] font-semibold"
                style={{ color: on ? "var(--ac)" : "var(--tx2)", background: on ? "var(--sf)" : "transparent", boxShadow: on ? "0 1px 3px rgba(0,0,0,.10)" : "none" }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label={period === "year" ? "Năm trước" : "Tháng trước"} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={btnStyle}><ChevronLeft size={16} /></button>
          <span className="min-w-[118px] text-center text-[12.5px] font-semibold">{periodLabel}</span>
          <button onClick={() => move(1)} aria-label={period === "year" ? "Năm sau" : "Tháng sau"} className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]" style={btnStyle}><ChevronRight size={16} /></button>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={exporting} className={btn} style={{ ...btnStyle, opacity: exporting ? 0.6 : 1 }}>
            <FileSpreadsheet size={16} /> {exporting ? "Đang tạo…" : "Xuất Excel"}
          </button>
          <button onClick={exportCsv} className={btn} style={btnStyle} title="Bản CSV cho công cụ khác"><Download size={16} /> CSV</button>
          <button
            onClick={() => { setShowAdd((v) => !v); setTab("out"); }}
            className="flex flex-none items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            <Plus size={16} /> Thêm khoản chi
          </button>
        </div>
      </div>

      {/* ── Form thêm chi phí ─────────────────────────────────────────── */}
      {showAdd && (
        <Panel className="p-4">
          <div className="grid gap-2 sm:grid-cols-12">
            <input className="input sm:col-span-4" placeholder="Nội dung chi" value={exp.title} onChange={(e) => setExp((p) => ({ ...p, title: e.target.value }))} />
            <MoneyInput className="input sm:col-span-2" placeholder="Số tiền" value={exp.amount} onChange={(n) => setExp((p) => ({ ...p, amount: n }))} />
            <select className="input sm:col-span-3" value={exp.category} onChange={(e) => setExp((p) => ({ ...p, category: e.target.value }))}>
              {Object.keys(EXPENSE_CATEGORY_LABEL).map((k) => (
                <option key={k} value={k}>{EXPENSE_CATEGORY_LABEL[k]}</option>
              ))}
            </select>
            <DateInput wrapperClassName="sm:col-span-3" value={exp.spent_at} onChange={(v) => setExp((p) => ({ ...p, spent_at: v }))} allowPast />
          </div>
          <button
            onClick={addExpense}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--ac)", color: "#fff", opacity: busy ? 0.6 : 1 }}
          >
            <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm chi phí"}
          </button>
        </Panel>
      )}

      {/* ── Tiền vào ──────────────────────────────────────────────────── */}
      {tab === "in" && (
        <Panel>
          <PanelHead icon={TrendingUp} tone="green" title="Tiền vào" count={vnd(income)} note={`Tiền thực nhận về studio trong ${periodWord}`} />
          {monthPayments.length === 0 ? (
            <EmptyState icon={TrendingUp} title={`Chưa có khoản thu nào trong ${periodWord}`} hint="Ghi nhận thanh toán ở màn chi tiết hợp đồng, số liệu sẽ chạy về đây." />
          ) : (
            monthPayments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-[18px] py-[13px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span className="tnum w-11 flex-none text-[12px]" style={{ color: "var(--tx3)" }}>{fmtDayMonth(p.paid_at)}</span>
                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{p.contract?.title || "Hợp đồng"}</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>{PAYMENT_KIND_LABEL[p.kind]}</p>
                </div>
                <span className="flex-none whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11px] font-semibold" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                  {PAYMENT_KIND_LABEL[p.kind]}
                </span>
                <span className="tnum min-w-[120px] flex-none text-right text-[14px] font-bold" style={{ color: "var(--gn)" }}>{vnd(p.amount)}</span>
              </div>
            ))
          )}
        </Panel>
      )}

      {/* ── Tiền ra ───────────────────────────────────────────────────── */}
      {tab === "out" && (
        <Panel>
          <PanelHead icon={TrendingDown} tone="red" title="Tiền ra" count={vnd(salaryOut + otherOut)} note="Tiền công nhân sự + chi phí vận hành" />
          {outRows.length === 0 ? (
            <EmptyState icon={Receipt} title={`Chưa có khoản chi nào trong ${periodWord}`} hint='Bấm "Thêm khoản chi" để ghi nhận chi phí thiết bị, đi lại, in ấn…' />
          ) : (
            outRows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-[18px] py-[13px]" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <span className="tnum w-11 flex-none text-[12px]" style={{ color: "var(--tx3)" }}>{fmtDayMonth(r.date)}</span>
                <div className="min-w-[160px] flex-1">
                  <p className="truncate text-[13.5px] font-semibold">{r.title}</p>
                  <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{r.sub}</p>
                </div>
                <span className="tnum min-w-[120px] flex-none text-right text-[14px] font-bold" style={{ color: "var(--rd)" }}>{vnd(r.amount)}</span>
                {r.canDelete ? (
                  <button onClick={() => delExpense(r.rawId)} aria-label="Xoá chi phí" title="Xoá" className="flex-none p-1" style={{ color: "var(--tx3)" }}>
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <span className="w-[22px] flex-none" />
                )}
              </div>
            ))
          )}
        </Panel>
      )}

      {/* ── Biểu đồ & mục tiêu ────────────────────────────────────────── */}
      {tab === "chart" && (
        <>
          <Panel className="p-[18px]">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Target size={18} style={{ color: "var(--ac)" }} />
              <h2 className="text-[14px] font-bold">
                {period === "year" ? "Mục tiêu doanh thu năm (mục tiêu tháng × 12)" : "Mục tiêu doanh thu tháng"}
              </h2>
              <div className="ml-auto">
                {targetEdit ? (
                  <div className="flex items-center gap-2">
                    <MoneyInput className="input w-36" placeholder="Số tiền" value={targetInput} onChange={setTargetInput} />
                    <button onClick={saveTarget} className="rounded-[9px] px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--ac)", color: "#fff" }}>Lưu</button>
                  </div>
                ) : (
                  <button onClick={() => { setTargetInput(target || 0); setTargetEdit(true); }} className={btn} style={btnStyle}>
                    {target > 0 ? "Sửa mục tiêu" : "Đặt mục tiêu"}
                  </button>
                )}
              </div>
            </div>
            {periodTarget > 0 ? (
              <>
                <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${targetPct}%`, background: targetPct >= 100 ? "var(--gn)" : "var(--ac)" }} />
                </div>
                <p className="mt-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                  {vnd(income)} / {vnd(periodTarget)} · <b style={{ color: targetPct >= 100 ? "var(--gn)" : "var(--tx)" }}>{targetPct}%</b>
                  {targetPct >= 100 ? " 🎉 đạt mục tiêu!" : ` · còn ${vnd(Math.max(0, periodTarget - income))}`}
                </p>
              </>
            ) : (
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Chưa đặt mục tiêu doanh thu cho tháng.</p>
            )}
          </Panel>

          <Panel className="p-[18px]">
            <h2 className="mb-3 text-[14px] font-bold">{seriesTitle}</h2>
            <div className="flex items-end gap-1.5" style={{ height: 160 }}>
              {series.map((s) => (
                <div key={s.ym} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${s.label}: thu ${vnd(s.income)} · chi ${vnd(s.expense)}`}>
                  <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 130 }}>
                    <div style={{ width: "42%", height: `${(s.income / chartMax) * 100}%`, background: "var(--ac)", borderRadius: "3px 3px 0 0", minHeight: s.income ? 2 : 0 }} />
                    <div style={{ width: "42%", height: `${(s.expense / chartMax) * 100}%`, background: "var(--rd)", borderRadius: "3px 3px 0 0", minHeight: s.expense ? 2 : 0 }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: s.ym.startsWith(ym) ? "var(--ac)" : "var(--tx3)" }}>{s.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[11px]" style={{ color: "var(--tx3)" }}>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--ac)" }} /> Thu</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--rd)" }} /> Chi</span>
            </div>
          </Panel>

          {/* ── Phễu chuyển đổi ────────────────────────────────────────────
              Bốn bậc studio thật sự đi qua. Giá trị của khối này KHÔNG phải bốn
              con số, mà là hai tỉ lệ ở giữa: bao nhiêu người hỏi thì gửi yêu
              cầu, và bao nhiêu yêu cầu thì thành hợp đồng. Studio nào rớt ở bậc
              nào thì biết phải sửa quảng cáo hay sửa cách chốt đơn. */}
          <Panel className="p-[18px]">
            <div className="mb-1 flex items-center gap-2">
              <Filter size={18} style={{ color: "var(--ac)" }} />
              <h2 className="text-[14px] font-bold">Phễu chuyển đổi (toàn thời gian)</h2>
            </div>
            <p className="mb-4 text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Khách hỏi → gửi yêu cầu → ký hợp đồng → tiền về. Tỉ lệ tính trên bậc liền trước.
            </p>
            {(() => {
              const maxCount = Math.max(1, ...funnel.filter((f) => f.key !== "revenue").map((f) => f.value));
              return (
                <ul className="flex flex-col gap-3">
                  {funnel.map((st) => {
                    const money = st.key === "revenue";
                    // Bậc tiền không cùng đơn vị với ba bậc đếm người, nên KHÔNG
                    // vẽ chung một thước — vẽ chung thì cột tiền dài vô nghĩa.
                    const w = money ? 100 : (st.value / maxCount) * 100;
                    return (
                      <li key={st.key}>
                        <div className="mb-1 flex items-center justify-between text-[12.5px]">
                          <span className="font-semibold">{st.label}</span>
                          <span className="tnum">
                            {money ? vnd(st.value) : st.value}
                            {st.rate != null && (
                              <span className="ml-1.5 text-[11px]" style={{ color: st.rate >= 20 ? "var(--gn)" : "var(--am)" }}>
                                {st.rate}%
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(2, w)}%`, background: money ? "var(--gn)" : "var(--ac)" }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {funnel[0].key !== "leads" ? (
              <p className="mt-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Đang xem một chi nhánh nên bỏ bậc <b>Khách hỏi</b>: hộp thư và lead không gắn cơ sở nào (khách nhắn
                vào trang chung), lấy số của cả studio chia cho yêu cầu của riêng cơ sở này sẽ ra tỉ lệ sai. Chọn
                “Tất cả chi nhánh” để xem đủ bốn bậc.
              </p>
            ) : funnel[0].value === 0 ? (
              <p className="mt-3 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                Bậc đầu đếm hội thoại trong Hộp thư (Zalo · Facebook · Instagram · chatbox) cộng lead từ chatbox
                nền tảng. Chưa nối kênh nào thì bậc này còn 0 — ba bậc dưới vẫn đúng.
              </p>
            ) : null}
          </Panel>

          {sourceStats.length > 0 && (() => {
            const maxVal = Math.max(1, ...sourceStats.map((s) => s.value));
            const totalVal = sourceStats.reduce((s, x) => s + x.value, 0);
            return (
              <Panel className="p-[18px]">
                <div className="mb-1 flex items-center gap-2">
                  <PieChart size={18} style={{ color: "var(--bl)" }} />
                  <h2 className="text-[14px] font-bold">Nguồn khách (toàn thời gian)</h2>
                </div>
                <p className="mb-4 text-[11.5px]" style={{ color: "var(--tx3)" }}>Giá trị hợp đồng theo kênh khách đến — biết kênh nào ra tiền nhất.</p>
                <ul className="flex flex-col gap-3">
                  {sourceStats.map((s) => (
                    <li key={s.source}>
                      <div className="mb-1 flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold">{s.label} <span className="text-[11px] font-normal" style={{ color: "var(--tx3)" }}>· {s.count} HĐ</span></span>
                        <span className="tnum">{vnd(s.value)} <span className="text-[11px]" style={{ color: "var(--tx3)" }}>· {totalVal > 0 ? Math.round((s.value / totalVal) * 100) : 0}%</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--sf2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(s.value / maxVal) * 100}%`, background: "var(--ac)" }} />
                      </div>
                      <p className="mt-1 text-[11px]" style={{ color: "var(--tx3)" }}>
                        Đã thu {vnd(s.collected)}
                        {s.bookings > 0 && (
                          <>
                            {" · "}
                            {s.bookings} yêu cầu → {s.count} HĐ
                            {" ("}
                            {Math.round((s.count / s.bookings) * 100)}%{")"}
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })()}
        </>
      )}
    </div>
  );
}
