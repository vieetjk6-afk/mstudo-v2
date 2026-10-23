"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CalendarHeart, Check, Clock, ExternalLink, ListChecks, Lock, MapPin, Pencil, Plus,
  Sparkles, Trash2, UserRound, Users, Wallet,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import TimeInput from "@/components/TimeInput";
import { ProgressBar } from "@/components/studio/ui";
import { fmtDate, fmtDateLunar } from "@/lib/date";
import { vnd, vndShort } from "@/lib/types";
import {
  BUDGET_CATS, PLAN_WHEN, budgetCatLabel, budgetSummary, currentWhen, daysUntil, groupTasks, mergeDay,
  newPlanId, planProgress, taskDone, whenDue,
  type BudgetCat, type DayRow, type PlanOp, type PlanTask, type PlanWhen, type WeddingPlanData,
} from "@/lib/wedding-plan";
import type { PlannerPayload } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   KẾ HOẠCH CƯỚI — phần trình bày. Nhận dữ liệu qua props và báo thao tác qua
   `onOp`, không tự gọi mạng: trang thật (WeddingPlanner) lo lưu, /uipreview
   dựng thẳng bằng dữ liệu giả.

   Cùng bộ token `.client-doc` với cổng khách: chữ to hơn khu quản lý, không
   thuật ngữ nội bộ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlannerTab = "tasks" | "budget" | "day";
export type SaveState = "idle" | "saving" | "saved" | "error";

const TABS: [PlannerTab, string, typeof ListChecks][] = [
  ["tasks", "Việc cần làm", ListChecks],
  ["budget", "Ngân sách", Wallet],
  ["day", "Ngày cưới", Clock],
];

const card: React.CSSProperties = { background: "var(--sf)", border: "1px solid var(--bd)" };

export default function PlannerView({
  data, plan, today, backHref, onOp, saving = "idle", initialTab = "tasks",
}: {
  data: PlannerPayload;
  /** Kế hoạch đang hiện — có thể đã gồm thao tác chưa lưu xong. */
  plan: WeddingPlanData;
  today: string;
  backHref: string;
  onOp: (op: PlanOp) => void;
  saving?: SaveState;
  initialTab?: PlannerTab;
}) {
  const [tab, setTab] = useState<PlannerTab>(initialTab);
  const readOnly = data.plan_locked;
  const progress = useMemo(() => planProgress(plan.tasks, data.auto), [plan.tasks, data.auto]);
  const money = useMemo(() => budgetSummary(plan.budget, data.studio_line, plan.budget_total), [plan.budget, plan.budget_total, data.studio_line]);
  const dayRows = useMemo(() => mergeDay(plan.day, data.studio_day), [plan.day, data.studio_day]);
  const left = daysUntil(plan.wedding_date, today);
  const [editDate, setEditDate] = useState(false);

  return (
    <main className="client-doc min-h-screen">
      <div className="mx-auto w-full max-w-[880px] px-[18px] pb-[70px] pt-[22px]">
        {/* ── Đầu trang ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={backHref} className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--tx3)" }}>
            <ArrowLeft size={15} /> Trang hợp đồng của bạn
          </Link>
          <SaveBadge state={saving} />
        </div>

        <p className="mt-3 text-[11px] font-bold uppercase" style={{ letterSpacing: "1.2px", color: "var(--tx3)" }}>
          Kế hoạch cưới
        </p>
        <h1 className="font-serif text-[26px] font-semibold leading-tight" style={{ textWrap: "balance" }}>
          {data.contract.client_name || data.contract.title}
        </h1>
        {plan.wedding_date && (
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="tnum text-[20px] font-bold" style={{ letterSpacing: "-.5px", color: "var(--ac)" }}>
              {left === null ? "" : left > 0 ? `Còn ${left} ngày` : left === 0 ? "Hôm nay là ngày cưới" : `Đã cưới ${-left} ngày`}
            </span>
            <span className="tnum text-[12.5px]" style={{ color: "var(--tx2)" }}>{fmtDateLunar(plan.wedding_date)}</span>
            {!readOnly && (
              <button onClick={() => setEditDate((v) => !v)} className="text-[12.5px] font-bold" style={{ color: "var(--ac)" }}>
                Đổi ngày
              </button>
            )}
          </p>
        )}

        {readOnly && (
          <p className="mt-3.5 flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)" }}>
            <Lock size={15} style={{ flex: "none" }} />
            Trang đang ở chế độ xem — gói dịch vụ của {data.studio_name} đã hết hạn. Liên hệ studio để tiếp tục chỉnh sửa.
          </p>
        )}

        {(!plan.wedding_date || editDate) && !readOnly && (
          <WeddingDateCard
            value={plan.wedding_date}
            onSave={(d) => {
              onOp({ op: "set_date", date: d });
              setEditDate(false);
            }}
            onCancel={plan.wedding_date ? () => setEditDate(false) : undefined}
          />
        )}

        {/* ── Ba con số ─────────────────────────────────────────────────── */}
        {/* Ba ô luôn nằm một hàng, kể cả trên điện thoại: xếp dọc thì chúng
            chiếm nửa màn hình đầu và đẩy danh sách việc xuống khỏi tầm mắt. */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 min-[600px]:gap-3">
          <Stat
            icon={ListChecks}
            label="Việc đã xong"
            value={`${progress.done}/${progress.total}`}
            bar={progress.total ? (progress.done / progress.total) * 100 : 0}
            onClick={() => setTab("tasks")}
          />
          <Stat
            icon={Wallet}
            label="Dự kiến chi"
            value={vndShort(money.estimate)}
            bar={plan.budget_total > 0 ? money.pct : undefined}
            barColor={money.over ? "var(--rd)" : undefined}
            hint={money.over ? `Vượt ${vndShort(-(money.left ?? 0))}` : plan.budget_total > 0 ? `Ngân sách ${vndShort(plan.budget_total)}` : "Chưa đặt ngân sách"}
            hintColor={money.over ? "var(--rd)" : undefined}
            onClick={() => setTab("budget")}
          />
          {data.guests ? (
            <Stat
              icon={Users}
              label="Sẽ đến"
              value={String(data.guests.people)}
              hint={data.guests.total ? `${data.guests.total} khách mời` : `${data.guests.replies} phản hồi`}
              href={data.guests.href}
            />
          ) : (
            <Stat
              icon={Clock}
              label="Mốc ngày cưới"
              value={String(dayRows.length)}
              hint={dayRows.length ? "Studio xem được" : "Chưa lập"}
              onClick={() => setTab("day")}
            />
          )}
        </div>

        {/* ── Tab ───────────────────────────────────────────────────────── */}
        <div role="tablist" aria-label="Kế hoạch cưới" className="mt-3.5 flex gap-0.5 overflow-x-auto rounded-[14px] px-3" style={card}>
          {TABS.map(([key, label, Icon]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={on}
                onClick={() => setTab(key)}
                className="flex flex-none items-center gap-1.5 whitespace-nowrap px-3 pb-2.5 pt-3 text-[13.5px]"
                style={{ color: on ? "var(--ac)" : "var(--tx2)", fontWeight: on ? 700 : 550, borderBottom: `2px solid ${on ? "var(--ac)" : "transparent"}` }}
              >
                <Icon size={15} className="max-[420px]:hidden" /> {label}
              </button>
            );
          })}
        </div>

        <div className="mt-3.5">
          {tab === "tasks" && <TasksTab plan={plan} data={data} today={today} readOnly={readOnly} onOp={onOp} />}
          {tab === "budget" && <BudgetTab plan={plan} data={data} money={money} readOnly={readOnly} onOp={onOp} />}
          {tab === "day" && <DayTab plan={plan} rows={dayRows} data={data} readOnly={readOnly} onOp={onOp} />}
        </div>
      </div>
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ngày cưới, con số, trạng thái lưu
   ═══════════════════════════════════════════════════════════════════════════ */

function WeddingDateCard({ value, onSave, onCancel }: { value: string | null; onSave: (d: string) => void; onCancel?: () => void }) {
  const [d, setD] = useState(value ?? "");
  return (
    <section className="mt-3.5 rounded-[16px] px-5 py-[18px]" style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}>
      <p className="flex items-center gap-1.5 text-[15px] font-bold" style={{ color: "var(--ac)" }}>
        <CalendarHeart size={17} /> {value ? "Đổi ngày cưới" : "Ngày cưới của bạn là ngày nào?"}
      </p>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        Việc cần làm được xếp theo mốc trước ngày cưới — đổi ngày là cả danh sách tự dời theo.
      </p>
      <div className="mt-3 flex flex-wrap items-start gap-2">
        <div className="w-[220px] max-w-full">
          <DateInput value={d} onChange={setD} allowPast />
        </div>
        <button
          disabled={!d || d === value}
          onClick={() => onSave(d)}
          className="rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50"
          style={{ background: "var(--ac)", color: "#fff" }}
        >
          Lưu ngày cưới
        </button>
        {onCancel && (
          <button onClick={onCancel} className="rounded-[10px] px-3 py-2.5 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>
            Huỷ
          </button>
        )}
      </div>
    </section>
  );
}

function Stat({
  icon: Icon, label, value, bar, barColor, hint, hintColor, onClick, href,
}: {
  icon: typeof ListChecks;
  label: string;
  value: string;
  bar?: number;
  barColor?: string;
  hint?: string;
  hintColor?: string;
  onClick?: () => void;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
        <Icon size={14} className="flex-none max-[420px]:hidden" /> <span className="truncate">{label}</span>
      </span>
      <span className="tnum mt-1 block whitespace-nowrap text-[19px] font-bold min-[600px]:text-[22px]" style={{ letterSpacing: "-.7px" }}>{value}</span>
      {bar !== undefined && <ProgressBar pct={bar} color={barColor} height={5} className="mt-1.5" />}
      {hint && (
        <span className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold leading-snug" style={{ color: hintColor ?? "var(--tx3)" }}>
          {hint} {href && <ExternalLink size={12} className="flex-none" />}
        </span>
      )}
    </>
  );
  // flex-col + justify-start: <button> tự canh giữa nội dung theo chiều dọc, ô
  // dạng nút sẽ lệch hàng so với ô dạng link bên cạnh.
  const cls = "flex min-w-0 flex-col justify-start rounded-[14px] px-3 py-3 text-left min-[600px]:px-4 min-[600px]:py-3.5";
  if (href) return <Link href={href} className={cls} style={card}>{body}</Link>;
  return <button onClick={onClick} className={cls} style={card}>{body}</button>;
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const map = {
    saving: { text: "Đang lưu…", color: "var(--tx3)" },
    saved: { text: "Đã lưu", color: "var(--gn)" },
    error: { text: "Chưa lưu được", color: "var(--rd)" },
  } as const;
  const m = map[state];
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1 text-[12px] font-bold" style={{ color: m.color }}>
      {state === "saved" && <Check size={14} />} {m.text}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Việc cần làm
   ═══════════════════════════════════════════════════════════════════════════ */

function TasksTab({
  plan, data, today, readOnly, onOp,
}: { plan: WeddingPlanData; data: PlannerPayload; today: string; readOnly: boolean; onOp: (op: PlanOp) => void }) {
  const [hideDone, setHideDone] = useState(false);
  const now = currentWhen(plan.wedding_date, today);
  const groups = groupTasks(plan.tasks);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<PlanWhen>(now && now !== "after" ? now : "m3");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onOp({ op: "task_add", id: newPlanId(), title, when });
    setTitle("");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          Việc có dấu <Sparkles size={12} className="inline" style={{ color: "var(--ac)" }} /> tự đánh dấu xong khi {data.studio_name} cập nhật.
        </p>
        <label className="flex flex-none cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
          <input type="checkbox" className="h-4 w-4 accent-[var(--ac)]" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Ẩn việc đã xong
        </label>
      </div>

      {groups.map(({ when: w, tasks }) => {
        const shown = hideDone ? tasks.filter((t) => !taskDone(t, data.auto)) : tasks;
        const doneCount = tasks.filter((t) => taskDone(t, data.auto)).length;
        const due = whenDue(plan.wedding_date, w.key);
        const isNow = now === w.key;
        return (
          <section key={w.key} className="rounded-[16px] px-5 pb-2 pt-4" style={isNow ? { ...card, borderColor: "var(--acM)", boxShadow: "0 0 0 3px var(--acS)" } : card}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-[15px] font-bold">{w.label}</h3>
              {isNow && (
                <span className="rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                  Bây giờ
                </span>
              )}
              <span className="tnum ml-auto flex-none text-[12px] font-bold" style={{ color: doneCount === tasks.length ? "var(--gn)" : "var(--tx3)" }}>
                {doneCount}/{tasks.length}
              </span>
            </div>
            {due && (
              <p className="tnum mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                {w.key === "d0" ? fmtDate(due) : w.key === "after" ? `Trong 2 tuần sau cưới · trước ${fmtDate(due)}` : `Nên xong trước ${fmtDate(due)}`}
              </p>
            )}
            {shown.length === 0 ? (
              <p className="py-3 text-[12.5px]" style={{ color: "var(--tx3)" }}>Đã xong hết việc ở mốc này.</p>
            ) : (
              <ul className="mt-1.5">
                {shown.map((t) => (
                  <TaskRow key={t.id} t={t} data={data} overdue={!!due && due < today && w.key !== "after"} readOnly={readOnly} onOp={onOp} />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {!readOnly && (
        <form onSubmit={add} className="flex flex-wrap gap-2 rounded-[16px] px-4 py-3.5" style={card}>
          <input
            className="input w-auto min-w-[200px] flex-1 px-3 py-2.5"
            placeholder="Thêm việc của bạn…"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select className="input w-auto flex-none px-3 py-2.5" value={when} onChange={(e) => setWhen(e.target.value as PlanWhen)} aria-label="Mốc thời gian">
            {PLAN_WHEN.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
          <button type="submit" disabled={!title.trim()} className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--ac)", color: "#fff" }}>
            <Plus size={15} /> Thêm
          </button>
        </form>
      )}
    </div>
  );
}

function TaskRow({
  t, data, overdue, readOnly, onOp,
}: { t: PlanTask; data: PlannerPayload; overdue: boolean; readOnly: boolean; onOp: (op: PlanOp) => void }) {
  const auto = t.link ? data.auto[t.link] : undefined;
  const byStudio = !!auto?.done;
  const done = t.done || byStudio;
  return (
    <li className="flex items-start gap-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
      <button
        aria-pressed={done}
        aria-label={done ? `Bỏ đánh dấu: ${t.title}` : `Đánh dấu xong: ${t.title}`}
        title={byStudio ? `${data.studio_name} đã ghi nhận việc này` : undefined}
        disabled={readOnly || byStudio}
        onClick={() => onOp({ op: "task_set", id: t.id, done: !t.done })}
        className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full"
        style={done ? { background: "var(--ac)", color: "#fff", border: "1.5px solid var(--ac)" } : { background: "var(--sf)", border: "1.5px solid var(--bd)" }}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold" style={{ color: done ? "var(--tx3)" : "var(--tx)", textDecoration: done ? "line-through" : undefined, textWrap: "pretty" }}>
          {t.title}
          {overdue && !done && (
            <span className="ml-2 inline-block rounded-[20px] px-2 py-[1px] align-[1px] text-[10.5px] font-bold" style={{ background: "var(--rdS)", color: "var(--rd)", textDecoration: "none" }}>
              Quá hạn
            </span>
          )}
        </p>
        {auto?.sub && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
            <Sparkles size={12} style={{ flex: "none", color: "var(--ac)" }} /> {auto.sub}
            {auto.href && (
              <Link href={auto.href} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--ac)" }}>
                Mở <ExternalLink size={12} />
              </Link>
            )}
          </p>
        )}
        {t.note && <p className="mt-1 whitespace-pre-line text-[12px]" style={{ color: "var(--tx2)" }}>{t.note}</p>}
      </div>
      {!readOnly && <ConfirmDelete label={`Xoá việc: ${t.title}`} onConfirm={() => onOp({ op: "task_remove", id: t.id })} />}
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ngân sách
   ═══════════════════════════════════════════════════════════════════════════ */

function BudgetTab({
  plan, data, money, readOnly, onOp,
}: {
  plan: WeddingPlanData;
  data: PlannerPayload;
  money: ReturnType<typeof budgetSummary>;
  readOnly: boolean;
  onOp: (op: PlanOp) => void;
}) {
  const [cat, setCat] = useState<BudgetCat>("other");
  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState(0);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() && cat === "other") return;
    onOp({ op: "budget_add", id: newPlanId(), cat, name, estimate });
    setName("");
    setEstimate(0);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[16px] px-5 py-[18px]" style={card}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className="min-w-[200px] flex-1">
            <span className="text-[12px] font-bold" style={{ color: "var(--tx3)" }}>Tổng ngân sách cho đám cưới</span>
            <MoneyField
              className="input mt-1 w-full px-3 py-2.5 text-[16px] font-bold"
              value={plan.budget_total}
              readOnly={readOnly}
              placeholder="Ví dụ 300.000.000"
              ariaLabel="Tổng ngân sách"
              onCommit={(n) => onOp({ op: "set_budget_total", amount: n })}
            />
          </label>
          <div className="tnum flex min-w-0 flex-wrap gap-x-5 gap-y-1 pb-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
            <span className="whitespace-nowrap">Dự kiến <b style={{ color: "var(--tx)" }}>{vnd(money.estimate)}</b></span>
            <span className="whitespace-nowrap">Đã trả <b style={{ color: "var(--tx)" }}>{vnd(money.paid)}</b></span>
            {money.left !== null && (
              <span className="whitespace-nowrap" style={{ color: money.over ? "var(--rd)" : "var(--gn)" }}>
                {money.over ? "Vượt" : "Còn lại"} <b>{vnd(Math.abs(money.left))}</b>
              </span>
            )}
          </div>
        </div>
        {plan.budget_total > 0 && <ProgressBar pct={money.pct} color={money.over ? "var(--rd)" : "var(--ac)"} height={6} className="mt-3" />}
      </section>

      <section className="rounded-[16px] px-5 pb-2 pt-4" style={card}>
        <div className="hidden items-center gap-2 pb-2 text-[11px] font-bold uppercase sm:flex" style={{ letterSpacing: ".5px", color: "var(--tx3)" }}>
          <span className="flex-1">Khoản chi</span>
          <span className="w-[132px]">Dự kiến</span>
          <span className="w-[132px]">Đã trả</span>
          <span className="w-[30px]" />
        </div>

        {data.studio_line && (
          <div className={BUDGET_ROW} style={{ borderColor: "var(--bd2)" }}>
            <div className="min-w-0 flex-1 basis-[200px]">
              <CatChip cat="photo" extra="Từ hợp đồng" />
              <p className="mt-1 text-[14px] font-semibold">{data.studio_line.name}</p>
            </div>
            <div className="tnum flex w-full flex-none gap-2 text-[13.5px] font-semibold sm:w-auto">
              <span className="flex-1 sm:w-[132px] sm:flex-none"><MobileLabel>Dự kiến</MobileLabel>{vnd(data.studio_line.estimate)}</span>
              <span className="flex-1 sm:w-[132px] sm:flex-none"><MobileLabel>Đã trả</MobileLabel>{vnd(data.studio_line.paid)}</span>
            </div>
            <span className="hidden w-[30px] sm:block" />
          </div>
        )}

        {plan.budget.map((l) => (
          <div key={l.id} className={BUDGET_ROW} style={{ borderColor: "var(--bd2)" }}>
            <div className="min-w-0 flex-1 basis-[200px]">
              <CatChip cat={l.cat} />
              <CommitInput
                className="input mt-1 w-full px-2.5 py-2 text-[14px] font-semibold"
                value={l.name}
                readOnly={readOnly}
                maxLength={120}
                ariaLabel="Tên khoản chi"
                onCommit={(v) => onOp({ op: "budget_set", id: l.id, name: v })}
              />
            </div>
            {!readOnly && (
              <span className="order-2 flex-none sm:order-3">
                <ConfirmDelete label={`Xoá khoản: ${l.name}`} onConfirm={() => onOp({ op: "budget_remove", id: l.id })} />
              </span>
            )}
            <div className="order-3 flex w-full flex-none gap-2 sm:order-2 sm:w-auto">
              <label className="flex-1 sm:w-[132px] sm:flex-none">
                <MobileLabel>Dự kiến</MobileLabel>
                <MoneyField className="input w-full px-2.5 py-2" value={l.estimate} readOnly={readOnly} ariaLabel="Dự kiến" onCommit={(n) => onOp({ op: "budget_set", id: l.id, estimate: n })} />
              </label>
              <label className="flex-1 sm:w-[132px] sm:flex-none">
                <MobileLabel>Đã trả</MobileLabel>
                <MoneyField className="input w-full px-2.5 py-2" value={l.paid} readOnly={readOnly} ariaLabel="Đã trả" onCommit={(n) => onOp({ op: "budget_set", id: l.id, paid: n })} />
              </label>
            </div>
          </div>
        ))}
      </section>

      {!readOnly && (
        <form onSubmit={add} className="flex flex-wrap gap-2 rounded-[16px] px-4 py-3.5" style={card}>
          <select className="input w-auto flex-none px-3 py-2.5" value={cat} onChange={(e) => setCat(e.target.value as BudgetCat)} aria-label="Nhóm chi">
            {BUDGET_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Khoản chi mới…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <MoneyField className="input w-[150px] flex-none px-3 py-2.5" value={estimate} placeholder="Dự kiến" ariaLabel="Dự kiến" onCommit={setEstimate} live />
          <button type="submit" disabled={!name.trim() && cat === "other"} className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--ac)", color: "#fff" }}>
            <Plus size={15} /> Thêm
          </button>
        </form>
      )}
    </div>
  );
}

/** Vạch kẻ giữa các dòng. Trên điện thoại hàng tiêu đề cột bị ẩn, nên dòng đầu
 *  (con thứ 2 của thẻ) bỏ vạch trên — không thì thẻ mở đầu bằng một vạch trơ. */
const BUDGET_ROW = "flex flex-wrap items-end gap-2 border-t py-3 max-sm:[&:nth-child(2)]:border-t-0";

function CatChip({ cat, extra }: { cat: string; extra?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--tx3)" }}>
      {budgetCatLabel(cat)}
      {extra && (
        <span className="rounded-[20px] px-2 py-[1px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>{extra}</span>
      )}
    </span>
  );
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11px] font-bold sm:hidden" style={{ color: "var(--tx3)" }}>{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lịch trình ngày cưới
   ═══════════════════════════════════════════════════════════════════════════ */

function DayTab({
  plan, rows, data, readOnly, onOp,
}: { plan: WeddingPlanData; rows: DayRow[]; data: PlannerPayload; readOnly: boolean; onOp: (op: PlanOp) => void }) {
  const [time, setTime] = useState("");
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onOp({ op: "day_add", id: newPlanId(), time, title, place });
    setTitle("");
    setPlace("");
    setTime("");
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
        {plan.wedding_date ? `Ngày ${fmtDate(plan.wedding_date)}. ` : ""}
        {data.studio_name} và ê-kíp đọc lịch trình này để có mặt đúng giờ — giờ nào chưa chốt thì để trống.
      </p>

      <section className="rounded-[16px] px-5 pb-2 pt-3" style={card}>
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[13.5px] font-semibold">Chưa có lịch trình ngày cưới</p>
            <p className="mx-auto mt-1 max-w-[420px] text-[12.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
              Bắt đầu từ lịch trình mẫu (lễ vu quy, rước dâu, lễ thành hôn, tiệc tối) rồi sửa giờ cho khớp với gia đình bạn.
            </p>
            {!readOnly && (
              <button onClick={() => onOp({ op: "day_template" })} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Sparkles size={15} /> Dùng lịch trình mẫu
              </button>
            )}
          </div>
        ) : (
          <ul>
            {rows.map((r, i) =>
              editing === r.id && !r.studio ? (
                <DayEditRow key={r.id} r={r} first={i === 0} onDone={() => setEditing(null)} onOp={onOp} />
              ) : (
                <li key={r.id} className="flex items-start gap-3 py-3" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                  <span className="tnum w-[52px] flex-none pt-[1px] text-[15px] font-bold" style={{ color: r.time ? "var(--tx)" : "var(--tx3)", letterSpacing: "-.3px" }}>
                    {r.time || "--:--"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold" style={{ textWrap: "pretty" }}>
                      {r.title}
                      {r.studio && (
                        <span className="ml-2 inline-block rounded-[20px] px-2 py-[1px] align-[1px] text-[10.5px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                          {data.studio_name} xếp
                        </span>
                      )}
                    </p>
                    {(r.place || r.who) && (
                      <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
                        {r.place && <span className="flex items-start gap-1"><MapPin size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.place}</span>}
                        {r.who && <span className="flex items-start gap-1"><UserRound size={13} className="mt-[3px] flex-none" style={{ color: "var(--tx3)" }} /> {r.who}</span>}
                      </p>
                    )}
                  </div>
                  {!readOnly && !r.studio && (
                    <span className="flex flex-none items-center gap-0.5">
                      <button onClick={() => setEditing(r.id)} aria-label={`Sửa: ${r.title}`} className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ color: "var(--tx3)" }}>
                        <Pencil size={15} />
                      </button>
                      <ConfirmDelete label={`Xoá: ${r.title}`} onConfirm={() => onOp({ op: "day_remove", id: r.id })} />
                    </span>
                  )}
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {!readOnly && (
        <form onSubmit={add} className="flex flex-wrap gap-2 rounded-[16px] px-4 py-3.5" style={card}>
          <TimeInput className="input w-[84px] flex-none px-3 py-2.5 text-center" value={time} onChange={setTime} ariaLabel="Giờ" />
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Việc gì? (vd. Nhà trai đến xin dâu)" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <input className="input w-auto min-w-[140px] flex-1 px-3 py-2.5 sm:max-w-[200px]" placeholder="Ở đâu?" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
          <button type="submit" disabled={!title.trim()} className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--ac)", color: "#fff" }}>
            <Plus size={15} /> Thêm
          </button>
        </form>
      )}
    </div>
  );
}

function DayEditRow({ r, first, onDone, onOp }: { r: DayRow; first: boolean; onDone: () => void; onOp: (op: PlanOp) => void }) {
  const [time, setTime] = useState(r.time);
  const [title, setTitle] = useState(r.title);
  const [place, setPlace] = useState(r.place ?? "");
  const [who, setWho] = useState(r.who ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onOp({ op: "day_set", id: r.id, time, title, place, who });
    onDone();
  }

  return (
    <li className="py-3" style={first ? undefined : { borderTop: "1px solid var(--bd2)" }}>
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <TimeInput className="input w-[84px] flex-none px-3 py-2 text-center" value={time} onChange={setTime} ariaLabel="Giờ" />
        <input className="input w-auto min-w-[180px] flex-1 px-3 py-2" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} aria-label="Việc" autoFocus />
        <input className="input w-auto min-w-[140px] flex-1 px-3 py-2" placeholder="Ở đâu?" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} />
        <input className="input w-auto min-w-[140px] flex-1 px-3 py-2" placeholder="Ai phụ trách?" value={who} maxLength={120} onChange={(e) => setWho(e.target.value)} />
        <div className="flex flex-none gap-2">
          <button type="button" onClick={onDone} className="rounded-[10px] px-3 py-2 text-[13px] font-semibold" style={{ color: "var(--tx2)" }}>Huỷ</button>
          <button type="submit" disabled={!title.trim()} className="rounded-[10px] px-4 py-2 text-[13px] font-bold disabled:opacity-50" style={{ background: "var(--ac)", color: "#fff" }}>Lưu</button>
        </div>
      </form>
    </li>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ô nhập dùng chung
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ô chữ lưu khi RỜI ô (hoặc Enter), không lưu từng phím: mỗi phím một lượt ghi
 * lên máy chủ thì gõ một tên khoản chi là hai chục lượt ghi.
 */
function CommitInput({
  value, onCommit, className, readOnly, maxLength, ariaLabel,
}: { value: string; onCommit: (v: string) => void; className?: string; readOnly?: boolean; maxLength?: number; ariaLabel?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft);
  };
  return (
    <input
      className={className}
      value={draft}
      readOnly={readOnly}
      maxLength={maxLength}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/**
 * Ô tiền có dấu chấm hàng nghìn (1.500.000), lưu khi rời ô như CommitInput.
 * `live` = báo lên từng phím (ô của form thêm mới, chưa lưu gì).
 */
function MoneyField({
  value, onCommit, className, readOnly, placeholder, ariaLabel, live = false,
}: {
  value: number;
  onCommit: (n: number) => void;
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  live?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      className={`tnum ${className ?? ""}`}
      value={draft > 0 ? draft.toLocaleString("vi-VN") : ""}
      placeholder={placeholder ?? "0"}
      readOnly={readOnly}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/\D/g, "")) || 0;
        setDraft(n);
        if (live) onCommit(n);
      }}
      onBlur={() => { if (!live && draft !== value) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !live) (e.target as HTMLInputElement).blur(); }}
    />
  );
}

/** Nút xoá hai chạm: chạm lần đầu đổi thành "Xoá?", chạm lần nữa mới xoá. */
function ConfirmDelete({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      type="button"
      aria-label={armed ? `Chạm lần nữa để xoá — ${label}` : label}
      onClick={() => {
        if (armed) {
          if (timer.current) clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
      }}
      className="flex h-[30px] min-w-[30px] flex-none items-center justify-center rounded-[8px] px-1.5 text-[12px] font-bold"
      style={armed ? { background: "var(--rdS)", color: "var(--rd)" } : { color: "var(--tx3)" }}
    >
      {armed ? "Xoá?" : <Trash2 size={15} />}
    </button>
  );
}
