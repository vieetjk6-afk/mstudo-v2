"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Ticket, Plus, Printer, Check, Ban, Wallet, Gift } from "lucide-react";
import { Modal } from "@/components/studio/Modal";
import { Panel, PanelHead, EmptyState, StatCard, Pill, type ToneKey } from "@/components/studio/ui";
import MoneyInput from "@/components/MoneyInput";
import { vnd } from "@/lib/types";
import { fmtDate } from "@/lib/date";
import { IssuedVoucher } from "@/app/dashboard/studio/contracts/[id]/LoyaltyVoucherCard";
import VoucherProgramCard from "./VoucherProgramCard";
import type { VoucherProgram } from "@/lib/voucher-program";
import { VOUCHER_STATE_LABEL, isLoyalty, voucherState, voucherValueLabel, type Voucher, type VoucherState } from "@/lib/vouchers";
import { useVouchers } from "./useVouchers";
import { useUiV2 } from "@/components/v2/UiV2Context";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const VouchersV2 = dynamic(() => import("./VouchersV2"));

const STATE_TONE: Record<VoucherState, ToneKey> = {
  usable: "green",
  unpaid: "amber",
  expired: "gray",
  redeemed: "blue",
  void: "red",
};

export type VouchersProps = {
  packages?: { name: string; group: string }[];
  studioHost: string | null;
  program: VoucherProgram;
  programMigrated: boolean;
  initial: Voucher[];
  migrated: boolean;
  studioName: string;
  studioPhone: string | null;
};

/** Giao diện mới có bản riêng (VouchersV2) — đổi kiểu component, không rẽ nhánh giữa các hook. */
export default function VouchersView(props: VouchersProps) {
  return useUiV2() ? <VouchersV2 {...props} /> : <VouchersViewV1 {...props} />;
}

function VouchersViewV1({
  initial,
  migrated,
  studioName,
  studioPhone,
  studioHost,
  program,
  programMigrated,
  packages = [],
}: VouchersProps) {
  // Logic dùng chung với bản mới (VouchersV2) — xem ./useVouchers.
  const { today, draft, setDraft, newDraft, filter, setFilter, kind, setKind, sharing, setSharing, busy, toast, toastNode, sum, loyaltyCount, loyaltyActive, shown, create, act, printCard } =
    useVouchers({ initial, studioName, studioPhone });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>Voucher &amp; thẻ quà</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
            Bán thẻ quà mùa lễ và quản lý voucher ưu đãi đã tặng khách. Khách dùng cả hai ở tab <b>Thanh toán</b> của hợp đồng.
            Voucher ưu đãi tự gắn vào mọi hợp đồng theo chương trình bên dưới.
          </p>
        </div>
        <button
          onClick={() => setDraft(newDraft())}
          className="btn-primary"
          disabled={!migrated}
        >
          <Plus size={15} /> Bán voucher
        </button>
      </div>

      {!migrated && (
        <div className="rounded-[12px] px-4 py-3 text-[12.5px] font-semibold" style={{ background: "var(--amS)", color: "var(--am)", border: "1px solid var(--bd)" }}>
          Chưa chạy <code>supabase/migrations/studio_vouchers.sql</code> — chạy nó trong Supabase SQL Editor để bắt đầu bán voucher.
        </div>
      )}

      <VoucherProgramCard initial={program} migrated={programMigrated} toast={toast} packages={packages} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Ticket} label="Đã bán" value={String(sum.sold)} sub="không tính thẻ đã huỷ" />
        <StatCard icon={Wallet} tone="green" label="Đã thu từ bán thẻ" value={vnd(sum.collected)} sub="giá bán thực thu" />
        <StatCard icon={Gift} tone="amber" label="Còn nợ khách" value={vnd(sum.outstanding)} sub={`${sum.outstandingCount} thẻ còn hiệu lực`} />
        <StatCard icon={Check} tone="blue" label="Đã dùng" value={vnd(sum.redeemed)} sub="đã thành doanh thu ở hợp đồng" />
        <StatCard icon={Ticket} tone="brand" label="Voucher ưu đãi" value={String(loyaltyActive)} sub={`còn hiệu lực · ${loyaltyCount} đã tặng`} />
      </div>

      <Panel>
        <PanelHead icon={Ticket} tone="brand" title="Danh sách voucher" count={String(shown.length)} />
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          {([["all", "Mọi loại"], ["gift", "Thẻ quà"], ["loyalty", "Ưu đãi lần sau"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="rounded-[20px] px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: kind === k ? "var(--ac)" : "var(--sf)", color: kind === k ? "#fff" : "var(--tx2)" }}
            >
              {label}
            </button>
          ))}
          <span className="mx-1 self-center" style={{ color: "var(--bd)" }}>|</span>
          {(["all", "usable", "unpaid", "redeemed", "expired", "void"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="rounded-[20px] px-2.5 py-1 text-[11.5px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: filter === k ? "var(--acS)" : "var(--sf)", color: filter === k ? "var(--ac)" : "var(--tx2)" }}
            >
              {k === "all" ? "Tất cả" : VOUCHER_STATE_LABEL[k]}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <div className="p-4"><EmptyState icon={Ticket} title="Chưa có voucher" hint="Bấm “Bán voucher” để tạo thẻ quà đầu tiên." /></div>
        ) : (
          <ul>
            {shown.map((v) => {
              const st = voucherState(v, today);
              return (
                <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3" style={{ borderTop: "1px solid var(--bd2)" }}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                      <span className="font-mono tracking-wide">{v.code}</span>
                      <Pill tone={STATE_TONE[st]}>{VOUCHER_STATE_LABEL[st]}</Pill>
                      {isLoyalty(v) && <Pill tone="brand">Ưu đãi lần sau</Pill>}
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                      {v.title}
                      {v.buyer_name ? ` · mua: ${v.buyer_name}` : ""}
                      {isLoyalty(v) && v.source_contract_id && (
                        <> · <Link href={`/dashboard/studio/contracts/${v.source_contract_id}`} style={{ color: "var(--ac)" }}>tặng từ HĐ</Link></>
                      )}
                      {v.recipient_name ? ` · tặng: ${v.recipient_name}` : ""}
                      {v.expires_on ? ` · hạn ${fmtDate(v.expires_on)}` : ""}
                      {v.redeemed_contract_id && (
                        <> · <Link href={`/dashboard/studio/contracts/${v.redeemed_contract_id}`} style={{ color: "var(--ac)" }}>xem hợp đồng</Link></>
                      )}
                    </p>
                  </div>
                  <div className="tnum flex-none text-right">
                    <p className="text-[14px] font-bold">{voucherValueLabel(v)}</p>
                    {isLoyalty(v) ? (
                      <p className="text-[11px]" style={{ color: "var(--tx3)" }}>quà tặng</p>
                    ) : (
                      v.price !== v.amount && <p className="text-[11px]" style={{ color: "var(--tx3)" }}>bán {vnd(v.price)}</p>
                    )}
                  </div>
                  <div className="flex flex-none gap-1.5">
                    {v.status === "active" && !v.paid && (
                      <button onClick={() => act(v, "mark_paid")} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs"><Check size={13} /> Đã thu</button>
                    )}
                    {v.status !== "void" && !isLoyalty(v) && (
                      <button onClick={() => printCard(v)} className="btn-ghost px-2.5 py-1.5 text-xs"><Printer size={13} /> In thẻ</button>
                    )}
                    {isLoyalty(v) && v.public_token && v.status !== "void" && (
                      <button onClick={() => setSharing(v)} className="btn-ghost px-2.5 py-1.5 text-xs"><Ticket size={13} /> Xem & gửi</button>
                    )}
                    {isLoyalty(v) && v.status === "redeemed" && (
                      <button onClick={() => act(v, "release")} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs">Trả lại</button>
                    )}
                    {v.status === "active" && (
                      <button onClick={() => act(v, "void")} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs" style={{ color: "var(--rd)" }} aria-label="Huỷ voucher"><Ban size={13} /></button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {draft && (
        <Modal onClose={() => setDraft(null)} labelledBy="voucher-new-title" maxWidth={520}>
          <div className="px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <h2 id="voucher-new-title" className="text-[15px] font-bold">Bán voucher mới</h2>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto px-[18px] py-4">
            <Field label="Tên thẻ">
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Voucher chụp ảnh gia đình" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Mệnh giá (trừ vào hợp đồng)">
                <MoneyInput className="input text-right" value={draft.amount} onChange={(n) => setDraft({ ...draft, amount: n, price: draft.price === draft.amount ? n : draft.price })} />
              </Field>
              <Field label="Giá bán thực thu">
                <MoneyInput className="input text-right" value={draft.price} onChange={(n) => setDraft({ ...draft, price: n })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Người mua">
                <input className="input" value={draft.buyer_name} onChange={(e) => setDraft({ ...draft, buyer_name: e.target.value })} />
              </Field>
              <Field label="SĐT người mua">
                <input className="input" inputMode="tel" value={draft.buyer_phone} onChange={(e) => setDraft({ ...draft, buyer_phone: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Người được tặng (in trên thẻ)">
                <input className="input" value={draft.recipient_name} onChange={(e) => setDraft({ ...draft, recipient_name: e.target.value })} />
              </Field>
              <Field label="Hạn dùng">
                <input type="date" className="input" value={draft.expires_on} onChange={(e) => setDraft({ ...draft, expires_on: e.target.value })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={draft.paid} onChange={(e) => setDraft({ ...draft, paid: e.target.checked })} />
              Đã thu tiền
              {draft.paid && (
                <select className="input ml-2 w-auto py-1 text-[12px]" value={draft.paid_method} onChange={(e) => setDraft({ ...draft, paid_method: e.target.value as "transfer" | "cash" })}>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="cash">Tiền mặt</option>
                </select>
              )}
            </label>
            <Field label="Ghi chú">
              <textarea className="input" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Mã thẻ tự sinh (vd <span className="font-mono">QUA-7K3M9P</span>, không có ký tự dễ nhầm 0/O, 1/I). Chưa thu tiền thì thẻ chưa dùng được.
            </p>
          </div>
          <div className="flex items-center gap-2 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <div className="flex-1" />
            <button onClick={() => setDraft(null)} className="btn-ghost">Đóng</button>
            <button onClick={create} disabled={busy} className="btn-primary"><Ticket size={15} /> {busy ? "Đang tạo…" : "Tạo voucher"}</button>
          </div>
        </Modal>
      )}

      {sharing && (
        <Modal onClose={() => setSharing(null)} labelledBy="voucher-share-title" maxWidth={760}>
          <div className="px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <h2 id="voucher-share-title" className="text-[15px] font-bold">Voucher {sharing.code}</h2>
          </div>
          <div className="p-[18px]">
            <IssuedVoucher
              v={sharing}
              today={today}
              studioHost={studioHost}
              studioName={studioName}
              clientName={sharing.recipient_name ?? ""}
              clientPhone={sharing.buyer_phone ?? ""}
              clientMessenger=""
              contractId={sharing.source_contract_id ?? null}
            />
          </div>
        </Modal>
      )}
      {toastNode}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--tx2)" }}>
      {label}
      {children}
    </label>
  );
}
