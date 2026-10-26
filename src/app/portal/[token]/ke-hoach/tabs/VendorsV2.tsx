"use client";

import { useState } from "react";
import { Camera, ExternalLink, Phone, Plus, Store, Wallet } from "lucide-react";
import { Badge, Card, Empty, Field, PageHead, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import { vnd } from "@/lib/types";
import {
  BUDGET_CATS, VENDOR_STATUS_LABEL, budgetCatLabel,
  type BudgetCat, type PlanVendor, type VendorStatus,
} from "@/lib/wedding-plan";
import { MoneyField, listOps, type Ctx } from "../ui";
import { BadgeBtn, FormDrawer, IconBox, RowMenu, SelectV2 } from "../uiV2";

const CAT_OPTIONS = BUDGET_CATS.map((c) => [c.key, c.label] as [BudgetCat, string]);

/**
 * NHÀ CUNG CẤP (giao diện mới) — studio của hợp đồng đứng đầu (đã chốt), rồi
 * mỗi hạng mục một khối để so báo giá. Chạm nhãn trạng thái để chốt / bỏ chốt;
 * "Đưa vào ngân sách" một chạm khi đã chốt. Thêm / sửa mở ngăn kéo. Cùng thao
 * tác với tabs/Vendors.tsx.
 */
export default function VendorsTabV2({ ctx }: { ctx: Ctx }) {
  const { data, plan, readOnly, onOp } = ctx;
  const ops = listOps(onOp);
  const [editing, setEditing] = useState<PlanVendor | null>(null);
  const [adding, setAdding] = useState(false);

  const cats = BUDGET_CATS.filter((c) => plan.vendors.some((v) => v.cat === c.key));
  const inBudget = new Set(plan.budget.map((b) => b.name.trim().toLowerCase()));

  return (
    <Stack>
      <PageHead
        desc="Lưu các bên bạn đang tìm hiểu kèm báo giá để so sánh — chốt bên nào thì đánh dấu và đưa vào ngân sách."
        actions={!readOnly && (
          <button type="button" onClick={() => setAdding(true)} className={btn("primary")}>
            <Plus size={16} /> Thêm nhà cung cấp
          </button>
        )}
      />

      <Card padded={false}>
        <div className="v2-row" style={{ borderBottom: 0 }}>
          <IconBox icon={Camera} tone="green" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
              {budgetCatLabel("photo")} <Badge tone="green">Đã chốt</Badge>
            </p>
            <p className="mt-0.5 truncate text-[14.5px] font-semibold">{data.studio_name}</p>
            {data.studio_line && <p className="tnum text-[12.5px]" style={{ color: "var(--tx2)" }}>Hợp đồng {vnd(data.studio_line.estimate)}</p>}
          </div>
          {data.studio_phone && (
            <a href={`tel:${data.studio_phone}`} className={btn("secondary", "sm")}>
              <Phone size={15} /> Gọi studio
            </a>
          )}
        </div>
      </Card>

      {cats.length === 0 && (
        <Card>
          <Empty
            icon={Store}
            title="Chưa có nhà cung cấp nào"
            hint="Lưu các bên bạn đang tìm hiểu — nhà hàng, váy cưới, hoa, MC… — kèm báo giá để so sánh và chốt."
          />
        </Card>
      )}

      {cats.map((c) => {
        const list = plan.vendors.filter((v) => v.cat === c.key).sort((a, b) => (a.status === b.status ? 0 : a.status === "booked" ? -1 : 1));
        const priced = list.filter((v) => v.quote > 0);
        const cheapest = priced.length > 1 ? priced.reduce((m, v) => (v.quote < m.quote ? v : m)) : null;
        const hasBooked = list.some((v) => v.status === "booked");
        return (
          <Section
            key={c.key}
            title={c.label}
            actions={hasBooked ? <Badge tone="green" dot>Đã chốt</Badge> : <Badge tone="amber" dot>Đang tìm · {list.length} lựa chọn</Badge>}
            flush
          >
            {list.map((v) => {
              const canBudget = !readOnly && v.status === "booked" && !inBudget.has(v.name.trim().toLowerCase());
              const toBudget = () => ops.add("budget", { cat: v.cat, name: v.name, estimate: v.quote, actual: v.quote });
              return (
                <div key={v.id} className="v2-row items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      {readOnly ? (
                        <p className="text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{v.name}</p>
                      ) : (
                        <button type="button" onClick={() => setEditing(v)} className="text-left text-[14px] font-semibold leading-snug" style={{ textWrap: "pretty" }}>{v.name}</button>
                      )}
                      {v.quote > 0 && <span className="tnum text-[14px] font-semibold">{vnd(v.quote)}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <BadgeBtn
                        tone={v.status === "booked" ? "green" : "gray"}
                        onClick={readOnly ? undefined : () => ops.set("vendors", v.id, { status: v.status === "booked" ? "consider" : "booked" })}
                        title="Chạm để đổi"
                      >
                        {VENDOR_STATUS_LABEL[v.status]}
                      </BadgeBtn>
                      {cheapest?.id === v.id && <Badge tone="blue">Rẻ nhất</Badge>}
                    </div>
                    {(v.phone || v.link) && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                        {v.phone && (
                          <a href={`tel:${v.phone}`} className="tnum inline-flex items-center gap-1 font-medium" style={{ color: "var(--ac)" }}>
                            <Phone size={13} /> {v.phone}
                          </a>
                        )}
                        {v.link && (
                          <a href={v.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 max-w-[240px] items-center gap-1 font-medium" style={{ color: "var(--ac)" }}>
                            <ExternalLink size={13} className="flex-none" /> <span className="truncate">{v.link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                          </a>
                        )}
                      </div>
                    )}
                    {v.note && <p className="mt-1 whitespace-pre-line text-[12.5px]" style={{ color: "var(--tx2)" }}>{v.note}</p>}
                    {canBudget && (
                      <button type="button" onClick={toBudget} className={btn("soft", "sm", "mt-2")}>
                        <Wallet size={14} /> Đưa vào ngân sách
                      </button>
                    )}
                  </div>
                  {!readOnly && <RowMenu label={v.name} onEdit={() => setEditing(v)} onRemove={() => ops.remove("vendors", v.id)} />}
                </div>
              );
            })}
          </Section>
        );
      })}

      {adding && <VendorAdd onClose={() => setAdding(false)} onAdd={(item) => ops.add("vendors", item)} />}
      {editing && (
        <VendorEdit v={editing} onClose={() => setEditing(null)} onSave={(patch) => ops.set("vendors", editing.id, patch)} onRemove={() => ops.remove("vendors", editing.id)} />
      )}
    </Stack>
  );
}

function VendorAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (item: Record<string, unknown>) => void }) {
  const [cat, setCat] = useState<BudgetCat>("venue");
  const [name, setName] = useState("");
  const [quote, setQuote] = useState(0);
  const [phone, setPhone] = useState("");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm nhà cung cấp"
      submitLabel="Thêm"
      canSubmit={!!name.trim()}
      onSubmit={() => {
        onAdd({ cat, name, quote, phone });
        onClose();
      }}
    >
      <Field label="Tên nhà cung cấp" className="sm:col-span-2">
        <input className={inputCls} placeholder="Ví dụ: Riverside Palace" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Hạng mục">
        <SelectV2 value={cat} options={CAT_OPTIONS} onChange={(v) => setCat((v || "other") as BudgetCat)} ariaLabel="Hạng mục" />
      </Field>
      <Field label="Báo giá">
        <MoneyField className={inputCls} value={quote} placeholder="0" ariaLabel="Báo giá" onCommit={setQuote} live />
      </Field>
      <Field label="Số điện thoại" className="sm:col-span-2">
        <input className={inputCls} inputMode="tel" placeholder="Không bắt buộc" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
    </FormDrawer>
  );
}

function VendorEdit({ v, onClose, onSave, onRemove }: { v: PlanVendor; onClose: () => void; onSave: (patch: Record<string, unknown>) => void; onRemove: () => void }) {
  const [cat, setCat] = useState<BudgetCat>(v.cat);
  const [name, setName] = useState(v.name);
  const [quote, setQuote] = useState(v.quote);
  const [phone, setPhone] = useState(v.phone ?? "");
  const [link, setLink] = useState(v.link ?? "");
  const [status, setStatus] = useState<VendorStatus>(v.status);
  const [note, setNote] = useState(v.note ?? "");
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Sửa nhà cung cấp"
      canSubmit={!!name.trim()}
      onRemove={onRemove}
      onSubmit={() => {
        onSave({ cat, name, quote, phone, link, status, note });
        onClose();
      }}
    >
      <Field label="Tên" className="sm:col-span-2">
        <input className={inputCls} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Hạng mục">
        <SelectV2 value={cat} options={CAT_OPTIONS} onChange={(x) => setCat((x || "other") as BudgetCat)} ariaLabel="Hạng mục" />
      </Field>
      <Field label="Trạng thái">
        <SelectV2 value={status} options={VENDOR_STATUS_LABEL} onChange={(x) => setStatus((x || "consider") as VendorStatus)} ariaLabel="Trạng thái" />
      </Field>
      <Field label="Báo giá">
        <MoneyField className={inputCls} value={quote} onCommit={setQuote} live ariaLabel="Báo giá" />
      </Field>
      <Field label="Số điện thoại">
        <input className={inputCls} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Website / Facebook" className="sm:col-span-2">
        <input className={inputCls} inputMode="url" value={link} maxLength={300} onChange={(e) => setLink(e.target.value)} placeholder="facebook.com/…" />
      </Field>
      <Field label="Ghi chú" className="sm:col-span-2">
        <textarea className={inputCls} rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Gói gồm gì, sức chứa, người liên hệ, đánh giá…" />
      </Field>
    </FormDrawer>
  );
}
