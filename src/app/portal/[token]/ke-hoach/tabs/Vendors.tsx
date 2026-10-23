"use client";

import { useState } from "react";
import { ExternalLink, Phone, Plus, Wallet } from "lucide-react";
import { vnd } from "@/lib/types";
import {
  BUDGET_CATS, VENDOR_STATUS_LABEL, budgetCatLabel,
  type BudgetCat, type PlanVendor, type VendorStatus,
} from "@/lib/wedding-plan";
import {
  AddForm, Field, GhostBtn, MoneyField, Pill, PrimaryBtn, RowActions, Section, Select, card, listOps, rowLine, type Ctx,
} from "../ui";

const CAT_OPTIONS = BUDGET_CATS.map((c) => [c.key, c.label] as [BudgetCat, string]);

/**
 * NHÀ CUNG CẤP — mỗi hạng mục (địa điểm, tiệc, trang phục, hoa…) có thể có vài
 * lựa chọn để so báo giá; chốt bên nào thì đánh dấu "Đã chốt" và đưa sang ngân
 * sách một chạm. Studio của hợp đồng luôn đứng đầu, đã chốt sẵn.
 */
export default function VendorsTab({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [editing, setEditing] = useState<string | null>(null);
  const [cat, setCat] = useState<BudgetCat>("venue");
  const [name, setName] = useState("");
  const [quote, setQuote] = useState(0);
  const [phone, setPhone] = useState("");

  const cats = BUDGET_CATS.filter((c) => plan.vendors.some((v) => v.cat === c.key));
  const inBudget = new Set(plan.budget.map((b) => b.name.trim().toLowerCase()));

  return (
    <div className="flex flex-col gap-3.5">
      <section className="flex flex-wrap items-center gap-3 rounded-[16px] px-5 py-4" style={card}>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--tx3)" }}>
            {budgetCatLabel("photo")} <Pill tone="gn">Đã chốt</Pill>
          </p>
          <p className="mt-0.5 text-[14px] font-semibold">{data.studio_name}</p>
          {data.studio_line && <p className="tnum text-[12.5px]" style={{ color: "var(--tx2)" }}>Hợp đồng {vnd(data.studio_line.estimate)}</p>}
        </div>
        {data.studio_phone && (
          <a href={`tel:${data.studio_phone}`} className="flex flex-none items-center gap-1.5 rounded-[10px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Phone size={14} /> Gọi studio
          </a>
        )}
      </section>

      {cats.length === 0 && (
        <Section title="Chưa có nhà cung cấp nào" sub="Lưu các bên bạn đang tìm hiểu — nhà hàng, váy cưới, hoa, MC… — kèm báo giá để so sánh và chốt." />
      )}

      {cats.map((c) => {
        const list = plan.vendors.filter((v) => v.cat === c.key).sort((a, b) => (a.status === b.status ? 0 : a.status === "booked" ? -1 : 1));
        const priced = list.filter((v) => v.quote > 0);
        const cheapest = priced.length > 1 ? priced.reduce((m, v) => (v.quote < m.quote ? v : m)) : null;
        const hasBooked = list.some((v) => v.status === "booked");
        return (
          <Section key={c.key} title={c.label} right={hasBooked ? <Pill tone="gn">Đã chốt</Pill> : <Pill tone="am">Đang tìm · {list.length} lựa chọn</Pill>}>
            <ul className="mt-1.5">
              {list.map((v, i) =>
                editing === v.id ? (
                  <VendorEdit key={v.id} v={v} first={i === 0} onDone={() => setEditing(null)} onSave={(patch) => ops.set("vendors", v.id, patch)} />
                ) : (
                  <li key={v.id} className="flex items-start gap-2 py-2.5" style={rowLine(i)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold" style={{ textWrap: "pretty" }}>{v.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Pill
                          tone={v.status === "booked" ? "gn" : "nu"}
                          onClick={readOnly ? undefined : () => ops.set("vendors", v.id, { status: v.status === "booked" ? "consider" : "booked" })}
                          title="Chạm để đổi"
                        >
                          {VENDOR_STATUS_LABEL[v.status]}
                        </Pill>
                        {v.quote > 0 && <span className="tnum text-[12.5px] font-bold">{vnd(v.quote)}</span>}
                        {cheapest?.id === v.id && <Pill tone="bl">Rẻ nhất</Pill>}
                        {v.phone && (
                          <a href={`tel:${v.phone}`} className="tnum inline-flex items-center gap-1 text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
                            <Phone size={12} /> {v.phone}
                          </a>
                        )}
                        {v.link && (
                          <a href={v.link} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[200px] items-center gap-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--ac)" }}>
                            <ExternalLink size={12} className="flex-none" /> <span className="truncate">{v.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                          </a>
                        )}
                      </div>
                      {v.note && <p className="mt-1 whitespace-pre-line text-[12px]" style={{ color: "var(--tx2)" }}>{v.note}</p>}
                      {!readOnly && v.status === "booked" && !inBudget.has(v.name.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={() => ops.add("budget", { cat: v.cat, name: v.name, estimate: v.quote, actual: v.quote })}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-[8px] px-2.5 py-1 text-[12px] font-bold"
                          style={{ background: "var(--sf2)", color: "var(--tx2)" }}
                        >
                          <Wallet size={12} /> Đưa vào ngân sách
                        </button>
                      )}
                    </div>
                    {!readOnly && <RowActions label={v.name} onEdit={() => setEditing(v.id)} onRemove={() => ops.remove("vendors", v.id)} />}
                  </li>
                ),
              )}
            </ul>
          </Section>
        );
      })}

      {!readOnly && (
        <AddForm
          onSubmit={() => {
            if (!name.trim()) return;
            ops.add("vendors", { cat, name, quote, phone });
            setName("");
            setQuote(0);
            setPhone("");
          }}
        >
          <Select value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} ariaLabel="Hạng mục" />
          <input className="input w-auto min-w-[180px] flex-1 px-3 py-2.5" placeholder="Tên nhà cung cấp…" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <MoneyField className="input w-[140px] flex-none px-3 py-2.5" value={quote} placeholder="Báo giá" ariaLabel="Báo giá" onCommit={setQuote} live />
          <input className="input w-[140px] flex-none px-3 py-2.5" inputMode="tel" placeholder="SĐT" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <PrimaryBtn disabled={!name.trim()}><Plus size={15} /> Thêm</PrimaryBtn>
        </AddForm>
      )}
    </div>
  );
}

function VendorEdit({ v, first, onDone, onSave }: { v: PlanVendor; first: boolean; onDone: () => void; onSave: (patch: Record<string, unknown>) => void }) {
  const [cat, setCat] = useState<BudgetCat>(v.cat);
  const [name, setName] = useState(v.name);
  const [quote, setQuote] = useState(v.quote);
  const [phone, setPhone] = useState(v.phone ?? "");
  const [link, setLink] = useState(v.link ?? "");
  const [status, setStatus] = useState<VendorStatus>(v.status);
  const [note, setNote] = useState(v.note ?? "");
  return (
    <li className="py-3" style={rowLine(first ? 0 : 1)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ cat, name, quote, phone, link, status, note });
          onDone();
        }}
        className="grid grid-cols-2 gap-2.5 min-[640px]:grid-cols-3"
      >
        <Field label="Tên" className="col-span-2">
          <input className="input px-3 py-2.5" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Hạng mục">
          <Select value={cat} options={CAT_OPTIONS} onChange={(x) => setCat((x || "other") as BudgetCat)} className="w-full" />
        </Field>
        <Field label="Báo giá">
          <MoneyField className="input w-full px-3 py-2.5" value={quote} onCommit={setQuote} live />
        </Field>
        <Field label="Số điện thoại">
          <input className="input px-3 py-2.5" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Trạng thái">
          <Select value={status} options={VENDOR_STATUS_LABEL} onChange={(x) => setStatus((x || "consider") as VendorStatus)} className="w-full" />
        </Field>
        <Field label="Website / Facebook" className="col-span-2 min-[640px]:col-span-3">
          <input className="input px-3 py-2.5" inputMode="url" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} placeholder="facebook.com/…" />
        </Field>
        <Field label="Ghi chú" className="col-span-2 min-[640px]:col-span-3">
          <textarea className="input px-3 py-2.5" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Gói gồm gì, sức chứa, người liên hệ, đánh giá…" />
        </Field>
        <div className="col-span-2 flex justify-end gap-2 min-[640px]:col-span-3">
          <GhostBtn onClick={onDone}>Huỷ</GhostBtn>
          <PrimaryBtn disabled={!name.trim()}>Lưu</PrimaryBtn>
        </div>
      </form>
    </li>
  );
}
