"use client";

import { useMemo, useState } from "react";
import {
  Truck, Plus, Trash2, Check, ChevronRight, Phone, AlertTriangle, Package, Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { EmptyState, Panel, PanelHead, Pill, StatCard } from "@/components/studio/ui";
import { Modal } from "@/components/studio/Modal";
import { useToast } from "@/components/studio/Toast";
import { vnd } from "@/lib/types";
import { todayVN } from "@/lib/date";
import {
  ORDER_STATUS,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  VENDOR_KINDS,
  dueLabel,
  expenseFor,
  isClosed,
  lateness,
  nextStatus,
  sortByUrgency,
  summarize,
  vendorKindLabel,
  type OrderStatus,
  type VendorKind,
  type VendorOrder,
} from "@/lib/vendors";

/* ═══════════════════════════════════════════════════════════════════════════
   NHÀ CUNG CẤP & ĐƠN ĐẶT NGOÀI — /dashboard/studio/vendors

   Màn này trả lời đúng một câu hỏi studio hỏi mỗi ngày: *"đơn album của khách A
   đã in xong chưa?"*. Nên danh sách xếp theo MỨC CẦN CHÚ Ý (trễ hẹn lên đầu),
   không xếp theo ngày tạo.

   Tiền: mỗi đơn sinh ĐÚNG MỘT dòng trong sổ chi, gắn bằng `vendor_order_id` và
   ghi bằng upsert — xem `expenseFor` và migration vendors.sql. Không có chỗ nào
   trong màn này ghi dòng chi thứ hai.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VendorRow = {
  id: string; name: string; kind: string; phone: string | null; contact: string | null;
  note: string | null; active: boolean;
};
export type OrderRow = {
  id: string; vendor_id: string | null; vendor_name: string | null; contract_id: string | null;
  title: string; amount: number; status: OrderStatus; due_date: string | null; note: string | null;
};
export type ContractOption = { id: string; title: string; code: string | null; client_name: string | null };

type OrderDraft = {
  id: string | null; vendor_id: string; contract_id: string; title: string;
  amount: number; status: OrderStatus; due_date: string; note: string;
};

const emptyOrder = (): OrderDraft => ({
  id: null, vendor_id: "", contract_id: "", title: "", amount: 0, status: "sent", due_date: "", note: "",
});

export default function VendorsView({
  ownerId, initialVendors, initialOrders, contracts, readOnly,
}: {
  ownerId: string;
  initialVendors: VendorRow[];
  initialOrders: OrderRow[];
  contracts: ContractOption[];
  readOnly: boolean;
}) {
  const supabase = createClient();
  const { toast, toastNode } = useToast();
  const today = todayVN();

  const [vendors, setVendors] = useState(initialVendors);
  const [orders, setOrders] = useState(initialOrders);
  const [tab, setTab] = useState<"orders" | "vendors">("orders");
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [vDraft, setVDraft] = useState<VendorRow | null>(null);
  const [busy, setBusy] = useState(false);
  /** Ẩn đơn đã giao khách — mặc định ẩn, vì màn này để theo dõi việc CHƯA xong. */
  const [showDone, setShowDone] = useState(false);

  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? null;

  const model = useMemo<VendorOrder[]>(
    () =>
      orders.map((o) => ({
        id: o.id,
        vendorId: o.vendor_id,
        vendorName: o.vendor_name ?? vendorName(o.vendor_id),
        contractId: o.contract_id,
        title: o.title,
        amount: o.amount,
        status: o.status,
        dueDate: o.due_date,
        note: o.note,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, vendors]
  );

  const sum = useMemo(() => summarize(model, today), [model, today]);
  const shown = useMemo(
    () => sortByUrgency(showDone ? model : model.filter((o) => !isClosed(o.status)), today),
    [model, showDone, today]
  );
  const contractLabel = (id: string | null) => {
    const c = contracts.find((x) => x.id === id);
    return c ? `${c.code ? `${c.code} · ` : ""}${c.client_name || c.title}` : null;
  };

  /* ── Ghi đơn + dòng chi ────────────────────────────────────────────────── */

  async function saveOrder() {
    if (!draft) return;
    if (!draft.title.trim()) return toast("Chưa có nội dung đơn.");
    setBusy(true);
    const payload = {
      owner_id: ownerId,
      vendor_id: draft.vendor_id || null,
      vendor_name: vendorName(draft.vendor_id || null),
      contract_id: draft.contract_id || null,
      title: draft.title.trim(),
      amount: Math.max(0, Math.round(draft.amount) || 0),
      status: draft.status,
      due_date: draft.due_date || null,
      note: draft.note.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = draft.id
      ? await supabase.from("vendor_orders").update(payload).eq("id", draft.id).select("*").maybeSingle()
      : await supabase.from("vendor_orders").insert(payload).select("*").maybeSingle();
    if (res.error || !res.data) {
      setBusy(false);
      const missing = res.error?.code === "42P01" || res.error?.code === "PGRST205";
      return toast(missing ? "Cần chạy supabase/migrations/vendors.sql trước." : res.error?.message ?? "Không lưu được.");
    }
    const row = res.data as OrderRow;

    // MỘT dòng chi cho MỘT đơn. upsert theo `vendor_order_id` (cột unique) — sửa
    // giá đơn ba lần vẫn chỉ một dòng chi, không phải ba.
    const e = expenseFor(
      { ...row, vendorId: row.vendor_id, vendorName: row.vendor_name, contractId: row.contract_id, dueDate: row.due_date },
      today
    );
    const { error: expErr } = await supabase
      .from("studio_expenses")
      .upsert({ owner_id: ownerId, vendor_order_id: row.id, contract_id: row.contract_id, ...e }, { onConflict: "vendor_order_id" });
    if (expErr) toast(`Đã lưu đơn, nhưng chưa ghi được vào sổ chi: ${expErr.message}`);

    setOrders((p) => (draft.id ? p.map((x) => (x.id === row.id ? row : x)) : [row, ...p]));
    setDraft(null);
    setBusy(false);
  }

  async function advance(o: VendorOrder) {
    const next = nextStatus(o.status);
    if (!next) return;
    setBusy(true);
    const { error } = await supabase
      .from("vendor_orders")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", o.id);
    setBusy(false);
    if (error) return toast(error.message);
    setOrders((p) => p.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
  }

  async function removeOrder(id: string) {
    setBusy(true);
    // Dòng chi đi theo nhờ `on delete cascade` ở migration — tiền của một đơn
    // không còn tồn tại thì cũng không được nằm lại trong báo cáo.
    const { error } = await supabase.from("vendor_orders").delete().eq("id", id);
    setBusy(false);
    if (error) return toast(error.message);
    setOrders((p) => p.filter((x) => x.id !== id));
    setDraft(null);
  }

  async function saveVendor() {
    if (!vDraft) return;
    if (!vDraft.name.trim()) return toast("Chưa có tên nhà cung cấp.");
    setBusy(true);
    const payload = {
      owner_id: ownerId, name: vDraft.name.trim(), kind: vDraft.kind,
      phone: vDraft.phone?.trim() || null, contact: vDraft.contact?.trim() || null,
      note: vDraft.note?.trim() || null, active: vDraft.active,
    };
    const res = vDraft.id
      ? await supabase.from("studio_vendors").update(payload).eq("id", vDraft.id).select("*").maybeSingle()
      : await supabase.from("studio_vendors").insert(payload).select("*").maybeSingle();
    setBusy(false);
    if (res.error || !res.data) {
      const missing = res.error?.code === "42P01" || res.error?.code === "PGRST205";
      return toast(missing ? "Cần chạy supabase/migrations/vendors.sql trước." : res.error?.message ?? "Không lưu được.");
    }
    const row = res.data as VendorRow;
    setVendors((p) => (vDraft.id ? p.map((x) => (x.id === row.id ? row : x)) : [...p, row]));
    setVDraft(null);
  }

  /* ── Vẽ ────────────────────────────────────────────────────────────────── */

  return (
    <div className="page-in space-y-3.5">
      {toastNode}

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard icon={Package} tone="brand" label="Đơn đang chạy" value={String(sum.openCount)} sub={`${sum.count} đơn tất cả`} />
        <StatCard icon={Truck} tone="amber" label="Tiền đang treo" value={vnd(sum.open)} sub={`Tổng đã đặt ${vnd(sum.total)}`} />
        <StatCard icon={AlertTriangle} tone={sum.lateCount > 0 ? "red" : "gray"} label="Quá hẹn" value={String(sum.lateCount)} sub="cần gọi nhà cung cấp" />
        <StatCard icon={Store} tone="teal" label="Nhà cung cấp" value={String(vendors.filter((v) => v.active).length)} sub="đang hợp tác" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["orders", "vendors"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="rounded-[9px] px-3.5 py-2 text-[12.5px] font-semibold"
            style={tab === k ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf2)", border: "1px solid var(--bd)", color: "var(--tx2)" }}
          >
            {k === "orders" ? "Đơn đặt ngoài" : "Sổ nhà cung cấp"}
          </button>
        ))}
        <div className="flex-1" />
        {!readOnly && (
          <button onClick={() => (tab === "orders" ? setDraft(emptyOrder()) : setVDraft({ id: "", name: "", kind: "album", phone: "", contact: "", note: "", active: true } as VendorRow))} className="btn-primary">
            <Plus size={15} /> {tab === "orders" ? "Đơn mới" : "Thêm nhà cung cấp"}
          </button>
        )}
      </div>

      {tab === "orders" ? (
        <Panel>
          <PanelHead icon={Package} tone="brand" title="Đơn đặt ngoài" count={String(shown.length)} />
          <label
            className="flex cursor-pointer items-center gap-1.5 px-4 py-2 text-[11.5px]"
            style={{ color: "var(--tx3)", borderBottom: "1px solid var(--bd2)" }}
          >
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Hiện cả đơn đã giao khách
          </label>
          {shown.length === 0 ? (
            <EmptyState
              icon={Package}
              title={showDone ? "Chưa có đơn nào" : "Không còn đơn nào đang chạy"}
              hint="Album in, makeup thuê ngoài, xe hoa — đặt ở đây để biết cái nào đã xong."
            />
          ) : (
            <div className="flex flex-col">
              {shown.map((o) => {
                const late = lateness(o, today);
                const next = nextStatus(o.status);
                const job = contractLabel(o.contractId);
                return (
                  <div key={o.id} className="flex flex-wrap items-center gap-3 px-[18px] py-[13px]" style={{ borderTop: "1px solid var(--bd2)" }}>
                    <button onClick={() => !readOnly && setDraft({
                      id: o.id, vendor_id: o.vendorId ?? "", contract_id: o.contractId ?? "", title: o.title,
                      amount: o.amount, status: o.status, due_date: o.dueDate ?? "", note: o.note ?? "",
                    })} className="min-w-[200px] flex-1 text-left">
                      <p className="text-[13.5px] font-semibold" style={{ textWrap: "pretty" }}>{o.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {o.vendorName && <span>{o.vendorName}</span>}
                        {job && <span>· {job}</span>}
                        <span
                          style={{
                            color: late.level === "late" ? "var(--rd)" : late.level === "soon" ? "var(--am)" : "var(--tx3)",
                            fontWeight: late.level === "ok" ? 400 : 700,
                          }}
                        >
                          · {dueLabel(o, today)}
                        </span>
                      </p>
                    </button>
                    <span className="tnum flex-none text-[13.5px] font-bold">{vnd(o.amount)}</span>
                    <Pill tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Pill>
                    {!readOnly && next && (
                      <button
                        onClick={() => advance(o)}
                        disabled={busy}
                        className="flex flex-none items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-bold"
                        style={{ background: "var(--acS)", color: "var(--ac)" }}
                      >
                        {ORDER_STATUS_LABEL[next]} <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ) : (
        <Panel>
          <PanelHead icon={Store} tone="teal" title="Sổ nhà cung cấp" count={String(vendors.length)} />
          {vendors.length === 0 ? (
            <EmptyState icon={Store} title="Chưa có nhà cung cấp nào" hint="Xưởng album, thợ makeup ngoài, nhà xe — khai một lần rồi chọn khi đặt đơn." />
          ) : (
            <div className="flex flex-col">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => !readOnly && setVDraft(v)}
                  className="flex flex-wrap items-center gap-3 px-[18px] py-[13px] text-left"
                  style={{ borderTop: "1px solid var(--bd2)", opacity: v.active ? 1 : 0.55 }}
                >
                  <div className="min-w-[160px] flex-1">
                    <p className="text-[13.5px] font-semibold">{v.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                      <span>{vendorKindLabel(v.kind)}</span>
                      {v.phone && <span className="flex items-center gap-1"><Phone size={11} /> {v.phone}</span>}
                      {!v.active && <span>· ngưng hợp tác</span>}
                    </p>
                  </div>
                  <span className="tnum flex-none text-[11.5px]" style={{ color: "var(--tx3)" }}>
                    {model.filter((o) => o.vendorId === v.id).length} đơn
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── Hộp thoại đơn ─────────────────────────────────────────────────── */}
      {draft && (
        <Modal onClose={() => setDraft(null)} labelledBy="vendor-order-title">
          <div className="px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <h2 id="vendor-order-title" className="text-[15px] font-bold">{draft.id ? "Sửa đơn" : "Đơn đặt ngoài mới"}</h2>
          </div>
          <div className="flex flex-col gap-3 px-[18px] py-4">
            <Field label="Nội dung đơn">
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Album 30x30 cao cấp, 40 trang…" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nhà cung cấp">
                <select className="input" value={draft.vendor_id} onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value })}>
                  <option value="">— Chưa chọn —</option>
                  {vendors.filter((v) => v.active).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </Field>
              <Field label="Của hợp đồng">
                <select className="input" value={draft.contract_id} onChange={(e) => setDraft({ ...draft, contract_id: e.target.value })}>
                  <option value="">— Không gắn hợp đồng —</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ""}{c.client_name || c.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Số tiền">
                <input type="number" min={0} step={100000} className="input" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
              </Field>
              <Field label="Hẹn xong">
                <input type="date" className="input" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
              </Field>
              <Field label="Trạng thái">
                <select className="input" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as OrderStatus })}>
                  {ORDER_STATUS.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Ghi chú">
              <textarea className="input" rows={2} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </Field>
            <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
              Đơn này tự ghi <b>một dòng</b> vào Thu chi (nhóm “Nhà cung cấp”), theo ngày hẹn xong. Sửa đơn thì
              sửa luôn dòng đó — tiền không bị đếm hai lần.
            </p>
          </div>
          <div className="flex items-center gap-2 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            {draft.id && (
              <button onClick={() => removeOrder(draft.id!)} disabled={busy} className="flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)", background: "var(--rdS)" }}>
                <Trash2 size={14} /> Xoá
              </button>
            )}
            <div className="flex-1" />
            <button onClick={() => setDraft(null)} className="btn-ghost">Đóng</button>
            <button onClick={saveOrder} disabled={busy} className="btn-primary">
              <Check size={15} /> {busy ? "Đang lưu…" : "Lưu đơn"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Hộp thoại nhà cung cấp ────────────────────────────────────────── */}
      {vDraft && (
        <Modal onClose={() => setVDraft(null)} labelledBy="vendor-title">
          <div className="px-[18px] py-3.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <h2 id="vendor-title" className="text-[15px] font-bold">{vDraft.id ? "Sửa nhà cung cấp" : "Nhà cung cấp mới"}</h2>
          </div>
          <div className="flex flex-col gap-3 px-[18px] py-4">
            <Field label="Tên">
              <input className="input" value={vDraft.name} onChange={(e) => setVDraft({ ...vDraft, name: e.target.value })} placeholder="Xưởng album Minh Anh" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Loại">
                <select className="input" value={vDraft.kind} onChange={(e) => setVDraft({ ...vDraft, kind: e.target.value as VendorKind })}>
                  {VENDOR_KINDS.map((k) => <option key={k} value={k}>{vendorKindLabel(k)}</option>)}
                </select>
              </Field>
              <Field label="Số điện thoại">
                <input className="input" value={vDraft.phone ?? ""} onChange={(e) => setVDraft({ ...vDraft, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Người liên hệ">
              <input className="input" value={vDraft.contact ?? ""} onChange={(e) => setVDraft({ ...vDraft, contact: e.target.value })} />
            </Field>
            <Field label="Ghi chú">
              <textarea className="input" rows={2} value={vDraft.note ?? ""} onChange={(e) => setVDraft({ ...vDraft, note: e.target.value })} placeholder="Giá album 30x30, thời gian in 7 ngày…" />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={vDraft.active} onChange={(e) => setVDraft({ ...vDraft, active: e.target.checked })} />
              Còn hợp tác
            </label>
          </div>
          <div className="flex items-center gap-2 px-[18px] py-3.5" style={{ borderTop: "1px solid var(--bd2)" }}>
            <div className="flex-1" />
            <button onClick={() => setVDraft(null)} className="btn-ghost">Đóng</button>
            <button onClick={saveVendor} disabled={busy} className="btn-primary">
              <Check size={15} /> {busy ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-semibold" style={{ color: "var(--tx2)" }}>{label}</span>
      {children}
    </label>
  );
}
