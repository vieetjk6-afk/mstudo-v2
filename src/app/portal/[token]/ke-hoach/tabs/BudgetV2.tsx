"use client";

import { useState } from "react";
import { CalendarClock, Plus, Receipt, Users, Wallet } from "lucide-react";
import DateInput from "@/components/DateInput";
import { Badge, Card, Field, PageHead, Progress, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { fmtDayMonth } from "@/lib/date";
import { vnd } from "@/lib/types";
import {
  BUDGET_CATS, PAYER_LABEL, budgetCatLabel, budgetSummary, guestSummary, lineCost, payerBreakdown,
  type BudgetCat, type Payer, type PlanBudgetLine,
} from "@/lib/wedding-plan";
import { MoneyField, listOps, type Ctx } from "../ui";
import { DateChip, FormDrawer, RowMenu, SelectV2 } from "../uiV2";

const CAT_OPTIONS = BUDGET_CATS.map((c) => [c.key, c.label] as [BudgetCat, string]);

/**
 * NGÂN SÁCH (giao diện mới) — thẻ tóm tắt (mục tiêu sửa tại chỗ, bốn con số,
 * thanh dùng ngân sách), "Ai chi bao nhiêu" + "Thanh toán sắp tới", rồi các
 * khoản chi: bảng trên máy tính, danh sách trên điện thoại. Thêm / sửa mở
 * ngăn kéo. Cùng phép tính và thao tác với tabs/Budget.tsx.
 */
export default function BudgetTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, today, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const money = budgetSummary(plan.budget, data.studio_line, plan.budget_total);
  const payers = payerBreakdown(plan.budget);
  const people = plan.guests.length ? guestSummary(plan.guests, ctx.replies).people : plan.settings.guests_expected;
  const [editing, setEditing] = useState<PlanBudgetLine | null>(null);
  const [adding, setAdding] = useState(false);

  const dueSoon = [...plan.budget]
    .filter((l) => lineCost(l) - l.paid > 0 && l.due)
    .sort((a, b) => (a.due! < b.due! ? -1 : 1))
    .slice(0, 5);

  return (
    <Stack>
      <PageHead
        desc="Ghi giá đã chốt khi ký với bên cung cấp — tổng sẽ tính theo giá chốt thay cho dự kiến."
        actions={!readOnly && (
          <button type="button" onClick={() => setAdding(true)} className={btn("primary")}>
            <Plus size={16} /> Thêm khoản chi
          </button>
        )}
      />

      {/* ── Tóm tắt ─────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Field label="Ngân sách mục tiêu" className="w-full max-w-[300px]">
            <MoneyField
              className={`${inputCls} !h-11 text-[16px] font-semibold`}
              value={plan.budget_total}
              readOnly={readOnly}
              placeholder="Ví dụ 300.000.000"
              ariaLabel="Ngân sách mục tiêu"
              onCommit={(n) => onOp({ op: "set_budget_total", amount: n })}
            />
          </Field>
          {plan.budget_total > 0 && (
            <div className="min-w-[220px] flex-1 pb-1">
              <p className="tnum text-[13.5px] font-semibold" style={{ color: money.over ? "var(--rd)" : "var(--gn)" }}>
                {money.over ? `Vượt ngân sách ${vnd(-(money.left ?? 0))}` : `Còn lại ${vnd(money.left ?? 0)}`}
                <span className="font-normal" style={{ color: "var(--tx3)" }}> · chi phí dự tính {vnd(money.cost)}</span>
              </p>
              <div className="mt-2"><Progress value={money.pct} tone={money.over ? "red" : "brand"} /></div>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4" style={{ borderColor: "var(--bd2)" }}>
          <Figure label="Dự kiến" value={vnd(money.estimate)} />
          <Figure label="Đã chốt (thực tế)" value={vnd(money.actual)} />
          <Figure label="Đã trả" value={vnd(money.paid)} color="var(--gn)" />
          <Figure label="Còn phải trả" value={vnd(money.owed)} color={money.owed ? "var(--am)" : undefined} />
        </div>
        {people > 0 && money.cost > 0 && (
          <p className="tnum mt-3 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <Users size={14} /> ≈ {vnd(Math.round(money.cost / people))} mỗi khách ({people} khách)
          </p>
        )}
      </Card>

      {(payers.length > 0 || dueSoon.length > 0) && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {payers.length > 0 && (
            <Section title="Ai chi bao nhiêu" icon={Wallet}>
              <ul className="flex flex-col gap-3">
                {payers.map((p) => (
                  <li key={p.payer}>
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium">{p.payer === "none" ? "Chưa phân" : PAYER_LABEL[p.payer]}</span>
                      <span className="tnum" style={{ color: "var(--tx2)" }}>{vnd(p.amount)} · {p.pct}%</span>
                    </div>
                    <div className="mt-1.5"><Progress value={p.pct} tone={p.payer === "none" ? "gray" : "brand"} /></div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {dueSoon.length > 0 && (
            <Section title="Thanh toán sắp tới" icon={CalendarClock} flush>
              {dueSoon.map((l) => {
                const late = l.due! < today;
                return (
                  <div key={l.id} className="v2-row">
                    <DateChip date={l.due!} tone={late ? "red" : "amber"} />
                    <div className="min-w-0 flex-1">
                      <p className="v2-row-title">{l.name}</p>
                      <p className="v2-row-sub" style={late ? { color: "var(--rd)" } : undefined}>{late ? "Quá hạn" : `Hạn ${fmtDayMonth(l.due)}`}</p>
                    </div>
                    <span className="tnum flex-none text-[14px] font-semibold">{vnd(lineCost(l) - l.paid)}</span>
                  </div>
                );
              })}
            </Section>
          )}
        </div>
      )}

      {/* ── Các khoản chi ───────────────────────────────────────────────── */}
      <Section title="Các khoản chi" desc={`${plan.budget.length + (data.studio_line ? 1 : 0)} khoản`} icon={Receipt} flush>
        {/* Máy tính: bảng */}
        <div className="v2-table-wrap hidden md:block">
          <table className="v2-table">
            <thead>
              <tr>
                <th>Khoản chi</th>
                <th className="num">Dự kiến</th>
                <th className="num">Đã chốt</th>
                <th className="num">Đã trả</th>
                <th className="num">Còn phải trả</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {data.studio_line && (
                <LineTr
                  cat="photo" name={data.studio_line.name} estimate={data.studio_line.estimate} actual={data.studio_line.estimate}
                  paid={data.studio_line.paid} due={data.studio_line.due ?? undefined} today={today} extra={<Badge tone="brand">Từ hợp đồng</Badge>}
                />
              )}
              {plan.budget.map((l) => (
                <LineTr
                  key={l.id}
                  cat={l.cat} name={l.name} estimate={l.estimate} actual={l.actual} paid={l.paid} due={l.due} payer={l.payer} note={l.note} today={today}
                  onEdit={readOnly ? undefined : () => setEditing(l)}
                  actions={!readOnly && <RowMenu label={l.name} onEdit={() => setEditing(l)} onRemove={() => ops.remove("budget", l.id)} />}
                />
              ))}
            </tbody>
          </table>
        </div>
        {/* Điện thoại: danh sách */}
        <div className="md:hidden">
          {data.studio_line && (
            <LineRow
              cat="photo" name={data.studio_line.name} estimate={data.studio_line.estimate} actual={data.studio_line.estimate}
              paid={data.studio_line.paid} due={data.studio_line.due ?? undefined} today={today} extra={<Badge tone="brand">Từ hợp đồng</Badge>}
            />
          )}
          {plan.budget.map((l) => (
            <LineRow
              key={l.id}
              cat={l.cat} name={l.name} estimate={l.estimate} actual={l.actual} paid={l.paid} due={l.due} payer={l.payer} note={l.note} today={today}
              onEdit={readOnly ? undefined : () => setEditing(l)}
              actions={!readOnly && <RowMenu label={l.name} onEdit={() => setEditing(l)} onRemove={() => ops.remove("budget", l.id)} />}
            />
          ))}
        </div>
      </Section>

      {adding && <LineAdd onClose={() => setAdding(false)} onAdd={(item) => ops.add("budget", item)} />}
      {editing && (
        <LineEdit l={editing} onClose={() => setEditing(null)} onSave={(patch) => ops.set("budget", editing.id, patch)} onRemove={() => ops.remove("budget", editing.id)} />
      )}
    </Stack>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>{label}</p>
      <p className="tnum mt-0.5 truncate text-[16px] font-semibold" style={{ color: color ?? "var(--tx)" }}>{value}</p>
    </div>
  );
}

type LineProps = {
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
  onEdit?: () => void;
};

function lineState({ estimate, actual, paid }: { estimate: number; actual: number; paid: number }) {
  const cost = actual > 0 ? actual : estimate;
  return { cost, owed: Math.max(0, cost - paid) };
}

function LineBadges({ estimate, actual, paid, due, payer, today }: LineProps) {
  const { cost, owed } = lineState({ estimate, actual, paid });
  return (
    <>
      {cost > 0 && owed === 0 && <Badge tone="green">Đã trả đủ</Badge>}
      {owed > 0 && due && <Badge tone={due < today ? "red" : "gray"}>Hạn {fmtDayMonth(due)}</Badge>}
      {actual > 0 && estimate > 0 && actual > estimate && <Badge tone="red">Vượt dự kiến {vnd(actual - estimate)}</Badge>}
      {payer && <Badge tone="blue">{PAYER_LABEL[payer]} chi</Badge>}
    </>
  );
}

function LineName(p: LineProps) {
  const title = <span className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{p.name}</span>;
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>{budgetCatLabel(p.cat)} {p.extra}</p>
      {p.onEdit ? <button type="button" onClick={p.onEdit} className="mt-0.5 block text-left">{title}</button> : <p className="mt-0.5">{title}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden"><LineBadges {...p} /></div>
      {p.note && <p className="mt-1 whitespace-pre-line text-[12.5px]" style={{ color: "var(--tx2)" }}>{p.note}</p>}
    </div>
  );
}

function LineTr(p: LineProps) {
  const { owed } = lineState(p);
  return (
    <tr>
      <td className="min-w-[260px]"><LineName {...p} /></td>
      <td className="num" style={{ color: "var(--tx2)" }}>{p.estimate ? vnd(p.estimate) : "—"}</td>
      <td className="num">{p.actual ? vnd(p.actual) : "—"}</td>
      <td className="num" style={{ color: p.paid ? "var(--gn)" : "var(--tx3)" }}>{p.paid ? vnd(p.paid) : "—"}</td>
      <td className="num font-semibold" style={{ color: owed ? "var(--am)" : "var(--tx3)" }}>{owed ? vnd(owed) : "—"}</td>
      <td className="w-[52px] text-right">{p.actions}</td>
    </tr>
  );
}

function LineRow(p: LineProps) {
  const { cost, owed } = lineState(p);
  return (
    <div className="v2-row items-start">
      <div className="min-w-0 flex-1">
        <LineName {...p} />
        <p className="tnum mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px]" style={{ color: "var(--tx2)" }}>
          <span className="whitespace-nowrap">Dự kiến <b style={{ color: "var(--tx)" }}>{p.estimate ? vnd(p.estimate) : "—"}</b></span>
          <span className="whitespace-nowrap">Đã chốt <b style={{ color: "var(--tx)" }}>{p.actual ? vnd(p.actual) : "—"}</b></span>
          <span className="whitespace-nowrap">Đã trả <b style={{ color: "var(--gn)" }}>{vnd(p.paid)}</b></span>
          {owed > 0 && <span className="whitespace-nowrap">Còn <b style={{ color: "var(--am)" }}>{vnd(owed)}</b></span>}
        </p>
        {cost > 0 && <div className="mt-2"><Progress value={(p.paid / cost) * 100} tone={owed ? "brand" : "green"} /></div>}
      </div>
      {p.actions}
    </div>
  );
}

function LineAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Record<string, unknown>) => void }) {
  const [cat, setCat] = useState<BudgetCat>("other");
  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState(0);
  const ok = !!name.trim() || cat !== "other";
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm khoản chi"
      desc="Ghi số dự kiến trước — khi chốt với bên cung cấp thì sửa lại giá chốt và số đã trả."
      submitLabel="Thêm khoản chi"
      canSubmit={ok}
      onSubmit={() => {
        onAdd({ cat, name, estimate });
        onClose();
      }}
    >
      <Field label="Hạng mục">
        <SelectV2 value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} ariaLabel="Hạng mục" />
      </Field>
      <Field label="Dự kiến">
        <MoneyField className={inputCls} value={estimate} placeholder="0" ariaLabel="Dự kiến" onCommit={setEstimate} live />
      </Field>
      <Field label="Tên khoản" hint={cat !== "other" ? "Bỏ trống thì dùng tên hạng mục." : undefined} className="sm:col-span-2">
        <input className={inputCls} placeholder="Khoản chi mới…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </FormDrawer>
  );
}

function LineEdit({ l, onClose, onSave, onRemove }: { l: PlanBudgetLine; onClose: () => void; onSave: (patch: Record<string, unknown>) => void; onRemove: () => void }) {
  const [cat, setCat] = useState<BudgetCat>(l.cat);
  const [name, setName] = useState(l.name);
  const [estimate, setEstimate] = useState(l.estimate);
  const [actual, setActual] = useState(l.actual);
  const [paid, setPaid] = useState(l.paid);
  const [payer, setPayer] = useState<Payer | "">(l.payer ?? "");
  const [due, setDue] = useState(l.due ?? "");
  const [note, setNote] = useState(l.note ?? "");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Sửa khoản chi"
      onRemove={onRemove}
      onSubmit={() => {
        onSave({ cat, name, estimate, actual, paid, payer, due, note });
        onClose();
      }}
    >
      <Field label="Hạng mục">
        <SelectV2 value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} ariaLabel="Hạng mục" />
      </Field>
      <Field label="Tên khoản">
        <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Dự kiến">
        <MoneyField className={inputCls} value={estimate} onCommit={setEstimate} live ariaLabel="Dự kiến" />
      </Field>
      <Field label="Đã chốt (thực tế)">
        <MoneyField className={inputCls} value={actual} onCommit={setActual} live ariaLabel="Đã chốt" />
      </Field>
      <Field label="Đã trả">
        <MoneyField className={inputCls} value={paid} onCommit={setPaid} live ariaLabel="Đã trả" />
      </Field>
      <Field label="Ai chi">
        <SelectV2 value={payer} options={PAYER_LABEL} onChange={setPayer} empty="Chưa phân" ariaLabel="Ai chi" />
      </Field>
      <Field label="Hạn trả phần còn lại" className="sm:col-span-2">
        <DateInput value={due} onChange={setDue} allowPast className={inputCls} />
      </Field>
      <Field label="Ghi chú" className="sm:col-span-2">
        <textarea className={inputCls} rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Đã cọc bao nhiêu, ai liên hệ, điều khoản…" />
      </Field>
    </FormDrawer>
  );
}
