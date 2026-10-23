"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import DateInput from "@/components/DateInput";
import { ProgressBar } from "@/components/studio/ui";
import { fmtDayMonth } from "@/lib/date";
import { vnd } from "@/lib/types";
import {
  BUDGET_CATS, PAYER_LABEL, budgetCatLabel, budgetSummary, guestSummary, lineCost, payerBreakdown,
  type BudgetCat, type Payer, type PlanBudgetLine,
} from "@/lib/wedding-plan";
import {
  AddForm, Field, GhostBtn, MoneyField, Pill, PrimaryBtn, RowActions, Section, Select, listOps, rowLine, type Ctx,
} from "../ui";

const CAT_OPTIONS = BUDGET_CATS.map((c) => [c.key, c.label] as [BudgetCat, string]);

/**
 * NGÂN SÁCH — mỗi khoản có dự kiến, giá đã chốt (thực tế), đã trả, người chi và
 * hạn trả phần còn lại. Tổng tính theo "chi phí" = giá chốt nếu có, không thì dự
 * kiến; "còn nợ" cộng từng khoản (khoản trả dư không bù khoản khác).
 */
export default function BudgetTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const money = budgetSummary(plan.budget, data.studio_line, plan.budget_total);
  const payers = payerBreakdown(plan.budget);
  const people = plan.guests.length ? guestSummary(plan.guests, ctx.replies).people : plan.settings.guests_expected;
  const [editing, setEditing] = useState<string | null>(null);
  const [cat, setCat] = useState<BudgetCat>("other");
  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState(0);

  const dueSoon = [...plan.budget]
    .filter((l) => lineCost(l) - l.paid > 0 && l.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-3.5">
      <section className="rounded-[16px] px-5 py-[18px]" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
        <label className="block max-w-[340px]">
          <span className="text-[12px] font-bold" style={{ color: "var(--tx3)" }}>Ngân sách mục tiêu cho đám cưới</span>
          <MoneyField
            className="input mt-1 w-full px-3 py-2.5 text-[16px] font-bold"
            value={plan.budget_total}
            readOnly={readOnly}
            placeholder="Ví dụ 300.000.000"
            ariaLabel="Ngân sách mục tiêu"
            onCommit={(n) => onOp({ op: "set_budget_total", amount: n })}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 min-[600px]:grid-cols-4">
          <Figure label="Dự kiến" value={vnd(money.estimate)} />
          <Figure label="Đã chốt (thực tế)" value={vnd(money.actual)} />
          <Figure label="Đã trả" value={vnd(money.paid)} color="var(--gn)" />
          <Figure label="Còn phải trả" value={vnd(money.owed)} color={money.owed ? "var(--am)" : undefined} />
        </div>
        {plan.budget_total > 0 && (
          <>
            <ProgressBar pct={money.pct} color={money.over ? "var(--rd)" : "var(--ac)"} height={6} className="mt-3" />
            <p className="tnum mt-1.5 text-[12.5px] font-semibold" style={{ color: money.over ? "var(--rd)" : "var(--gn)" }}>
              {money.over ? `Vượt ngân sách ${vnd(-(money.left ?? 0))}` : `Còn lại ${vnd(money.left ?? 0)}`} · chi phí dự tính {vnd(money.cost)}
            </p>
          </>
        )}
        {people > 0 && money.cost > 0 && (
          <p className="tnum mt-1 text-[12px]" style={{ color: "var(--tx3)" }}>
            ≈ {vnd(Math.round(money.cost / people))} mỗi khách ({people} khách)
          </p>
        )}
      </section>

      {(payers.length > 0 || dueSoon.length > 0) && (
        <div className="grid grid-cols-1 gap-3.5 min-[760px]:grid-cols-2">
          {payers.length > 0 && (
            <Section title="Ai chi bao nhiêu">
              <ul className="mt-2 flex flex-col gap-2 pb-1">
                {payers.map((p) => (
                  <li key={p.payer}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold">{p.payer === "none" ? "Chưa phân" : PAYER_LABEL[p.payer]}</span>
                      <span className="tnum" style={{ color: "var(--tx2)" }}>{vnd(p.amount)} · {p.pct}%</span>
                    </div>
                    <ProgressBar pct={p.pct} height={5} color={p.payer === "none" ? "var(--tx3)" : "var(--ac)"} className="mt-1" />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {dueSoon.length > 0 && (
            <Section title="Thanh toán sắp tới">
              <ul className="mt-1">
                {dueSoon.map((l, i) => (
                  <li key={l.id} className="flex items-center gap-2 py-2 text-[13px]" style={rowLine(i)}>
                    <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                    <span className="tnum flex-none" style={{ color: "var(--tx2)" }}>{vnd(lineCost(l) - l.paid)}</span>
                    <Pill tone={l.due! < today ? "rd" : "am"}>{fmtDayMonth(l.due)}</Pill>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      <Section title="Các khoản chi" sub="Ghi giá đã chốt khi ký với bên cung cấp — tổng sẽ tính theo giá chốt thay cho dự kiến.">
        <ul className="mt-2">
          {data.studio_line && (
            <li className="py-3">
              <LineView
                cat="photo"
                name={data.studio_line.name}
                estimate={data.studio_line.estimate}
                actual={data.studio_line.estimate}
                paid={data.studio_line.paid}
                due={data.studio_line.due ?? undefined}
                today={today}
                extra={<Pill tone="ac">Từ hợp đồng</Pill>}
              />
            </li>
          )}
          {plan.budget.map((l, i) => (
            <li key={l.id} className="py-3" style={data.studio_line || i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
              {editing === l.id ? (
                <LineEdit l={l} onDone={() => setEditing(null)} onSave={(patch) => ops.set("budget", l.id, patch)} />
              ) : (
                <LineView
                  cat={l.cat}
                  name={l.name}
                  estimate={l.estimate}
                  actual={l.actual}
                  paid={l.paid}
                  due={l.due}
                  payer={l.payer}
                  note={l.note}
                  today={today}
                  actions={!readOnly && <RowActions label={l.name} onEdit={() => setEditing(l.id)} onRemove={() => ops.remove("budget", l.id)} />}
                />
              )}
            </li>
          ))}
        </ul>
      </Section>

      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!name.trim() && cat === "other") return;
            ops.add("budget", { cat, name, estimate });
            setName("");
            setEstimate(0);
          }}
        >
          <Select value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} ariaLabel="Hạng mục" />
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Khoản chi mới…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <MoneyField className="input w-[150px] flex-none px-3 py-2.5" value={estimate} placeholder="Dự kiến" ariaLabel="Dự kiến" onCommit={setEstimate} live />
          <PrimaryBtn disabled={!name.trim() && cat === "other"}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </div>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>{label}</p>
      <p className="tnum truncate text-[15px] font-bold" style={{ color: color ?? "var(--tx)" }}>{value}</p>
    </div>
  );
}

function LineView({
  cat, name, estimate, actual, paid, due, payer, note, today, extra, actions,
}: {
  cat: string;
  name: string;
  estimate: number;
  actual: number;
  paid: number;
  due?: string;
  payer?: Payer;
  note?: string;
  today: string;
  extra?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const cost = actual > 0 ? actual : estimate;
  const owed = Math.max(0, cost - paid);
  return (
    <div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--tx3)" }}>
            {budgetCatLabel(cat)} {extra}
          </span>
          <p className="mt-0.5 text-[14px] font-semibold" style={{ textWrap: "pretty" }}>{name}</p>
        </div>
        {actions}
      </div>
      <p className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
        <span className="whitespace-nowrap">Dự kiến <b style={{ color: "var(--tx)" }}>{estimate ? vnd(estimate) : "—"}</b></span>
        <span className="whitespace-nowrap">Đã chốt <b style={{ color: "var(--tx)" }}>{actual ? vnd(actual) : "—"}</b></span>
        <span className="whitespace-nowrap">Đã trả <b style={{ color: "var(--gn)" }}>{vnd(paid)}</b></span>
      </p>
      {cost > 0 && <ProgressBar pct={(paid / cost) * 100} height={4} color={owed ? "var(--ac)" : "var(--gn)"} className="mt-1.5" />}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
        {cost > 0 && owed === 0 && <Pill tone="gn">Đã trả đủ</Pill>}
        {owed > 0 && <Pill tone="am">Còn {vnd(owed)}</Pill>}
        {owed > 0 && due && <Pill tone={due < today ? "rd" : "nu"}>Hạn {fmtDayMonth(due)}</Pill>}
        {actual > 0 && estimate > 0 && actual > estimate && <Pill tone="rd">Vượt dự kiến {vnd(actual - estimate)}</Pill>}
        {payer && <Pill tone="bl">{PAYER_LABEL[payer]} chi</Pill>}
      </div>
      {note && <p className="mt-1 whitespace-pre-line text-[12px]" style={{ color: "var(--tx2)" }}>{note}</p>}
    </div>
  );
}

function LineEdit({ l, onDone, onSave }: { l: PlanBudgetLine; onDone: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [cat, setCat] = useState<BudgetCat>(l.cat);
  const [name, setName] = useState(l.name);
  const [estimate, setEstimate] = useState(l.estimate);
  const [actual, setActual] = useState(l.actual);
  const [paid, setPaid] = useState(l.paid);
  const [payer, setPayer] = useState<Payer | "">(l.payer ?? "");
  const [due, setDue] = useState(l.due ?? "");
  const [note, setNote] = useState(l.note ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ cat, name, estimate, actual, paid, payer, due, note });
        onDone();
      }}
      className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3"
    >
      <Field label="Hạng mục">
        <Select value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} className="w-full" />
      </Field>
      <Field label="Tên khoản" className="min-[640px]:col-span-2">
        <input className="input px-3 py-2.5" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Dự kiến">
        <MoneyField className="input w-full px-3 py-2.5" value={estimate} onCommit={setEstimate} live />
      </Field>
      <Field label="Đã chốt (thực tế)">
        <MoneyField className="input w-full px-3 py-2.5" value={actual} onCommit={setActual} live />
      </Field>
      <Field label="Đã trả">
        <MoneyField className="input w-full px-3 py-2.5" value={paid} onCommit={setPaid} live />
      </Field>
      <Field label="Ai chi">
        <Select value={payer} options={PAYER_LABEL} onChange={setPayer} empty="Chưa phân" className="w-full" />
      </Field>
      <Field label="Hạn trả phần còn lại" className="col-span-2 min-[640px]:col-span-2">
        <DateInput value={due} onChange={setDue} allowPast />
      </Field>
      <Field label="Ghi chú" className="col-span-2 min-[640px]:col-span-3">
        <textarea className="input px-3 py-2.5" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Đã cọc bao nhiêu, ai liên hệ, điều khoản…" />
      </Field>
      <div className="col-span-2 flex justify-end gap-2 min-[640px]:col-span-3">
        <GhostBtn onClick={onDone}>Huỷ</GhostBtn>
        <PrimaryBtn>Lưu</PrimaryBtn>
      </div>
    </form>
  );
}
