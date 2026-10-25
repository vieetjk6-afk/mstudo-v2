"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, BarChart3, ChevronDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet,
  Filter, HandCoins, Landmark, Lock, Pencil, PieChart, Plus, Receipt, Target, Trash2, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { vnd, vndShort, EXPENSE_CATEGORY_LABEL, PAYMENT_KIND_LABEL, type PaymentKind } from "@/lib/types";
import { fmtDate, fmtDayMonth } from "@/lib/date";
import { noAccent } from "@/lib/studio-nav";
import {
  Badge, Callout, Empty, Field, GroupLabel, PageHead, Progress, Section, Stack, Stat, StatGrid, Toolbar, btn, iconBtn, inputCls,
  type Tone,
} from "@/components/v2/kit";
import { Menu, Modal, SearchInput, Segmented } from "@/components/v2/kit-client";
import { MONTHS, useReports } from "./useReports";
import type { ReportsProps } from "./ReportsView";

/* ═══════════════════════════════════════════════════════════════════════════
   THU CHI & CÔNG NỢ — giao diện mới. Cùng dữ liệu, cùng thao tác với
   ReportsView (bản cũ, logic chung ở ./useReports); khác ở cách sắp xếp:
     • Đầu trang: chọn kỳ (tháng/năm + lùi/tiến), menu xuất file, MỘT nút chính
       "Thêm khoản chi" (mở hộp thoại thay cho form chen giữa trang).
     • 4 số liệu: thực thu · đã chi · công nợ khách · lợi nhuận (thẻ nổi bật).
     • MỘT sổ thu chi gộp (thay hai tab Tiền vào / Tiền ra): lọc Tất cả/Thu/Chi,
       tìm, phương thức, loại. Số tiền canh phải, + xanh / − đỏ. Điện thoại:
       mỗi dòng thành thẻ gọn.
     • Biểu đồ 12 tháng, mục tiêu, phễu, nguồn khách: các khối riêng phía dưới.
     • Xuất kế toán & khoá sổ: khối cuối màn (thẻ do page.tsx dựng sẵn).
   ═══════════════════════════════════════════════════════════════════════════ */

type Dir = "in" | "out";
type Method = "cash" | "transfer" | "none" | "na";
type Entry = {
  id: string;
  date: string;
  dir: Dir;
  title: string;
  sub: string;
  cat: string;
  catTone: Tone;
  method: Method;
  /** Có dấu: thu dương (hoàn tiền âm), chi âm. */
  signed: number;
  expenseId?: string;
};

const KIND_TONE: Record<PaymentKind, Tone> = {
  deposit: "brand",
  installment: "green",
  final: "green",
  other: "gray",
  refund: "red",
  voucher: "violet",
};

const METHOD_META: Record<Exclude<Method, "na">, { label: string; tone: Tone; icon?: typeof Banknote }> = {
  cash: { label: "Tiền mặt", tone: "amber", icon: Banknote },
  transfer: { label: "Chuyển khoản", tone: "blue", icon: Landmark },
  none: { label: "Chưa ghi", tone: "gray" },
};

/** "+1.200.000đ" / "−1.200.000đ" — dấu trừ thật (U+2212) cho thẳng cột. */
function signedVnd(n: number) {
  return `${n < 0 ? "−" : "+"}${vnd(Math.abs(n))}`;
}
function monthTitle(key: string) {
  const [y, m] = key.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

export default function ReportsV2(props: ReportsProps) {
  const { sourceStats, funnel, closedUntil = null, accounting, receivable } = props;
  const r = useReports(props);
  const {
    cursor, setCursor, period, setPeriod, ym, periodLabel, periodWord, move,
    monthPayments, monthSalaries, monthExpenses,
    income, salaryOut, otherOut, profit, margin, cashIn, transferIn, unknownIn,
    target, periodTarget, targetPct, saveTarget,
    series, chartMax, seriesTitle,
    exporting, exportExcel, exportCsv,
    exp, setExp, busy, addExpense, delExpense,
  } = r;

  const [kind, setKind] = useState<"all" | Dir>("all");
  const [q, setQ] = useState("");
  const [method, setMethod] = useState<"" | Exclude<Method, "na">>("");
  const [cat, setCat] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetInput, setTargetInput] = useState(target || 0);
  const [savingTarget, setSavingTarget] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ── Sổ thu chi gộp ─────────────────────────────────────────────────── */
  const entries: Entry[] = useMemo(() => {
    const list: Entry[] = [
      ...monthPayments.map((p) => ({
        id: `p-${p.id}`,
        date: p.paid_at || "",
        dir: "in" as const,
        title: p.contract?.title || "Hợp đồng",
        sub: "Thu từ hợp đồng",
        cat: PAYMENT_KIND_LABEL[p.kind] || "Khác",
        catTone: KIND_TONE[p.kind] ?? "gray",
        method: (p.method === "cash" || p.method === "transfer" ? p.method : "none") as Method,
        signed: p.amount || 0,
      })),
      ...monthSalaries.map((s) => ({
        id: `s-${s.id}`,
        date: s.paid_at || "",
        dir: "out" as const,
        title: s.name,
        sub: s.contract?.title || "Không gắn hợp đồng",
        cat: "Tiền công",
        catTone: "teal" as Tone,
        method: "na" as Method,
        signed: -(s.salary || 0),
      })),
      ...monthExpenses.map((e) => ({
        id: `e-${e.id}`,
        date: e.spent_at || "",
        dir: "out" as const,
        title: e.title,
        sub: e.note || "Chi phí vận hành",
        cat: EXPENSE_CATEGORY_LABEL[e.category || "other"] || e.category || "Khác",
        catTone: "gray" as Tone,
        method: "na" as Method,
        signed: -(e.amount || 0),
        expenseId: e.id,
      })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date) || a.dir.localeCompare(b.dir));
  }, [monthPayments, monthSalaries, monthExpenses]);

  const counts = useMemo(
    () => ({ all: entries.length, in: entries.filter((e) => e.dir === "in").length, out: entries.filter((e) => e.dir === "out").length }),
    [entries],
  );
  const catOptions = useMemo(() => [...new Set(entries.map((e) => e.cat))].sort((a, b) => a.localeCompare(b, "vi")), [entries]);

  const shown = useMemo(() => {
    const needle = noAccent(q.trim());
    return entries.filter((e) => {
      if (kind !== "all" && e.dir !== kind) return false;
      if (method && e.method !== method) return false;
      if (cat && e.cat !== cat) return false;
      if (needle && !noAccent(`${e.title} ${e.sub} ${e.cat}`).includes(needle)) return false;
      return true;
    });
  }, [entries, kind, method, cat, q]);

  // Xem cả năm thì nhóm theo tháng; xem một tháng thì một nhóm duy nhất.
  const groups = useMemo(() => {
    if (period !== "year") return [{ key: ym, label: "", rows: shown }];
    const map = new Map<string, Entry[]>();
    for (const e of shown) {
      const k = e.date.slice(0, 7);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()].map(([k, rows]) => ({ key: k, label: k ? monthTitle(k) : "Không rõ ngày", rows }));
  }, [shown, period, ym]);

  const shownIn = shown.filter((e) => e.signed > 0).reduce((s, e) => s + e.signed, 0);
  const shownOut = shown.filter((e) => e.signed < 0).reduce((s, e) => s + e.signed, 0);
  const filtering = kind !== "all" || !!q || !!method || !!cat;
  const clearFilters = () => {
    setKind("all");
    setQ("");
    setMethod("");
    setCat("");
  };

  /* ── Công nợ: hợp đồng còn thiếu tiền (toàn thời gian) ───────────────── */
  const debt =
    receivable ??
    {
      total: Math.max(0, sourceStats.reduce((s, x) => s + x.value - x.collected, 0)),
      count: null as number | null,
    };

  const outTotal = salaryOut + otherOut;
  const now = new Date();
  const atCurrent = cursor.year === now.getFullYear() && (period === "year" || cursor.month === now.getMonth());

  async function submitExpense() {
    const date = exp.spent_at;
    const ok = await addExpense();
    if (!ok) return;
    setAddOpen(false);
    setToast(date.startsWith(ym) ? "Đã thêm khoản chi" : `Đã thêm khoản chi ngày ${fmtDate(date)} (ngoài kỳ đang xem)`);
  }

  async function doDelete() {
    if (!confirmDel?.expenseId) return;
    setDeleting(true);
    const ok = await delExpense(confirmDel.expenseId);
    setDeleting(false);
    setConfirmDel(null);
    if (ok) setToast("Đã xoá khoản chi");
  }

  async function submitTarget() {
    setSavingTarget(true);
    await saveTarget(targetInput);
    setSavingTarget(false);
    setTargetOpen(false);
  }

  const expenseValid = !!exp.title.trim() && Math.round(Number(exp.amount) || 0) > 0;

  return (
    <Stack>
      <PageHead
        desc={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Tiền vào, tiền ra và công nợ của studio.</span>
            {closedUntil ? (
              <Badge tone="amber" icon={Lock} title="Không thêm, sửa, xoá được bút toán có ngày trước mốc này">
                Sổ khoá tới {fmtDate(closedUntil)}
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <>
            <Segmented
              size="sm"
              label="Kỳ tổng kết"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "month", label: "Tháng" },
                { value: "year", label: "Năm" },
              ]}
            />
            <div className="flex items-center rounded-[10px]" style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}>
              <button type="button" onClick={() => move(-1)} aria-label={period === "year" ? "Năm trước" : "Tháng trước"} className={iconBtn()}>
                <ChevronLeft size={17} />
              </button>
              <button
                type="button"
                onClick={() => setCursor({ year: now.getFullYear(), month: now.getMonth() })}
                disabled={atCurrent}
                title={atCurrent ? undefined : "Về kỳ hiện tại"}
                className="v2-num min-w-[112px] px-1 text-center text-[13.5px] font-semibold"
              >
                {periodLabel}
              </button>
              <button type="button" onClick={() => move(1)} aria-label={period === "year" ? "Năm sau" : "Tháng sau"} className={iconBtn()}>
                <ChevronRight size={17} />
              </button>
            </div>
            <Menu
              width={250}
              trigger={({ toggle, open }) => (
                <button type="button" onClick={toggle} aria-expanded={open} disabled={exporting} className={btn("secondary")}>
                  <Download size={16} /> {exporting ? "Đang tạo…" : "Xuất file"} <ChevronDown size={15} className="-mr-1 opacity-70" />
                </button>
              )}
              items={[
                { label: "Xuất Excel", hint: `Thu, chi, biểu đồ · ${periodLabel}`, icon: FileSpreadsheet, onClick: () => void exportExcel() },
                { label: "Xuất CSV", hint: "Cho công cụ khác", icon: Download, onClick: exportCsv },
                ...(accounting
                  ? (["divider", {
                      label: "Xuất kế toán & khoá sổ",
                      hint: "Kỳ tuỳ chọn, 3 sheet",
                      icon: Lock,
                      onClick: () => document.getElementById("ke-toan")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    }] as const)
                  : []),
              ]}
            />
            <button type="button" onClick={() => setAddOpen(true)} className={btn("primary")}>
              <Plus size={17} /> Thêm khoản chi
            </button>
          </>
        }
      />

      {/* ── 4 số liệu ──────────────────────────────────────────────────── */}
      <StatGrid>
        <Stat
          icon={TrendingUp}
          tone="green"
          label="Tiền thực thu"
          value={vndShort(income)}
          sub={
            monthPayments.length
              ? `${monthPayments.length} lần thu · tiền mặt ${vndShort(cashIn)}`
              : `Chưa có khoản thu trong ${periodWord}`
          }
        />
        <Stat
          icon={TrendingDown}
          tone="red"
          label="Đã chi"
          value={vndShort(outTotal)}
          sub={`Tiền công ${vndShort(salaryOut)} · khác ${vndShort(otherOut)}`}
        />
        <Stat
          icon={HandCoins}
          tone="amber"
          label="Công nợ khách"
          value={vndShort(debt.total)}
          valueTone={debt.total > 0 ? "amber" : undefined}
          sub={debt.count != null ? `${debt.count} hợp đồng chưa thu đủ` : "Hợp đồng chưa thu đủ"}
        />
        <div
          className="v2-card v2-stat"
          style={{ background: "var(--tx)", color: "var(--sf)", borderColor: "transparent" }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-semibold" style={{ opacity: 0.72 }}>Lợi nhuận dòng tiền</p>
            <span className="v2-stat-icon" style={{ background: "color-mix(in srgb, var(--sf) 14%, transparent)" }}>
              <Wallet size={16} />
            </span>
          </div>
          <p className="v2-stat-value">{vndShort(profit)}</p>
          <p className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ opacity: 0.85 }}>
            {margin != null ? (
              <span
                className="v2-badge"
                style={{
                  background: `color-mix(in srgb, ${margin >= 45 ? "var(--gn)" : margin >= 0 ? "var(--am)" : "var(--rd)"} 30%, transparent)`,
                  color: "var(--sf)",
                }}
              >
                Biên {margin}%
              </span>
            ) : null}
            <span style={{ opacity: 0.8 }}>{margin != null ? "thu trừ mọi khoản chi" : "Chưa có doanh thu"}</span>
          </p>
        </div>
      </StatGrid>

      {/* ── Sổ thu chi ─────────────────────────────────────────────────── */}
      <section className="v2-card overflow-hidden">
        <header className="flex flex-col gap-3 px-5 pb-3 pt-4 max-sm:px-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="v2-section-title">Sổ thu chi · {periodLabel}</h3>
            <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Tiền mặt {vndShort(cashIn)} · Chuyển khoản {vndShort(transferIn)}
              {unknownIn !== 0 ? ` · Chưa ghi phương thức ${vndShort(unknownIn)}` : ""}
            </span>
          </div>
          {entries.length > 0 && (
          <Toolbar>
            <Segmented
              label="Loại dòng tiền"
              value={kind}
              onChange={setKind}
              options={[
                { value: "all", label: "Tất cả", count: counts.all },
                { value: "in", label: "Thu", count: counts.in },
                { value: "out", label: "Chi", count: counts.out },
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Tìm hợp đồng, người nhận, nội dung…" className="min-w-[200px] flex-1 max-sm:order-first max-sm:basis-full" />
            <select aria-label="Phương thức" className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="">Mọi phương thức</option>
              <option value="cash">Tiền mặt</option>
              <option value="transfer">Chuyển khoản</option>
              <option value="none">Chưa ghi</option>
            </select>
            {catOptions.length > 1 && (
              <select aria-label="Loại" className={inputCls} value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Mọi loại</option>
                {catOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </Toolbar>
          )}
          {filtering ? (
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {shown.length} / {entries.length} dòng khớp bộ lọc ·{" "}
              <button type="button" className="font-semibold" style={{ color: "var(--ac)" }} onClick={clearFilters}>
                Xoá lọc
              </button>
            </p>
          ) : null}
        </header>

        {entries.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <Empty
              icon={Receipt}
              title={`Chưa có khoản thu chi nào trong ${periodWord}`}
              hint="Khoản thu ghi ở màn chi tiết hợp đồng sẽ tự chạy về đây. Chi phí thiết bị, đi lại, in ấn… thì thêm bằng nút “Thêm khoản chi”."
            />
          </div>
        ) : shown.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <Empty
              compact
              icon={Filter}
              title="Không có dòng nào khớp bộ lọc"
              hint="Thử bỏ bớt điều kiện lọc hoặc tìm bằng từ khác."
              action={<button type="button" className={btn("secondary", "sm")} onClick={clearFilters}>Xoá lọc</button>}
            />
          </div>
        ) : (
          <>
            {/* Máy tính: bảng */}
            <div className="v2-table-wrap hidden md:block" style={{ borderTop: "1px solid var(--bd2)" }}>
              <table className="v2-table">
                <thead>
                  <tr>
                    <th style={{ width: 76 }}>Ngày</th>
                    <th style={{ width: 150 }}>Loại</th>
                    <th>Nội dung</th>
                    <th style={{ width: 150 }}>Phương thức</th>
                    <th className="num" style={{ width: 150 }}>Số tiền</th>
                    <th style={{ width: 52 }} aria-label="Thao tác" />
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.key}>
                    {g.label ? (
                      <tr className="pointer-events-none">
                        <td colSpan={6} style={{ background: "var(--sf2)", paddingTop: 8, paddingBottom: 8 }}>
                          <GroupLabel count={`${g.rows.length} dòng`}>{g.label}</GroupLabel>
                        </td>
                      </tr>
                    ) : null}
                    {g.rows.map((e) => (
                      <tr key={e.id}>
                        <td className="v2-num" style={{ color: "var(--tx2)" }}>{fmtDayMonth(e.date)}</td>
                        <td>
                          <Badge tone={e.catTone}>{e.cat}</Badge>
                        </td>
                        <td style={{ maxWidth: 0 }}>
                          <p className="truncate font-semibold" title={e.title}>{e.title}</p>
                          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }} title={e.sub}>{e.sub}</p>
                        </td>
                        <td>
                          {e.method === "na" ? (
                            <span style={{ color: "var(--tx3)" }}>—</span>
                          ) : (
                            <Badge tone={METHOD_META[e.method].tone} icon={METHOD_META[e.method].icon}>{METHOD_META[e.method].label}</Badge>
                          )}
                        </td>
                        <td className="num font-semibold" style={{ color: e.signed < 0 ? "var(--rd)" : "var(--gn)" }}>{signedVnd(e.signed)}</td>
                        <td className="text-right" style={{ paddingLeft: 0, paddingRight: 10 }}>
                          {e.expenseId ? (
                            <button type="button" className={iconBtn()} aria-label="Xoá khoản chi" title="Xoá khoản chi" onClick={() => setConfirmDel(e)}>
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>

            {/* Điện thoại: thẻ gọn */}
            <div className="md:hidden" style={{ borderTop: "1px solid var(--bd2)" }}>
              {groups.map((g) => (
                <div key={g.key}>
                  {g.label ? (
                    <div className="px-4 pb-1 pt-3" style={{ background: "var(--sf2)" }}>
                      <GroupLabel count={`${g.rows.length} dòng`}>{g.label}</GroupLabel>
                    </div>
                  ) : null}
                  {g.rows.map((e) => (
                    <div key={e.id} className="v2-row" style={{ alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full"
                        style={e.dir === "in" && e.signed >= 0 ? { background: "var(--gnS)", color: "var(--gn)" } : { background: "var(--rdS)", color: "var(--rd)" }}
                        aria-hidden
                      >
                        {e.dir === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="v2-row-title min-w-0 flex-1 !whitespace-normal" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                            {e.title}
                          </p>
                          <span className="v2-num flex-none text-[14px] font-semibold" style={{ color: e.signed < 0 ? "var(--rd)" : "var(--gn)" }}>
                            {signedVnd(e.signed)}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="v2-num text-[12px]" style={{ color: "var(--tx3)" }}>{fmtDayMonth(e.date)}</span>
                          <Badge tone={e.catTone}>{e.cat}</Badge>
                          {e.method !== "na" ? <Badge tone={METHOD_META[e.method].tone}>{METHOD_META[e.method].label}</Badge> : null}
                          {e.expenseId ? (
                            <button type="button" className={iconBtn("-my-2 -mr-2 ml-auto")} aria-label="Xoá khoản chi" onClick={() => setConfirmDel(e)}>
                              <Trash2 size={15} />
                            </button>
                          ) : null}
                        </div>
                        {e.dir === "out" ? <p className="v2-row-sub mt-1">{e.sub}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Cộng cuối sổ */}
            <footer
              className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-5 py-3 text-[13px] max-sm:px-4"
              style={{ borderTop: "1px solid var(--bd)", background: "var(--sf2)" }}
            >
              <span style={{ color: "var(--tx2)" }}>
                Cộng {shown.length} dòng{filtering ? " (theo bộ lọc)" : ""}
              </span>
              <span className="v2-num flex flex-wrap items-center gap-x-4 gap-y-1 font-semibold">
                <span style={{ color: "var(--gn)" }}>{signedVnd(shownIn)}</span>
                <span style={{ color: "var(--rd)" }}>{signedVnd(shownOut)}</span>
                <span>
                  <span className="font-medium" style={{ color: "var(--tx3)" }}>Chênh lệch </span>
                  {signedVnd(shownIn + shownOut)}
                </span>
              </span>
            </footer>
          </>
        )}
      </section>

      {/* ── Biểu đồ & mục tiêu ─────────────────────────────────────────── */}
      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Section
          icon={BarChart3}
          title={seriesTitle}
          desc="Bấm vào một cột để xem tháng đó."
          actions={
            <span className="flex items-center gap-3 text-[12px]" style={{ color: "var(--tx3)" }}>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--gn)" }} /> Thu</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: "var(--rd)" }} /> Chi</span>
            </span>
          }
        >
          <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: 176 }}>
            {series.map((s) => {
              const on = s.ym.startsWith(ym);
              return (
                <button
                  type="button"
                  key={s.ym}
                  onClick={() => {
                    const [y, m] = s.ym.split("-").map(Number);
                    setPeriod("month");
                    setCursor({ year: y, month: m - 1 });
                  }}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 rounded-[8px] pt-1 transition-colors"
                  style={{ background: on && period === "month" ? "var(--sf2)" : undefined }}
                  title={`${MONTHS[Number(s.ym.slice(5)) - 1]}/${s.ym.slice(0, 4)}: thu ${vnd(s.income)} · chi ${vnd(s.expense)} · lãi ${vnd(s.profit)}`}
                  aria-label={`${s.label}: thu ${vnd(s.income)}, chi ${vnd(s.expense)}`}
                >
                  <div className="flex w-full flex-1 items-end justify-center gap-[2px] px-[3px]">
                    <div
                      className="transition-opacity group-hover:opacity-100"
                      style={{ width: "40%", maxWidth: 16, height: `${(s.income / chartMax) * 100}%`, background: "var(--gn)", borderRadius: "4px 4px 1px 1px", minHeight: s.income ? 3 : 0, opacity: on ? 1 : 0.72 }}
                    />
                    <div
                      className="transition-opacity group-hover:opacity-100"
                      style={{ width: "40%", maxWidth: 16, height: `${(s.expense / chartMax) * 100}%`, background: "var(--rd)", borderRadius: "4px 4px 1px 1px", minHeight: s.expense ? 3 : 0, opacity: on ? 1 : 0.6 }}
                    />
                  </div>
                  <span className="pb-1 text-[11px] font-semibold" style={{ color: on ? "var(--ac)" : "var(--tx3)" }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section
          icon={Target}
          title={period === "year" ? "Mục tiêu doanh thu năm" : "Mục tiêu doanh thu tháng"}
          desc={period === "year" ? "Mục tiêu tháng × 12" : periodLabel}
          actions={
            target > 0 ? (
            <button
              type="button"
              className={btn("ghost", "sm")}
              onClick={() => {
                setTargetInput(target || 0);
                setTargetOpen(true);
              }}
            >
              <Pencil size={14} /> Sửa
            </button>
            ) : undefined
          }
        >
          {periodTarget > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <p className="v2-num text-[30px] font-bold leading-none" style={{ letterSpacing: "-0.8px", color: targetPct >= 100 ? "var(--gn)" : "var(--tx)" }}>
                  {targetPct}%
                </p>
                {targetPct >= 100 ? <Badge tone="green">Đạt mục tiêu</Badge> : null}
              </div>
              <Progress value={targetPct} tone={targetPct >= 100 ? "green" : "brand"} />
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <span style={{ color: "var(--tx3)" }}>Đã thu</span>
                  <span className="v2-num font-semibold">{vnd(income)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span style={{ color: "var(--tx3)" }}>Mục tiêu</span>
                  <span className="v2-num">{vnd(periodTarget)}</span>
                </div>
                {targetPct < 100 ? (
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "var(--tx3)" }}>Còn thiếu</span>
                    <span className="v2-num font-semibold" style={{ color: "var(--am)" }}>{vnd(Math.max(0, periodTarget - income))}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <Empty
              compact
              icon={Target}
              title="Chưa đặt mục tiêu"
              hint="Đặt mục tiêu doanh thu tháng để theo dõi tiến độ thu tiền."
              action={
                <button type="button" className={btn("secondary", "sm")} onClick={() => { setTargetInput(0); setTargetOpen(true); }}>
                  Đặt mục tiêu
                </button>
              }
            />
          )}
        </Section>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Phễu: giá trị nằm ở hai tỉ lệ giữa — rớt ở bậc nào thì biết sửa
            quảng cáo hay sửa cách chốt đơn. */}
        <Section icon={Filter} title="Phễu chuyển đổi" desc="Toàn thời gian · tỉ lệ tính trên bậc liền trước">
          {(() => {
            const maxCount = Math.max(1, ...funnel.filter((f) => f.key !== "revenue").map((f) => f.value));
            return (
              <ul className="flex flex-col gap-3.5">
                {funnel.map((st) => {
                  const money = st.key === "revenue";
                  // Bậc tiền khác đơn vị với ba bậc đếm người → không vẽ chung thước.
                  const w = money ? 100 : (st.value / maxCount) * 100;
                  return (
                    <li key={st.key} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="font-medium">{st.label}</span>
                        <span className="v2-num flex items-center gap-2 font-semibold">
                          {money ? vnd(st.value) : st.value.toLocaleString("vi-VN")}
                          {st.rate != null ? <Badge tone={st.rate >= 20 ? "green" : "amber"}>{st.rate}%</Badge> : null}
                        </span>
                      </div>
                      <Progress value={Math.max(2, w)} tone={money ? "green" : "brand"} />
                    </li>
                  );
                })}
              </ul>
            );
          })()}
          {funnel[0].key !== "leads" ? (
            <p className="mt-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Đang xem một chi nhánh nên bỏ bậc <b>Khách hỏi</b>: hộp thư và lead không gắn cơ sở nào, lấy số của cả studio
              chia cho yêu cầu của riêng cơ sở này sẽ ra tỉ lệ sai. Chọn “Tất cả chi nhánh” để xem đủ bốn bậc.
            </p>
          ) : funnel[0].value === 0 ? (
            <p className="mt-4 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              Bậc đầu đếm hội thoại trong Hộp thư (Zalo · Facebook · Instagram · chatbox) cộng lead từ chatbox nền tảng.
              Chưa nối kênh nào thì bậc này còn 0, ba bậc dưới vẫn đúng.
            </p>
          ) : null}
        </Section>

        <Section icon={PieChart} title="Nguồn khách" desc="Toàn thời gian · giá trị hợp đồng theo kênh khách đến">
          {sourceStats.length === 0 ? (
            <Empty compact icon={PieChart} title="Chưa có hợp đồng nào" hint="Ghi nguồn khách khi tạo hợp đồng để biết kênh nào ra tiền nhất." />
          ) : (
            (() => {
              const maxVal = Math.max(1, ...sourceStats.map((s) => s.value));
              const totalVal = sourceStats.reduce((s, x) => s + x.value, 0);
              return (
                <ul className="flex flex-col gap-3.5">
                  {sourceStats.map((s) => (
                    <li key={s.source} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="min-w-0 truncate font-medium">
                          {s.label} <span style={{ color: "var(--tx3)" }}>· {s.count} HĐ</span>
                        </span>
                        <span className="v2-num flex-none font-semibold">
                          {vndShort(s.value)}{" "}
                          <span className="font-normal" style={{ color: "var(--tx3)" }}>
                            · {totalVal > 0 ? Math.round((s.value / totalVal) * 100) : 0}%
                          </span>
                        </span>
                      </div>
                      <Progress value={(s.value / maxVal) * 100} tone="brand" />
                      <p className="text-[12px]" style={{ color: "var(--tx3)" }}>
                        Đã thu {vnd(s.collected)}
                        {s.bookings > 0 ? ` · ${s.bookings} yêu cầu → ${s.count} HĐ (${Math.round((s.count / s.bookings) * 100)}%)` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              );
            })()
          )}
        </Section>
      </div>

      {accounting ? (
        <section id="ke-toan" className="scroll-mt-24">
          {accounting}
        </section>
      ) : null}

      {/* ── Hộp thoại thêm khoản chi ───────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        icon={Receipt}
        title="Thêm khoản chi"
        desc="Chi phí thiết bị, đi lại, in ấn… Tiền công thợ tự vào sổ khi đánh dấu đã trả ở màn Đối soát tiền công."
        width={520}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setAddOpen(false)}>Huỷ</button>
            <button type="button" className={btn("primary")} disabled={busy || !expenseValid} onClick={submitExpense}>
              <Plus size={16} /> {busy ? "Đang thêm…" : "Thêm khoản chi"}
            </button>
          </>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && expenseValid) void submitExpense();
          }}
        >
          <Field label="Nội dung chi" htmlFor="exp-title">
            <input
              id="exp-title"
              className={inputCls}
              placeholder="VD: Thuê lens 24-70"
              value={exp.title}
              onChange={(e) => setExp((p) => ({ ...p, title: e.target.value }))}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Số tiền">
              <MoneyInput className={inputCls} placeholder="0" ariaLabel="Số tiền" value={exp.amount} onChange={(n) => setExp((p) => ({ ...p, amount: n }))} />
            </Field>
            <Field label="Ngày chi">
              <DateInput className={inputCls} value={exp.spent_at} onChange={(v) => setExp((p) => ({ ...p, spent_at: v }))} allowPast />
            </Field>
          </div>
          <Field label="Hạng mục" htmlFor="exp-cat">
            <select id="exp-cat" className={inputCls} value={exp.category} onChange={(e) => setExp((p) => ({ ...p, category: e.target.value }))}>
              {Object.keys(EXPENSE_CATEGORY_LABEL).map((k) => (
                <option key={k} value={k}>{EXPENSE_CATEGORY_LABEL[k]}</option>
              ))}
            </select>
          </Field>
          <Field label="Ghi chú" hint="Không bắt buộc" htmlFor="exp-note">
            <input id="exp-note" className={inputCls} placeholder="VD: 2 người, khứ hồi" value={exp.note} onChange={(e) => setExp((p) => ({ ...p, note: e.target.value }))} />
          </Field>
          {closedUntil ? (
            <Callout tone="amber" icon={Lock}>
              Sổ đã khoá tới {fmtDate(closedUntil)}. Khoản chi có ngày từ mốc này trở về trước sẽ không lưu được.
            </Callout>
          ) : null}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      {/* ── Hộp thoại mục tiêu ─────────────────────────────────────────── */}
      <Modal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        icon={Target}
        title="Mục tiêu doanh thu tháng"
        desc="Số tiền studio muốn thu mỗi tháng. Xem theo năm sẽ tự nhân 12."
        width={440}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setTargetOpen(false)}>Huỷ</button>
            <button type="button" className={btn("primary")} disabled={savingTarget} onClick={submitTarget}>
              {savingTarget ? "Đang lưu…" : "Lưu mục tiêu"}
            </button>
          </>
        }
      >
        <Field label="Mục tiêu mỗi tháng">
          <MoneyInput className={inputCls} placeholder="0" ariaLabel="Mục tiêu mỗi tháng" value={targetInput} onChange={setTargetInput} />
        </Field>
      </Modal>

      {/* ── Xác nhận xoá ───────────────────────────────────────────────── */}
      <Modal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        icon={Trash2}
        title="Xoá khoản chi?"
        desc={confirmDel ? `“${confirmDel.title}” · ${vnd(Math.abs(confirmDel.signed))} · ${fmtDate(confirmDel.date)}` : undefined}
        width={420}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => setConfirmDel(null)}>Huỷ</button>
            <button type="button" className={btn("danger")} disabled={deleting} onClick={doDelete}>
              <Trash2 size={15} /> {deleting ? "Đang xoá…" : "Xoá"}
            </button>
          </>
        }
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[92vw] -translate-x-1/2 truncate rounded-[12px] px-4 py-2.5 text-[13px] font-semibold lg:bottom-6"
          style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-toast)" }}
        >
          {toast}
        </div>
      )}
    </Stack>
  );
}
