"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ticket, Plus, Printer, Check, Ban, Wallet, Gift } from "lucide-react";
import { Modal } from "@/components/studio/Modal";
import { Panel, PanelHead, EmptyState, StatCard, Pill, type ToneKey } from "@/components/studio/ui";
import MoneyInput from "@/components/MoneyInput";
import { vnd } from "@/lib/types";
import { fmtDate, todayVN } from "@/lib/date";
import { escapeHtml } from "@/lib/html-escape";
import { useToast } from "@/components/studio/Toast";
import { VOUCHER_STATE_LABEL, defaultExpiry, voucherState, voucherSummary, type Voucher, type VoucherState } from "@/lib/vouchers";

const STATE_TONE: Record<VoucherState, ToneKey> = {
  usable: "green",
  unpaid: "amber",
  expired: "gray",
  redeemed: "blue",
  void: "red",
};

type Draft = {
  title: string;
  amount: number;
  price: number;
  buyer_name: string;
  buyer_phone: string;
  recipient_name: string;
  expires_on: string;
  paid: boolean;
  paid_method: "transfer" | "cash";
  note: string;
};

export default function VouchersView({
  initial,
  migrated,
  studioName,
  studioPhone,
}: {
  initial: Voucher[];
  migrated: boolean;
  studioName: string;
  studioPhone: string | null;
}) {
  const today = todayVN();
  const [list, setList] = useState<Voucher[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<VoucherState | "all">("all");
  const [busy, setBusy] = useState(false);
  const { toast, toastNode } = useToast();

  const sum = useMemo(() => voucherSummary(list, today), [list, today]);
  const shown = list.filter((v) => filter === "all" || voucherState(v, today) === filter);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/studio/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(j.error === "missing_migration" ? "Cần chạy supabase/migrations/studio_vouchers.sql trước." : `Lỗi: ${j.error || res.status}`);
        return null;
      }
      return j as { voucher?: Voucher };
    } catch {
      toast("Lỗi mạng, thử lại nhé.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!draft) return;
    if (draft.amount <= 0) return toast("Nhập mệnh giá voucher.");
    const j = await call({ action: "create", ...draft });
    if (j?.voucher) {
      setList((p) => [j.voucher!, ...p]);
      setDraft(null);
      toast(`Đã tạo voucher ${j.voucher.code}`);
    }
  }

  async function act(v: Voucher, action: "mark_paid" | "void") {
    if (action === "void" && !confirm(`Huỷ voucher ${v.code}? Thẻ sẽ không dùng được nữa.`)) return;
    const j = await call({ action, id: v.id, paid_method: "transfer" });
    if (j?.voucher) setList((p) => p.map((x) => (x.id === v.id ? j.voucher! : x)));
  }

  function printCard(v: Voucher) {
    const w = window.open("", "_blank", "width=720,height=520");
    if (!w) return toast("Trình duyệt chặn cửa sổ in — cho phép popup rồi thử lại.");
    const e = escapeHtml;
    w.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${e(v.code)}</title>
<style>
  @page { size: A5 landscape; margin: 0 }
  body { margin: 0; font-family: "Be Vietnam Pro", Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f3f1ee }
  .card { width: 190mm; height: 120mm; box-sizing: border-box; border-radius: 6mm; padding: 12mm 14mm; color: #fff;
          background: linear-gradient(135deg, #7a1f82, #af2bb8 55%, #d56adc); display: flex; flex-direction: column; justify-content: space-between }
  .top { display: flex; justify-content: space-between; align-items: flex-start }
  .studio { font-weight: 800; font-size: 16pt; letter-spacing: -.3px }
  .kind { font-size: 9pt; text-transform: uppercase; letter-spacing: 2px; opacity: .85 }
  .value { font-size: 40pt; font-weight: 800; letter-spacing: -1.5px; margin: 0 }
  .title { font-size: 13pt; opacity: .95; margin-top: 1mm }
  .to { font-size: 11pt; margin-top: 4mm }
  .bottom { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9.5pt }
  .code { font-family: ui-monospace, Menlo, monospace; font-size: 15pt; font-weight: 700; letter-spacing: 2px; background: rgba(255,255,255,.18); padding: 2mm 4mm; border-radius: 2mm }
  @media print { body { background: none } }
</style></head><body><div class="card">
  <div class="top"><div class="studio">${e(studioName)}</div><div class="kind">Gift voucher</div></div>
  <div>
    <p class="value">${e(vnd(v.amount))}</p>
    <div class="title">${e(v.title)}</div>
    ${v.recipient_name ? `<div class="to">Dành tặng: <b>${e(v.recipient_name)}</b></div>` : ""}
  </div>
  <div class="bottom">
    <div>${v.expires_on ? `Hạn dùng đến ${e(fmtDate(v.expires_on))}` : "Không thời hạn"}${studioPhone ? `<br>Đặt lịch: ${e(studioPhone)}` : ""}</div>
    <div class="code">${e(v.code)}</div>
  </div>
</div><script>setTimeout(() => window.print(), 300)</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>Voucher &amp; thẻ quà</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx2)" }}>
            Bán thẻ quà mùa lễ. Khách dùng thẻ ở tab <b>Thanh toán</b> của hợp đồng — lúc đó mới tính là doanh thu.
          </p>
        </div>
        <button
          onClick={() => setDraft({ title: "Voucher chụp ảnh", amount: 0, price: 0, buyer_name: "", buyer_phone: "", recipient_name: "", expires_on: defaultExpiry(today), paid: true, paid_method: "transfer", note: "" })}
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Đã bán" value={String(sum.sold)} sub="không tính thẻ đã huỷ" />
        <StatCard icon={Wallet} tone="green" label="Đã thu từ bán thẻ" value={vnd(sum.collected)} sub="giá bán thực thu" />
        <StatCard icon={Gift} tone="amber" label="Còn nợ khách" value={vnd(sum.outstanding)} sub={`${sum.outstandingCount} thẻ còn hiệu lực`} />
        <StatCard icon={Check} tone="blue" label="Đã dùng" value={vnd(sum.redeemed)} sub="đã thành doanh thu ở hợp đồng" />
      </div>

      <Panel>
        <PanelHead icon={Ticket} tone="brand" title="Danh sách voucher" count={String(shown.length)} />
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
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
                    </p>
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>
                      {v.title}
                      {v.buyer_name ? ` · mua: ${v.buyer_name}` : ""}
                      {v.recipient_name ? ` · tặng: ${v.recipient_name}` : ""}
                      {v.expires_on ? ` · hạn ${fmtDate(v.expires_on)}` : ""}
                      {v.redeemed_contract_id && (
                        <> · <Link href={`/dashboard/studio/contracts/${v.redeemed_contract_id}`} style={{ color: "var(--ac)" }}>xem hợp đồng</Link></>
                      )}
                    </p>
                  </div>
                  <div className="tnum flex-none text-right">
                    <p className="text-[14px] font-bold">{vnd(v.amount)}</p>
                    {v.price !== v.amount && <p className="text-[11px]" style={{ color: "var(--tx3)" }}>bán {vnd(v.price)}</p>}
                  </div>
                  <div className="flex flex-none gap-1.5">
                    {v.status === "active" && !v.paid && (
                      <button onClick={() => act(v, "mark_paid")} disabled={busy} className="btn-ghost px-2.5 py-1.5 text-xs"><Check size={13} /> Đã thu</button>
                    )}
                    {v.status !== "void" && (
                      <button onClick={() => printCard(v)} className="btn-ghost px-2.5 py-1.5 text-xs"><Printer size={13} /> In thẻ</button>
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
