"use client";

import { useRef, useState } from "react";
import {
  Banknote,
  BellRing,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Eye,
  EyeOff,
  ImagePlus,
  Landmark,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import MessengerButton from "@/components/MessengerButton";
import ZaloSendButton from "@/components/ZaloSendButton";
import { VietQR } from "@/components/VietQR";
import { Badge, Empty, Field, GroupLabel, Progress, Section, btn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Modal, Switch, type MenuItem } from "@/components/v2/kit-client";
import { PAYMENT_KIND_LABEL, paymentMethodLabel, vnd, type ContractPayment, type ContractPaymentPlan } from "@/lib/types";
import { daysFromToday, fmtDate } from "@/lib/date";
import { qrUrl } from "@/components/VietQR";
import VoucherRedeem from "./VoucherRedeem";
import LoyaltyVoucherCard from "./LoyaltyVoucherCard";
import { serializeItems, toItemRow } from "./useContractEditor";
import { ProofThumb, type V2Ctx } from "./ContractV2Parts";
import { EMBED } from "./ContractV2Items";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab THANH TOÁN (giao diện mới): tóm tắt tiền ở đầu, mỗi đợt một dòng gọn
   (tên · hạn · số tiền · nút Ghi thu · ⋯). Nhắc khách + mã QR của từng đợt mở
   trong ngăn kéo; sửa đợt trong hộp thoại. Chi phí phát sinh ở khối riêng.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ContractV2Payments({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { f, plan, clientProofs } = ed;
  const { contract, studioHost, studioName, depositPercent } = ed.props;
  const [remind, setRemind] = useState<ContractPaymentPlan | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const editing = plan.find((p) => p.id === editId) ?? null;
  const looseProofs = clientProofs.filter((cp) => !cp.plan_id);
  const done = ed.total > 0 && ed.balance <= 0;

  return (
    <>
      <Section
        title="Thanh toán"
        icon={Wallet}
        desc="Mỗi đợt đặt sẵn số tiền và hạn. Khách trả thì bấm Ghi thu — quá hạn sẽ được nhắc ở Tổng quan."
        actions={
          <button type="button" className={btn("secondary", "sm")} onClick={() => ctx.openAddPlan()}>
            <Plus size={15} /> Thêm đợt
          </button>
        }
        flush
      >
        {/* Tóm tắt */}
        <div className="grid grid-cols-3 gap-2 px-4 pt-4 sm:px-5">
          <Money label="Giá trị hợp đồng" value={vnd(ed.total)} />
          <Money label="Đã thu" value={vnd(ed.collected)} color="var(--gn)" />
          <Money label={done ? "Còn lại" : "Còn phải thu"} value={vnd(Math.max(0, ed.balance))} color={ed.balance > 0 ? "var(--am)" : "var(--gn)"} />
        </div>
        <div className="flex items-center gap-3 px-4 pb-4 pt-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <Progress value={ed.pct} tone={done ? "green" : "brand"} />
          </div>
          <span className="v2-num text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>
            {ed.pct}%
          </span>
          {ed.balance > 0 && (
            <button
              type="button"
              className={btn("ghost", "sm")}
              onClick={() => ctx.openQr({ amount: ed.balance, addInfo: ed.qrInfo, title: `QR thu ${vnd(ed.balance)}` })}
            >
              <QrCode size={15} /> QR phần còn lại
            </button>
          )}
        </div>

        {f.status !== "cancelled" && (
          <div className="px-4 sm:px-5 [&>*]:!mb-3" style={{ borderTop: "1px solid var(--bd2)", paddingTop: 12 }}>
            <VoucherRedeem
              contractId={contract.id}
              balance={ed.balance}
              onRedeemed={(p) => ed.setPayments((prev) => [p, ...prev])}
              onItemAdded={(it) => {
                // Dòng này máy chủ đã ghi — thêm vào cả bản "đã lưu" để khỏi báo nhầm "chưa lưu".
                const row = toItemRow(it);
                ed.setItems((prev) => [...prev, row]);
                ed.setSavedItems((prev) => [...prev, ...serializeItems([row])]);
              }}
              // % tính theo bảng giá ĐÃ LƯU ở máy chủ — lưu phần đang sửa dở trước.
              beforeLoyalty={
                ed.itemsLocked
                  ? undefined
                  : async () => {
                      await ed.luuHangMuc(ed.items);
                    }
              }
              toast={ed.toast}
            />
          </div>
        )}

        {plan.length === 0 ? (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <Empty
              compact
              icon={Wallet}
              title="Chưa có đợt thanh toán nào"
              hint={ed.total > 0 ? "Tạo đợt cọc trước, các đợt sau thêm dần." : "Thêm hạng mục để hợp đồng có giá trị, rồi tạo đợt thu."}
              action={
                ed.total > 0 ? (
                  <button
                    type="button"
                    className={btn("secondary")}
                    onClick={() => ctx.openAddPlan({ label: "Cọc hợp đồng", amount: ed.depositAmt })}
                  >
                    <Plus size={16} /> Tạo đợt cọc{ed.depositAmt > 0 ? ` ${depositPercent}% · ${vnd(ed.depositAmt)}` : ""}
                  </button>
                ) : (
                  <button type="button" className={btn("secondary")} onClick={() => ctx.go("items")}>
                    Thêm hạng mục
                  </button>
                )
              }
            />
          </div>
        ) : (
          <ul style={{ borderTop: "1px solid var(--bd2)" }}>
            {plan.map((it) => (
              <PlanRow key={it.id} ctx={ctx} it={it} onRemind={() => setRemind(it)} onEdit={() => setEditId(it.id)} />
            ))}
          </ul>
        )}

        {looseProofs.length > 0 && (
          <div className="px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <p className="mb-2 text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
              Ảnh chuyển khoản khách gửi (chưa gắn đợt)
            </p>
            <div className="flex flex-wrap gap-2">
              {looseProofs.map((cp) => (
                <ProofThumb key={cp.id} url={cp.url} onOpen={ed.setLightbox} size={52} />
              ))}
            </div>
          </div>
        )}

        {ed.orphanPayments.length > 0 && (
          <div style={{ borderTop: "1px solid var(--bd2)" }}>
            <div className="px-4 pb-1 pt-3.5 sm:px-5">
              <GroupLabel count={ed.orphanPayments.length}>Khoản thu khác</GroupLabel>
            </div>
            <ul>
              {ed.orphanPayments.map((p) => (
                <OrphanRow key={p.id} ctx={ctx} p={p} />
              ))}
            </ul>
          </div>
        )}
      </Section>

      <div className={EMBED}>
        {/* Voucher ưu đãi lần sau — tự phát khi khách ký + studio xác nhận cọc + studio ký. */}
        <LoyaltyVoucherCard
          contractId={contract.id}
          initialPercent={contract.loyalty_percent ?? null}
          refreshKey={`${ed.collected}|${ed.studioSigned}|${!!contract.client_signed_at}|${f.status}|${ed.total}`}
          clientName={f.client_name}
          clientPhone={f.client_phone}
          clientMessenger={f.client_messenger}
          studioHost={studioHost}
          studioName={studioName}
        />
      </div>

      <Expenses ctx={ctx} />

      {remind && <RemindDrawer ctx={ctx} it={remind} onClose={() => setRemind(null)} />}
      {editing && <EditPlanModal ctx={ctx} it={editing} onClose={() => setEditId(null)} />}
    </>
  );
}

function Money({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-[12px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
      <p className="truncate text-[12px]" style={{ color: "var(--tx3)" }}>
        {label}
      </p>
      <p className="v2-num mt-0.5 truncate text-[15px] font-bold sm:text-[16.5px]" style={{ color: color ?? "var(--tx)" }}>
        {value}
      </p>
    </div>
  );
}

/* ── Một đợt thanh toán ── */
function PlanRow({ ctx, it, onRemind, onEdit }: { ctx: V2Ctx; it: ContractPaymentPlan; onRemind: () => void; onEdit: () => void }) {
  const { ed } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const linked = it.payment_id ? ed.payments.find((p) => p.id === it.payment_id) : undefined;
  const overdue = !it.paid && !!it.due_date && it.due_date < ed.todayStr;
  const late = overdue ? -(daysFromToday(it.due_date) ?? 0) : 0;
  const proofs = ed.clientProofs.filter((cp) => cp.plan_id === it.id);

  const delPlan = () =>
    ctx.ask({
      title: `Xoá đợt “${it.label}”?`,
      desc: it.paid ? `Lần thu ${vnd(it.amount)} gắn với đợt này cũng bị xoá khỏi sổ thu.` : "Đợt này sẽ biến mất khỏi kế hoạch thu và cổng khách.",
      confirm: "Xoá đợt",
      danger: true,
      run: () => ed.deletePlan(it),
    });

  const menu: MenuItem[] = it.paid
    ? [
        ...(linked ? [{ label: "In phiếu thu", icon: Printer, onClick: () => ed.printReceipt(linked) }] : []),
        ...(linked
          ? [{ label: linked.proof_url ? "Đổi ảnh chuyển khoản" : "Đính ảnh chuyển khoản", icon: ImagePlus, onClick: () => fileRef.current?.click(), disabled: ed.proofBusy }]
          : []),
        ...(linked?.proof_url ? [{ label: "Xem ảnh chuyển khoản", icon: Eye, onClick: () => ed.setLightbox(linked.proof_url!) }] : []),
        "divider",
        {
          label: "Bỏ đánh dấu đã thu",
          icon: Undo2,
          danger: true,
          onClick: () =>
            ctx.ask({
              title: "Bỏ đánh dấu đã thu?",
              desc: `Lần thu ${vnd(it.amount)} của đợt “${it.label}” sẽ bị xoá khỏi sổ thu, đợt quay về chưa thu.`,
              confirm: "Bỏ đánh dấu",
              danger: true,
              run: () => ed.markPlanPaid(it),
            }),
        },
        { label: "Xoá đợt", icon: Trash2, danger: true, onClick: delPlan },
      ]
    : [
        ...(it.amount > 0 ? [{ label: "Nhắc khách & mã QR", icon: BellRing, onClick: onRemind, hint: "Zalo kèm QR đúng số tiền" }] : []),
        { label: "Sửa đợt", icon: Pencil, onClick: onEdit },
        "divider",
        { label: "Xoá đợt", icon: Trash2, danger: true, onClick: delPlan },
      ];

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <span className="mt-0.5 flex-none" style={{ color: it.paid ? "var(--gn)" : overdue ? "var(--rd)" : "var(--tx3)" }}>
        {it.paid ? <CheckCircle2 size={20} /> : <Circle size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[14px] font-semibold">{it.label}</p>
          <p className="v2-num flex-none text-[14.5px] font-semibold" style={{ color: it.paid ? "var(--gn)" : "var(--tx)" }}>
            {vnd(it.amount)}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {it.paid ? (
            <span style={{ color: "var(--gn)" }}>
              Đã thu{it.paid_at ? ` ${fmtDate(it.paid_at.slice(0, 10))}` : ""}
              {linked?.method ? ` · ${paymentMethodLabel(linked.method)}` : ""}
            </span>
          ) : it.due_date ? (
            <span style={{ color: overdue ? "var(--rd)" : undefined, fontWeight: overdue ? 600 : undefined }}>
              Hạn {fmtDate(it.due_date)}
              {overdue ? ` · quá hạn ${late} ngày` : ""}
            </span>
          ) : (
            <span>Chưa đặt hạn</span>
          )}
          {it.paid && linked?.proof_url && <ProofThumb url={linked.proof_url} onOpen={ed.setLightbox} size={28} />}
          {proofs.map((cp) => (
            <ProofThumb key={cp.id} url={cp.url} onOpen={ed.setLightbox} size={28} />
          ))}
          {proofs.length > 0 && !it.paid && <Badge tone="blue">Khách đã gửi ảnh CK</Badge>}
        </div>
      </div>
      <div className="flex flex-none items-center gap-1">
        {!it.paid && (
          <Menu
            label={`Ghi thu ${it.label}`}
            width={210}
            items={[
              { label: "Khách trả tiền mặt", icon: Banknote, onClick: () => ed.markPlanPaid(it, "cash") },
              { label: "Khách chuyển khoản", icon: Landmark, onClick: () => ed.markPlanPaid(it, "transfer") },
            ]}
            trigger={({ open, toggle }) => (
              <button type="button" onClick={toggle} aria-expanded={open} className={btn(overdue ? "soft" : "secondary", "sm")}>
                <Check size={15} /> Ghi thu
              </button>
            )}
          />
        )}
        <Menu items={menu} label={`Thao tác cho ${it.label}`} />
        {linked && (
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => ed.attachProof(linked.id, e.target.files?.[0] ?? null)} />
        )}
      </div>
    </li>
  );
}

/* ── Khoản thu không gắn đợt (thu trước khi gộp, hoàn tiền, voucher…) ── */
function OrphanRow({ ctx, p }: { ctx: V2Ctx; p: ContractPayment }) {
  const { ed } = ctx;
  const neg = p.amount < 0;
  return (
    <li className="flex items-start gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-[13.5px] font-semibold">{PAYMENT_KIND_LABEL[p.kind]}</p>
          <p className="v2-num flex-none text-[14px] font-semibold" style={{ color: neg ? "var(--rd)" : "var(--tx)" }}>
            {vnd(p.amount)}
          </p>
        </div>
        <p className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {fmtDate(p.paid_at)}
          {p.method ? ` · ${paymentMethodLabel(p.method)}` : ""}
          {p.note ? ` · ${p.note}` : ""}
        </p>
      </div>
      <Menu
        label="Thao tác khoản thu"
        items={[
          // Khoản hoàn là tiền CHI ra, không in "phiếu thu".
          ...(p.kind !== "refund" ? [{ label: "In phiếu thu", icon: Printer, onClick: () => ed.printReceipt(p) }] : []),
          {
            label: "Xoá khoản thu",
            icon: Trash2,
            danger: true,
            onClick: () =>
              ctx.ask({
                title: "Xoá khoản thu này?",
                desc: `${PAYMENT_KIND_LABEL[p.kind]} ${vnd(p.amount)} ngày ${fmtDate(p.paid_at)} sẽ bị xoá khỏi sổ thu.`,
                confirm: "Xoá khoản thu",
                danger: true,
                run: () => ed.deletePayment(p.id),
              }),
          },
        ]}
      />
    </li>
  );
}

/* ── Nhắc khách một đợt: mã QR + tin Zalo kèm ảnh QR của đúng đợt đó ── */
function RemindDrawer({ ctx, it, onClose }: { ctx: V2Ctx; it: ContractPaymentPlan; onClose: () => void }) {
  const { ed } = ctx;
  const { contract, bank } = ed.props;
  const message = ed.planReminderMsg(it);
  const [copied, setCopied] = useState(false);
  return (
    <Drawer open onClose={onClose} title={`Nhắc khách: ${it.label}`} desc={`${vnd(it.amount)}${it.due_date ? ` · hạn ${fmtDate(it.due_date)}` : ""}`} width={460}>
      <div className="flex flex-col gap-5">
        <div className="rounded-[14px] p-4" style={{ background: "var(--sf2)" }}>
          <VietQR bank={bank} amount={it.amount} addInfo={ed.planNote(it)} />
        </div>
        <div>
          <p className="v2-label mb-1.5">Tin nhắn gửi khách</p>
          <pre className="whitespace-pre-wrap rounded-[12px] p-3 text-[13px] leading-relaxed" style={{ background: "var(--sf2)", fontFamily: "inherit", color: "var(--tx2)" }}>
            {message}
          </pre>
        </div>
        <div className="flex flex-col gap-2">
          {/* Tin kèm luôn ảnh QR đã điền sẵn số tiền & nội dung của đợt. */}
          <ZaloSendButton
            phone={ed.f.client_phone}
            name={ed.f.client_name}
            audience="client"
            contractId={contract.id}
            savedName={contract.zalo_name}
            kind="payment_reminder"
            label="Nhắc qua Zalo"
            className={btn("secondary", "md", "w-full")}
            message={message}
            imageUrl={qrUrl(bank, it.amount, ed.planNote(it))}
          />
          <div className="grid grid-cols-2 gap-2">
            <MessengerButton link={ed.f.client_messenger} label="Chia sẻ" message={message} className={btn("secondary", "md", "w-full")} />
            <button
              type="button"
              className={btn("secondary", "md", "w-full")}
              onClick={() => {
                navigator.clipboard?.writeText(message);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />} {copied ? "Đã chép" : "Chép tin"}
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

/* ── Sửa một đợt chưa thu (tự lưu như bản cũ) ── */
function EditPlanModal({ ctx, it, onClose }: { ctx: V2Ctx; it: ContractPaymentPlan; onClose: () => void }) {
  const { ed } = ctx;
  return (
    <Modal
      open
      onClose={onClose}
      icon={Pencil}
      title="Sửa đợt thanh toán"
      desc="Thay đổi tự lưu sau khi ngừng gõ."
      width={480}
      footer={
        <button type="button" className={btn("primary")} onClick={onClose}>
          Xong
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên đợt" htmlFor="ep-label">
          <input id="ep-label" className={inputCls} value={it.label} onChange={(e) => ed.autosavePlan(it.id, { label: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số tiền">
            <MoneyInput className={inputCls} value={it.amount} onChange={(n) => ed.autosavePlan(it.id, { amount: n })} ariaLabel="Số tiền" />
          </Field>
          <Field label="Hạn thu">
            <DateInput className={inputCls} value={it.due_date ?? ""} onChange={(v) => ed.autosavePlan(it.id, { due_date: v || null })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ── Chi phí phát sinh ── */
function Expenses({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { exp, setExp, expenses } = ed;
  return (
    <Section
      title="Chi phí phát sinh"
      icon={Receipt}
      desc="Chi riêng cho hợp đồng này (di chuyển, đạo cụ, thuê ngoài…) — tính vào lãi/lỗ và báo cáo thu chi."
      flush
    >
      {expenses.length === 0 ? (
        <p className="px-4 py-4 text-[13px] sm:px-5" style={{ color: "var(--tx3)" }}>
          Chưa có chi phí nào.
        </p>
      ) : (
        <ul>
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold">{e.title}</p>
                <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {fmtDate(e.spent_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => ed.toggleExpenseVisible(e.id, !e.client_visible)}
                className="flex-none rounded-full"
                title={e.client_visible ? "Khách thấy & tính vào hoá đơn — bấm để chuyển thành nội bộ" : "Chỉ nội bộ (tính lãi/lỗ) — bấm để hiện cho khách"}
              >
                <Badge tone={e.client_visible ? "amber" : "gray"} icon={e.client_visible ? Eye : EyeOff}>
                  {e.client_visible ? "Khách thấy" : "Nội bộ"}
                </Badge>
              </button>
              <span className="v2-num w-[110px] flex-none text-right text-[13.5px] font-semibold">{vnd(e.amount)}</span>
              <Menu
                label="Thao tác khoản chi"
                items={[
                  {
                    label: "Xoá khoản chi",
                    icon: Trash2,
                    danger: true,
                    onClick: () =>
                      ctx.ask({
                        title: "Xoá khoản chi này?",
                        desc: `${e.title} · ${vnd(e.amount)}`,
                        confirm: "Xoá khoản chi",
                        danger: true,
                        run: () => ed.deleteExpense(e.id),
                      }),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5" style={{ borderTop: expenses.length ? undefined : "1px solid var(--bd2)" }}>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
          <input className={inputCls} placeholder="Nội dung chi" aria-label="Nội dung chi" value={exp.title} onChange={(e) => setExp((p) => ({ ...p, title: e.target.value }))} />
          <MoneyInput className={inputCls} placeholder="Số tiền" ariaLabel="Số tiền chi" value={exp.amount} onChange={(n) => setExp((p) => ({ ...p, amount: n }))} />
          <DateInput className={inputCls} lunar={false} value={exp.spent_at} onChange={(v) => setExp((p) => ({ ...p, spent_at: v }))} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Switch
              checked={exp.client_visible}
              onChange={(v) => setExp((p) => ({ ...p, client_visible: v }))}
              label="Hiện cho khách & tính vào hoá đơn"
              desc="Tắt nếu là chi phí nội bộ, chỉ để tính lãi/lỗ."
            />
          </div>
          <button type="button" className={btn("secondary")} onClick={ed.addExpense} disabled={!exp.title.trim() || !(Number(exp.amount) > 0)}>
            <Plus size={16} /> Thêm chi phí
          </button>
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-3 px-4 py-3.5 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
        <span className="text-[13.5px] font-semibold">Tổng chi phí hợp đồng</span>
        <span className="v2-num text-[16px] font-bold">{vnd(ed.expenseTotal)}</span>
      </div>
    </Section>
  );
}
