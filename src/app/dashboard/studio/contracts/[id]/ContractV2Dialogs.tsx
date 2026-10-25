"use client";

import { useState } from "react";
import { AlertTriangle, Banknote, Check, CircleDollarSign, Landmark, Plus, QrCode, Send, Trash2, Upload, Wand2 } from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import TimeInput from "@/components/TimeInput";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VietQR } from "@/components/VietQR";
import { Badge, Callout, Field, GroupLabel, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Modal, Switch } from "@/components/v2/kit-client";
import { CREW_STATUS_LABEL, PAYMENT_METHOD_LABEL, vnd, type CrewRole, type CrewStatus, type PaymentMethod } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { LEAD_SOURCE_LABEL } from "@/lib/lead-source";
import { crewRoleLabel, crewRolesFor } from "@/lib/crew-roles";
import { CREW_SIDE_LABEL, CREW_SIDES, CREW_TASK_LABEL, CREW_TASKS } from "@/lib/crew-show";
import { shootReminderMessage } from "@/lib/zalo";
import { QUICK_AMOUNTS, type CrewRow } from "./useContractEditor";
import { ClientLinks, CREW_TONE, ProofThumb, SendOptions, ViewedLine, mainSessionTitle, type Ed, type V2Ctx } from "./ContractV2Parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Hộp thoại & ngăn kéo dùng chung của màn chi tiết hợp đồng (giao diện mới).
   Mỗi cái chỉ được vẽ khi đang mở (nơi gọi bọc `cond && <…/>`), nên state nội
   bộ tự về mặc định ở lần mở sau. Mọi thao tác ghi đi qua useContractEditor.
   ═══════════════════════════════════════════════════════════════════════════ */

const redBorder = (bad: boolean) => (bad ? { borderColor: "var(--rd)" } : undefined);

/* ── Gửi khách ─────────────────────────────────────────────────────────── */
export function SendModal({ ed, open, onClose }: { ed: Ed; open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Send}
      title="Gửi hợp đồng cho khách"
      desc="Khách xem hợp đồng, lịch, ảnh và thanh toán trên cổng riêng. Mật khẩu là số điện thoại của khách."
      width={440}
    >
      <SendOptions ed={ed} />
      <div className="mt-4 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--bd2)" }}>
        <ViewedLine ed={ed} />
        <ClientLinks ed={ed} className="-ml-2.5" />
      </div>
      {ed.f.status === "draft" && (
        <div className="mt-3">
          <Callout
            tone="blue"
            title="Gửi xong rồi?"
            action={
              <button type="button" className={btn("secondary", "sm")} onClick={() => ed.changeStatus("sent")}>
                Chuyển sang chờ duyệt
              </button>
            }
          >
            Đổi trạng thái để nhớ là đang chờ khách xem và ký.
          </Callout>
        </div>
      )}
    </Modal>
  );
}

/* ── Sửa thông tin hợp đồng (tự lưu như bản cũ) ───────────────────────── */
export function InfoDrawer({ ed, open, onClose }: { ed: Ed; open: boolean; onClose: () => void }) {
  const { f, set, reqMissing } = ed;
  const saved = ed.contractSaved;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Thông tin hợp đồng"
      desc={saved === "saving" ? "Đang lưu…" : saved === "saved" ? "Đã lưu tự động" : "Tự động lưu khi nhập"}
      width={540}
      footer={
        <button type="button" className={btn("primary")} onClick={onClose}>
          Xong
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <GroupLabel>Khách hàng</GroupLabel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên khách *" htmlFor="ci-name" error={reqMissing.client_name ? "Cần có tên khách." : undefined}>
            <input id="ci-name" className={inputCls} style={redBorder(reqMissing.client_name)} value={f.client_name} onChange={(e) => set("client_name", e.target.value)} />
          </Field>
          <Field label="Số điện thoại *" htmlFor="ci-phone" error={reqMissing.client_phone ? "Phải đủ 10 số." : undefined}>
            <input
              id="ci-phone"
              className={inputCls}
              style={redBorder(reqMissing.client_phone)}
              inputMode="numeric"
              maxLength={15}
              placeholder="0901234567"
              value={f.client_phone}
              onChange={(e) => set("client_phone", e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor="ci-email">
            <input id="ci-email" className={inputCls} value={f.client_email} onChange={(e) => set("client_email", e.target.value)} />
          </Field>
          <Field label="Nguồn khách" htmlFor="ci-src">
            <select id="ci-src" className={inputCls} value={f.source} onChange={(e) => set("source", e.target.value)}>
              <option value="">— Chưa rõ —</option>
              {Object.keys(LEAD_SOURCE_LABEL).map((k) => (
                <option key={k} value={k}>
                  {LEAD_SOURCE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Facebook / Messenger" htmlFor="ci-fb" hint="Khách cũng có thể tự dán link này trong cổng khách." className="sm:col-span-2">
            <input id="ci-fb" className={inputCls} placeholder="m.me/… hoặc facebook.com/…" value={f.client_messenger} onChange={(e) => set("client_messenger", e.target.value)} />
          </Field>
        </div>

        <GroupLabel>Buổi chụp</GroupLabel>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
          <Field label="Ngày">
            <DateInput className={inputCls} value={f.event_date} onChange={(v) => set("event_date", v)} />
          </Field>
          <Field label="Giờ" htmlFor="ci-time">
            <input id="ci-time" className={inputCls} placeholder="08:00" value={f.event_time} onChange={(e) => set("event_time", e.target.value)} />
          </Field>
          <Field label="Địa điểm" htmlFor="ci-loc" className="sm:col-span-2">
            <input id="ci-loc" className={inputCls} value={f.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
        </div>
        {f.event_date && ed.props.contract.event_date && f.event_date !== ed.props.contract.event_date && (
          <Callout tone="blue">
            Đổi ngày ở đây chỉ sửa lại ngày. Muốn báo khách và chuyển lịch thợ theo, dùng <b>Dời lịch</b> trong menu ⋯.
          </Callout>
        )}

        <GroupLabel>Hợp đồng</GroupLabel>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="Tên hợp đồng *" htmlFor="ci-title" error={reqMissing.title ? "Cần có tên hợp đồng." : undefined}>
            <input id="ci-title" className={inputCls} style={redBorder(reqMissing.title)} value={f.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Mã hợp đồng *" htmlFor="ci-code" error={reqMissing.code ? "Cần có mã." : undefined}>
            <div className="flex gap-2">
              <input
                id="ci-code"
                className={inputCls}
                style={redBorder(reqMissing.code)}
                placeholder="HD-06-2026-001"
                value={f.code}
                onChange={(e) => set("code", e.target.value)}
              />
              {!f.code.trim() && (
                <button type="button" onClick={ed.fillCode} className={btn("secondary", "md")} title="Tạo mã tự động">
                  <Wand2 size={15} /> Tạo mã
                </button>
              )}
            </div>
          </Field>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Ghi nhận thanh toán: chọn đợt khách vừa trả + tiền mặt / chuyển khoản ── */
export function CollectModal({ ctx, planId, onClose, onOther }: { ctx: V2Ctx; planId: string | null; onClose: () => void; onOther: () => void }) {
  const { ed } = ctx;
  const unpaid = ed.plan.filter((p) => !p.paid);
  const [sel, setSel] = useState<string | null>(planId ?? unpaid[0]?.id ?? null);
  // Không chọn sẵn: tiền mặt / chuyển khoản phải do người thu chọn (đối chiếu két).
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const it = unpaid.find((p) => p.id === sel) ?? null;

  async function save() {
    if (!it || !method) return;
    setBusy(true);
    await ed.markPlanPaid(it, method);
    setBusy(false);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={CircleDollarSign}
      title="Ghi nhận thanh toán"
      desc={`Còn phải thu ${vnd(Math.max(0, ed.balance))} trên tổng ${vnd(ed.total)}.`}
      width={500}
      footer={
        <>
          <button type="button" className={btn("ghost", "md", "mr-auto")} onClick={onOther}>
            <Plus size={16} /> Khoản thu khác
          </button>
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Thôi
          </button>
          <button type="button" className={btn("primary")} disabled={!it || !method || busy} onClick={save}>
            {busy ? "Đang ghi…" : it ? `Ghi nhận ${vnd(it.amount)}` : "Ghi nhận"}
          </button>
        </>
      }
    >
      {unpaid.length === 0 ? (
        <Callout tone="blue" title="Không còn đợt nào chưa thu">
          Bấm “Khoản thu khác” để ghi một khoản mới (vd tiền phát sinh).
        </Callout>
      ) : (
        <div className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Đợt khách vừa trả" className="flex flex-col gap-2">
            {unpaid.map((p) => {
              const on = p.id === sel;
              const late = !!p.due_date && p.due_date < ed.todayStr;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSel(p.id)}
                  className="flex items-center gap-3 rounded-[12px] px-3.5 py-3 text-left"
                  style={{
                    border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                    background: on ? "var(--acS)" : "var(--sf)",
                  }}
                >
                  <span
                    className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full"
                    style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bdS, var(--bd))"}`, background: on ? "var(--ac)" : "transparent" }}
                  >
                    {on && <Check size={12} color="#fff" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.label}</span>
                    <span className="block text-[12.5px]" style={{ color: late ? "var(--rd)" : "var(--tx3)" }}>
                      {p.due_date ? `Hạn ${fmtDate(p.due_date)}${late ? " · quá hạn" : ""}` : "Chưa đặt hạn"}
                    </span>
                  </span>
                  <span className="v2-num flex-none text-[14px] font-semibold">{vnd(p.amount)}</span>
                </button>
              );
            })}
          </div>
          <MethodPicker value={method} onChange={setMethod} />
        </div>
      )}
    </Modal>
  );
}

function MethodPicker({ value, onChange }: { value: PaymentMethod | null; onChange: (m: PaymentMethod) => void }) {
  return (
    <div>
      <p className="v2-label mb-1.5">Khách trả bằng</p>
      <div className="grid grid-cols-2 gap-2">
        {(["cash", "transfer"] as const).map((m) => {
          const on = value === m;
          const Icon = m === "cash" ? Banknote : Landmark;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(m)}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] text-[13.5px] font-semibold"
              style={{
                border: `1.5px solid ${on ? "var(--gn)" : "var(--bd)"}`,
                background: on ? "var(--gnS)" : "var(--sf)",
                color: on ? "var(--gn)" : "var(--tx2)",
              }}
            >
              <Icon size={17} /> {PAYMENT_METHOD_LABEL[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Thêm đợt thanh toán (có thể ghi luôn là đã thu) ─────────────────────── */
export function AddPlanModal({ ed, paidDefault, onClose, onZoom }: { ed: Ed; paidDefault: boolean; onClose: () => void; onZoom: (u: string) => void }) {
  const { planForm, setPlanForm } = ed;
  const [paid, setPaid] = useState(paidDefault);
  const busy = ed.busy === "plan" || ed.busy === "planPaid";
  const empty = !planForm.label.trim() && !(Number(planForm.amount) > 0);
  const { depositPercent } = ed.props;

  async function save() {
    const ok = await ed.addPlan(paid);
    if (ok) onClose();
  }

  const chip = "max-w-full truncate rounded-full px-2.5 py-1 text-[12.5px] font-medium";
  return (
    <Modal
      open
      onClose={onClose}
      icon={paid ? CircleDollarSign : Plus}
      title={paid ? "Ghi một khoản đã thu" : "Thêm đợt thanh toán"}
      desc={paid ? "Ghi vào sổ thu ngay và thêm thành một đợt đã thu." : "Đặt sẵn số tiền và hạn — đến lúc khách trả thì bấm Ghi thu."}
      width={520}
      footer={
        <>
          <button type="button" className={btn("ghost")} onClick={onClose}>
            Thôi
          </button>
          <button type="button" className={btn("primary")} onClick={save} disabled={busy || empty}>
            {busy ? "Đang lưu…" : paid ? "Ghi nhận đã thu" : "Thêm đợt"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên đợt" htmlFor="pl-label">
          <input
            id="pl-label"
            className={inputCls}
            placeholder="vd: Cọc, Đợt 2, Phát sinh"
            value={planForm.label}
            onChange={(e) => setPlanForm((p) => ({ ...p, label: e.target.value }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số tiền" htmlFor="pl-amount">
            <MoneyInput className={inputCls} placeholder="0" value={planForm.amount} onChange={(n) => setPlanForm((p) => ({ ...p, amount: n }))} ariaLabel="Số tiền" />
          </Field>
          <Field label="Hạn thu">
            <DateInput className={inputCls} value={planForm.due_date} onChange={(v) => setPlanForm((p) => ({ ...p, due_date: v }))} />
          </Field>
        </div>
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {ed.plan.length === 0 && ed.total > 0 && ed.depositAmt > 0 && (
            <button
              type="button"
              className={chip}
              style={{ background: "var(--acS)", color: "var(--ac)" }}
              onClick={() => setPlanForm((p) => ({ ...p, label: "Cọc hợp đồng", amount: ed.depositAmt }))}
            >
              Cọc {depositPercent}% · {vnd(ed.depositAmt)}
            </button>
          )}
          {ed.balance > 0 && (
            <button type="button" className={chip} style={{ background: "var(--acS)", color: "var(--ac)" }} onClick={() => setPlanForm((p) => ({ ...p, amount: ed.balance }))}>
              Còn lại · {vnd(ed.balance)}
            </button>
          )}
          {QUICK_AMOUNTS.map((a) => (
            <button key={a} type="button" className={chip} style={{ background: "var(--sf2)", color: "var(--tx2)" }} onClick={() => setPlanForm((p) => ({ ...p, amount: a }))}>
              {vnd(a)}
            </button>
          ))}
        </div>

        <div className="rounded-[12px] px-3.5 py-1" style={{ background: "var(--sf2)" }}>
          <Switch checked={paid} onChange={setPaid} label="Khách đã trả khoản này" desc="Ghi luôn vào sổ thu, kèm ảnh chuyển khoản nếu có." />
        </div>
        {paid && (
          <>
            <MethodPicker value={ed.planMethod} onChange={ed.setPlanMethod} />
            <div className="flex flex-wrap items-center gap-2.5">
              <label className={btn("secondary", "sm", "cursor-pointer")}>
                <Upload size={15} /> {ed.proofBusy ? "Đang tải…" : ed.planProof ? "Đổi ảnh chuyển khoản" : "Đính ảnh chuyển khoản"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => ed.pickPlanProof(e.target.files?.[0] ?? null)} />
              </label>
              {ed.planProof && (
                <>
                  <ProofThumb url={ed.planProof} onOpen={onZoom} size={40} />
                  <span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Đính kèm vào lần thu này
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Mã QR chuyển khoản ─────────────────────────────────────────────────── */
export function QrModal({ ed, q, onClose }: { ed: Ed; q: { amount: number; addInfo: string; title: string }; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} icon={QrCode} title={q.title} desc="Khách quét bằng app ngân hàng — số tiền và nội dung đã điền sẵn." width={380}>
      <VietQR bank={ed.props.bank} amount={q.amount} addInfo={q.addInfo} />
    </Modal>
  );
}

/* ── Thêm / sửa một người trong ê-kíp ───────────────────────────────────── */
export function CrewDrawer({ ctx, edit, onClose }: { ctx: V2Ctx; edit: { idx: number | null; eventId?: string }; onClose: () => void }) {
  const { ed } = ctx;
  const { roster, crewRoles, crewPortalUrl, studioName, contract } = ed.props;
  const { f, milestones } = ed;
  const orig = edit.idx !== null ? (ed.crew[edit.idx] ?? null) : null;
  const roles = crewRolesFor(ed.kind, crewRoles);
  const [row, setRow] = useState<CrewRow>(() =>
    orig
      ? { ...orig }
      : { name: "", phone: "", role: (roles[0]?.key ?? "photographer") as CrewRole, salary: 0, note: "", eventId: edit.eventId ?? "" },
  );
  const put = (patch: Partial<CrewRow>) => setRow((p) => ({ ...p, ...patch }));
  const busy = ed.busy === "crew";
  const clash = row.phone && !row.eventId ? ed.conflictFor(row.phone) : null;
  const inCrew = new Set(ed.crew.map((c) => (c.phone || "").replace(/\D/g, "")).filter(Boolean));
  const st = (orig?.status || "pending") as CrewStatus;

  async function save() {
    const next = edit.idx === null ? [...ed.crew, row] : ed.crew.map((x, i) => (i === edit.idx ? row : x));
    ed.setCrew(next);
    const ok = await ed.saveCrewList(next);
    if (ok) onClose();
  }

  function pick(r: (typeof roster)[number]) {
    const fill = () => put({ name: r.name, phone: r.phone, role: r.role });
    const c = ed.conflictFor(r.phone);
    // Đã bận ngày đó thì hỏi trước (như bản cũ) — studio vẫn được quyền chồng lịch.
    if (c)
      ctx.ask({
        title: "Thợ này đã có lịch",
        desc: `${r.name || r.phone} ${c.toLowerCase()} ngày ${f.event_date}. Vẫn chọn người này?`,
        confirm: "Vẫn chọn",
        run: fill,
      });
    else fill();
  }

  const msg = (withStudio: boolean) =>
    shootReminderMessage({
      name: row.name,
      title: f.title,
      date: f.event_date,
      time: f.event_time,
      location: f.location,
      role: crewRoleLabel(row.role, crewRoles),
      ...(withStudio ? { studio: studioName } : {}),
      link: crewPortalUrl,
    });

  return (
    <Drawer
      open
      onClose={onClose}
      title={orig ? orig.name || orig.phone || "Sửa người trong ê-kíp" : "Thêm người vào ê-kíp"}
      desc={orig ? `${crewRoleLabel(orig.role, crewRoles)} · lưu xong sẽ báo Zalo cho thợ nếu có thay đổi` : "Lưu xong sẽ ghi vào lịch của thợ và báo qua Zalo"}
      width={520}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {orig && (
            <button
              type="button"
              className={btn("danger", "md", "mr-auto")}
              onClick={() =>
                ctx.ask({
                  title: `Xoá ${orig.name || orig.phone || "người này"} khỏi ê-kíp?`,
                  desc: "Người này không còn thấy việc của hợp đồng trên cổng thợ.",
                  confirm: "Xoá khỏi ê-kíp",
                  danger: true,
                  run: async () => {
                    await ed.deleteCrew(orig.id, edit.idx ?? undefined);
                    onClose();
                  },
                })
              }
            >
              <Trash2 size={15} /> Xoá
            </button>
          )}
          <button type="button" className={btn("ghost", "md", orig ? "" : "ml-auto")} onClick={onClose}>
            Thôi
          </button>
          <button type="button" className={btn("primary")} onClick={save} disabled={busy || (!row.name.trim() && !row.phone.trim())}>
            {busy ? "Đang lưu…" : orig ? "Lưu" : "Thêm vào ê-kíp"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {!orig && roster.length > 0 && (
          <div>
            <p className="v2-label mb-2">Chọn nhanh từ sổ thợ</p>
            <div className="flex flex-wrap gap-1.5">
              {roster.map((r) => {
                const c = ed.conflictFor(r.phone);
                const here = inCrew.has((r.phone || "").replace(/\D/g, ""));
                const on = !!row.phone && (row.phone || "").replace(/\D/g, "") === (r.phone || "").replace(/\D/g, "");
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pick(r)}
                    title={c ?? (here ? "Đã có trong ê-kíp" : undefined)}
                    className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-[12.5px] font-medium"
                    style={{
                      background: on ? "var(--acS)" : "var(--sf2)",
                      color: on ? "var(--ac)" : here ? "var(--tx3)" : "var(--tx)",
                      border: `1px solid ${c ? "color-mix(in srgb, var(--rd) 55%, transparent)" : on ? "var(--ac)" : "transparent"}`,
                    }}
                  >
                    {on ? <Check size={13} /> : c ? <AlertTriangle size={13} style={{ color: "var(--rd)" }} /> : null}
                    {r.name || r.phone}
                    <span style={{ color: "var(--tx3)" }}>· {crewRoleLabel(r.role, crewRoles)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên" htmlFor="cw-name">
            <input id="cw-name" className={inputCls} placeholder="Tên thợ" value={row.name} onChange={(e) => put({ name: e.target.value })} />
          </Field>
          <Field label="Số điện thoại" htmlFor="cw-phone" hint="Thợ dùng số này để vào cổng thợ.">
            <input id="cw-phone" className={inputCls} inputMode="tel" placeholder="SĐT" value={row.phone} onChange={(e) => put({ phone: e.target.value })} />
          </Field>
          <Field label="Vai trò" htmlFor="cw-role">
            <select id="cw-role" className={inputCls} value={row.role} onChange={(e) => put({ role: e.target.value as CrewRole })}>
              {crewRolesFor(ed.kind, crewRoles, row.role).map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tiền công">
            <MoneyInput className={inputCls} placeholder="0" value={row.salary} onChange={(n) => put({ salary: n })} ariaLabel="Tiền công" />
          </Field>
          {milestones.length > 0 && (
            <Field label="Làm buổi nào" htmlFor="cw-ev" className="sm:col-span-2">
              <select id="cw-ev" className={inputCls} value={row.eventId ?? ""} onChange={(e) => put({ eventId: e.target.value })}>
                <option value="">
                  {mainSessionTitle(ed.kind)}
                  {f.event_date ? ` · ${fmtDate(f.event_date)}${f.event_time ? ` ${f.event_time}` : ""}` : ""}
                </option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} · {fmtDate(m.event_date)}
                    {m.event_time ? ` ${m.event_time}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Chụp / quay" htmlFor="cw-task">
            <select id="cw-task" className={inputCls} value={row.task ?? ""} onChange={(e) => put({ task: e.target.value })}>
              <option value="">— Chưa chọn —</option>
              {CREW_TASKS.map((k) => (
                <option key={k} value={k}>
                  {CREW_TASK_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nhà trai / nhà gái" htmlFor="cw-side">
            <select id="cw-side" className={inputCls} value={row.side ?? ""} onChange={(e) => put({ side: e.target.value })}>
              <option value="">— Chưa chọn —</option>
              {CREW_SIDES.map((k) => (
                <option key={k} value={k}>
                  {CREW_SIDE_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Từ giờ">
            <TimeInput className={inputCls} value={row.start ?? ""} onChange={(v) => put({ start: v })} ariaLabel="Từ giờ" placeholder="08:00" />
          </Field>
          <Field label="Đến giờ">
            <TimeInput className={inputCls} value={row.end ?? ""} onChange={(v) => put({ end: v })} ariaLabel="Đến giờ" placeholder="17:00" />
          </Field>
          <Field label="Dặn riêng người này" htmlFor="cw-note" className="sm:col-span-2">
            <textarea
              id="cw-note"
              className={inputCls}
              rows={2}
              style={{ minHeight: 64 }}
              placeholder="vd: mang lens 35mm, có mặt 7:30"
              value={row.note}
              onChange={(e) => put({ note: e.target.value })}
            />
          </Field>
        </div>

        {clash && (
          <Callout tone="red" icon={AlertTriangle} title="Trùng lịch">
            {clash} (ngày {f.event_date}).
          </Callout>
        )}

        {orig && (
          <div className="flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--bd2)" }}>
            <div className="flex items-center gap-2">
              <span className="text-[13px]" style={{ color: "var(--tx2)" }}>
                Nhận việc:
              </span>
              <Badge tone={CREW_TONE[st] ?? "gray"} dot>
                {CREW_STATUS_LABEL[st]}
              </Badge>
            </div>
            {orig.id && (
              <Switch
                checked={!!orig.paid}
                onChange={() => ed.togglePaid(orig, edit.idx as number)}
                label="Đã trả tiền công"
                desc={`${vnd(orig.salary || 0)} · ghi ngay, không cần bấm Lưu`}
              />
            )}
            <div>
              <p className="v2-label mb-2">Gửi lịch cho thợ</p>
              <div className="flex flex-wrap gap-2">
                <ZaloSendButton
                  phone={row.phone}
                  name={row.name}
                  audience="crew"
                  contractId={contract.id}
                  kind="crew_notify"
                  label="Gửi Zalo"
                  className={btn("secondary", "sm")}
                  wrapClassName="w-auto"
                  message={msg(true)}
                />
                <MessengerButton label="Chia sẻ tin nhắn" message={msg(false)} className={btn("secondary", "sm")} />
              </div>
            </div>
          </div>
        )}

        {ed.crewDebug && (
          <Callout tone="red" title="Chưa lưu được">
            <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px]">{ed.crewDebug}</pre>
          </Callout>
        )}
      </div>
    </Drawer>
  );
}
