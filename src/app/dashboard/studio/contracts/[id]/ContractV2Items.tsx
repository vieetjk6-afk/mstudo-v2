"use client";

import Link from "next/link";
import { CalendarClock, CalendarPlus, FileText, ListPlus, PenLine, Plus, ScrollText, Tag, Trash2, X } from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Empty, Field, Section, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Menu, Segmented, type MenuItem } from "@/components/v2/kit-client";
import { vnd } from "@/lib/types";
import { PRESET_ITEMS_BY_KIND } from "@/lib/contract-kind";
import ContractAddenda from "./ContractAddenda";
import { nextTier, type ItemRow } from "./useContractEditor";
import { SaveBar, type V2Ctx } from "./ContractV2Parts";

/* ═══════════════════════════════════════════════════════════════════════════
   Tab HẠNG MỤC (giao diện mới): thêm từ bảng giá bằng một ô chọn, mỗi dòng
   gọn một hàng (tên · SL · đơn giá · ⋯), loại chính/phụ và mốc lịch nằm ở
   dòng phụ. Nút lưu chỉ hiện khi có thay đổi. Dịch vụ & điều khoản ở dưới.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Lớp bọc thẻ của bản cũ khi đặt trong giao diện mới: bỏ lề, tiêu đề cỡ khối V2. */
export const EMBED = "[&_.card]:!mb-0 [&_.card]:!p-5 [&_h2.font-serif]:!text-[15px] [&_h2.font-serif]:!font-semibold [&_h2.font-serif]:!tracking-normal";

export default function ContractV2Items({ ctx }: { ctx: V2Ctx }) {
  const { ed } = ctx;
  const { items, setItems, itemsLocked, milestones, f } = ed;
  const { pricelist, services, contract, initialAddenda, canEditAddenda } = ed.props;
  const presets = PRESET_ITEMS_BY_KIND[ed.kind];

  const setItem = (idx: number, patch: Partial<ItemRow>) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeItem = (idx: number) => {
    setItems((p) => p.filter((_, i) => i !== idx));
    ed.setMsOpen({});
  };
  /** Bỏ mọi thay đổi chưa lưu — dựng lại từ bản đã lưu. */
  const discard = () =>
    setItems(
      ed.savedItems.map((s) => ({
        name: s.name,
        description: s.description ?? undefined,
        qty: s.qty,
        unit_price: Math.abs(s.unit_price),
        is_discount: s.unit_price < 0,
        tier: (s.tier ?? "") as ItemRow["tier"],
        event_id: s.event_id,
      })),
    );

  function addFromSelect(v: string) {
    if (!v) return;
    if (v === "custom") setItems((p) => [...p, { name: "", qty: 1, unit_price: 0, tier: nextTier(p) }]);
    else if (v.startsWith("pl:")) {
      const pl = pricelist[Number(v.slice(3))];
      // Mô tả gói trong bảng giá đi theo, hiện sẵn trong ô mô tả để studio sửa.
      if (pl) setItems((p) => [...p, { name: pl.name, description: pl.description?.trim() || undefined, qty: 1, unit_price: pl.price, tier: nextTier(p) }]);
    } else if (v.startsWith("pre:")) {
      const name = v.slice(4);
      setItems((p) => [...p, { name, qty: 1, unit_price: 0, tier: nextTier(p) }]);
    }
  }

  const sub = items.reduce((s, i) => s + (i.is_discount ? 0 : (i.qty || 0) * Math.abs(i.unit_price || 0)), 0);
  const disc = items.reduce((s, i) => s + (i.is_discount ? Math.abs(i.unit_price || 0) : 0), 0);
  const addendumSum = ed.total - (sub - disc);

  return (
    <>
      <Section
        title="Hạng mục & báo giá"
        icon={ListPlus}
        desc={itemsLocked ? "Khách đã ký — bảng giá gốc đã khoá." : "Sửa xong bấm Lưu hạng mục. Khách thấy đúng bảng này trên cổng và bản in."}
        flush
      >
        {itemsLocked && (
          <div className="px-4 pt-4 sm:px-5" data-testid="items-locked">
            <Callout tone="amber" icon={PenLine}>
              Khách đã ký hợp đồng nên bảng giá gốc đã khoá. Thêm/bớt dịch vụ bằng phụ lục bên dưới — khách ký phụ lục thì mới cộng vào tổng.
            </Callout>
          </div>
        )}

        {!itemsLocked && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-4 sm:px-5">
            <select className={`${inputCls} min-w-0 flex-[1_1_240px]`} value="" aria-label="Thêm hạng mục" onChange={(e) => addFromSelect(e.target.value)}>
              <option value="">+ Thêm hạng mục từ bảng giá…</option>
              {pricelist.length > 0 && (
                <optgroup label="Bảng giá">
                  {pricelist.map((p, i) => (
                    <option key={`pl${i}`} value={`pl:${i}`}>
                      {p.name} · {vnd(p.price)}
                    </option>
                  ))}
                </optgroup>
              )}
              {presets.length > 0 && (
                <optgroup label="Gợi ý">
                  {presets.map((name) => (
                    <option key={name} value={`pre:${name}`}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value="custom">Khác — tự nhập tên…</option>
            </select>
            <button type="button" className={btn("secondary")} onClick={() => addFromSelect("custom")}>
              <Plus size={16} /> Tự nhập
            </button>
            <button
              type="button"
              className={btn("ghost")}
              style={{ color: "var(--am)" }}
              onClick={() => setItems((p) => [...p, { name: "Giảm giá", qty: 1, unit_price: 0, is_discount: true }])}
            >
              <Tag size={16} /> Giảm giá
            </button>
          </div>
        )}

        <fieldset disabled={itemsLocked} className="m-0 min-w-0 border-0 p-0">
          {items.length === 0 ? (
            <Empty compact icon={ListPlus} title="Chưa có hạng mục" hint="Chọn từ bảng giá ở trên hoặc bấm Tự nhập." />
          ) : (
            <ul className="flex flex-col gap-2.5 p-4 sm:p-5">
              {items.map((it, idx) => (
                <ItemCard
                  key={idx}
                  ctx={ctx}
                  it={it}
                  idx={idx}
                  setItem={(patch) => setItem(idx, patch)}
                  remove={() => removeItem(idx)}
                  msDate={milestones.find((m) => m.id === it.event_id)?.event_date ?? ""}
                />
              ))}
            </ul>
          )}
        </fieldset>

        <div className="flex flex-col gap-1.5 px-4 py-4 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
          {(disc > 0 || addendumSum !== 0) && (
            <>
              <TotalLine label="Cộng hạng mục" value={vnd(sub)} />
              {disc > 0 && <TotalLine label="Giảm giá" value={`− ${vnd(disc)}`} tone="var(--am)" />}
              {addendumSum !== 0 && <TotalLine label="Phụ lục đã ký" value={`${addendumSum > 0 ? "+ " : "− "}${vnd(Math.abs(addendumSum))}`} />}
            </>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13.5px] font-semibold">
              Tổng giá trị hợp đồng{ed.addendumItems.length > 0 ? " (gồm phụ lục đã ký)" : ""}
            </span>
            <span className="v2-num text-[20px] font-bold tracking-[-0.4px]">{vnd(ed.total)}</span>
          </div>
        </div>
      </Section>

      {!itemsLocked && (
        <SaveBar
          show={ed.itemsDirty}
          busy={ed.busy === "items"}
          label="Lưu hạng mục"
          onSave={ed.saveItems}
          note={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              Bảng giá có thay đổi chưa lưu
              <button type="button" className="text-[12.5px] font-semibold underline underline-offset-2" style={{ color: "var(--tx3)" }} onClick={discard}>
                Hoàn tác
              </button>
            </span>
          }
        />
      )}

      {itemsLocked && (
        <div className={EMBED}>
          <ContractAddenda contractId={contract.id} initialAddenda={initialAddenda} canEdit={canEditAddenda} onChanged={ed.setAddendumItems} toast={ed.toast} />
        </div>
      )}

      {/* Dịch vụ & điều khoản: chọn dịch vụ là nạp lại bộ điều khoản ngay dưới. */}
      <Section title="Dịch vụ & điều khoản" icon={ScrollText} desc="Chọn dịch vụ là nạp lại bộ điều khoản in trên hợp đồng.">
        <div className="flex flex-col gap-4">
          <Field label="Loại dịch vụ" htmlFor="it-svc">
            {services.length > 0 ? (
              <select id="it-svc" className={inputCls} value={f.service_id} onChange={(e) => ed.changeService(e.target.value)}>
                <option value="">Khác</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input id="it-svc" className={inputCls} value="Khác" disabled />
            )}
          </Field>
          <Field
            label="Điều khoản hợp đồng"
            hint={
              <>
                Cố định theo dịch vụ — không sửa ở đây.{" "}
                <Link href="/dashboard/studio/services" className="font-semibold" style={{ color: "var(--ac)" }}>
                  Sửa trong Dịch vụ &amp; điều khoản
                </Link>
              </>
            }
          >
            {f.note.trim() ? (
              <textarea className={inputCls} rows={7} value={f.note} readOnly style={{ background: "var(--sf2)", color: "var(--tx2)", cursor: "default" }} aria-label="Điều khoản hợp đồng" />
            ) : (
              <p className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }}>
                <FileText size={15} /> Chưa có điều khoản — chọn một dịch vụ có điều khoản.
              </p>
            )}
          </Field>
        </div>
      </Section>
    </>
  );
}

function TotalLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]" style={{ color: "var(--tx2)" }}>
      <span>{label}</span>
      <span className="v2-num font-medium" style={{ color: tone ?? "var(--tx)" }}>
        {value}
      </span>
    </div>
  );
}

/* ── Một dòng hạng mục ── */
function ItemCard({
  ctx,
  it,
  idx,
  setItem,
  remove,
  msDate,
}: {
  ctx: V2Ctx;
  it: ItemRow;
  idx: number;
  setItem: (patch: Partial<ItemRow>) => void;
  remove: () => void;
  msDate: string;
}) {
  const { ed } = ctx;
  const disc = !!it.is_discount;
  const msOpen = !!ed.msOpen[idx];
  const amount = disc ? Math.abs(it.unit_price || 0) : (it.qty || 0) * Math.abs(it.unit_price || 0);
  const hasDesc = it.description != null;

  const menu: MenuItem[] = [
    hasDesc
      ? { label: "Bỏ mô tả", icon: X, onClick: () => setItem({ description: undefined }) }
      : { label: "Thêm mô tả", icon: FileText, onClick: () => setItem({ description: "" }), hint: "Phạm vi công việc, số ảnh, thời gian giao…" },
    ...(!disc && !it.event_id && !msOpen
      ? [{ label: "Thêm vào lịch chụp", icon: CalendarPlus, hint: "Tạo một mốc lịch mang tên hạng mục", onClick: () => ed.setMsOpen((p) => ({ ...p, [idx]: true })) }]
      : []),
    "divider" as const,
    { label: "Xoá dòng này", icon: Trash2, danger: true, onClick: remove },
  ];

  return (
    <li
      className="rounded-[14px] p-3 sm:p-3.5"
      style={{ border: `1px solid ${disc ? "color-mix(in srgb, var(--am) 35%, var(--bd))" : "var(--bd)"}`, background: disc ? "var(--amS)" : "var(--sf)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputCls} min-w-0 flex-[1_1_260px] font-medium`}
          placeholder={disc ? "Tên khoản giảm giá" : "vd: Chụp phóng sự cả ngày"}
          value={it.name}
          onChange={(e) => setItem({ name: e.target.value })}
          aria-label="Tên hạng mục"
        />
        <div className="flex min-w-0 flex-[1_1_200px] items-center gap-2 sm:flex-none">
          {!disc && (
            <input
              type="number"
              className={`${inputCls} w-[68px] flex-none text-center`}
              value={it.qty}
              onChange={(e) => setItem({ qty: Number(e.target.value) })}
              aria-label="Số lượng"
              title="Số lượng"
            />
          )}
          <MoneyInput className={`${inputCls} min-w-0 flex-1 text-right sm:w-[150px] sm:flex-none`} value={it.unit_price} onChange={(n) => setItem({ unit_price: n })} ariaLabel={disc ? "Số tiền giảm" : "Đơn giá"} placeholder="0" />
          <Menu items={menu} label={`Thao tác cho ${it.name || "hạng mục"}`} />
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {disc ? (
          <Badge tone="amber" icon={Tag}>
            Giảm giá
          </Badge>
        ) : (
          <Segmented<"main" | "sub" | "">
            size="sm"
            label="Loại hạng mục"
            value={it.tier ?? ""}
            onChange={(t) => setItem({ tier: t })}
            options={[
              { value: "main", label: "Chính" },
              { value: "sub", label: "Phụ" },
            ]}
          />
        )}

        {!disc && (it.event_id || msOpen) && (
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarClock size={15} className="flex-none" style={{ color: it.event_id ? "var(--ac)" : "var(--tx3)" }} />
            <span className="text-[12.5px] font-medium" style={{ color: "var(--tx2)" }}>
              {it.event_id ? "Mốc lịch" : "Chọn ngày"}
            </span>
            <DateInput
              wrapperClassName="w-[150px] flex-none"
              className={`${inputCls} !h-8 !text-[13px]`}
              lunar={false}
              disabled={ed.busy === "item-ms"}
              value={msDate}
              onChange={(v) => {
                if (!v) return;
                if (!it.name.trim()) {
                  ed.toast("Nhập tên hạng mục trước — tên đó sẽ là tên mốc lịch.");
                  return;
                }
                ed.setMsOpen((p) => ({ ...p, [idx]: false }));
                ed.linkItemToMilestone(idx, v);
              }}
            />
            <button
              type="button"
              className={iconBtn("!h-8 !w-8")}
              aria-label={it.event_id ? "Bỏ mốc lịch" : "Thôi"}
              title={it.event_id ? "Bỏ mốc lịch" : "Thôi"}
              onClick={() =>
                it.event_id
                  ? ctx.ask({
                      title: "Bỏ mốc lịch của hạng mục này?",
                      desc: "Mốc sẽ bị xoá khỏi lịch (cả Google Lịch nếu đã đồng bộ).",
                      confirm: "Bỏ mốc lịch",
                      danger: true,
                      run: () => ed.unlinkItemMilestoneNow(idx),
                    })
                  : ed.setMsOpen((p) => ({ ...p, [idx]: false }))
              }
            >
              <X size={15} />
            </button>
          </span>
        )}

        <span className="v2-num ml-auto text-[13.5px] font-semibold" style={{ color: disc ? "var(--am)" : "var(--tx)" }}>
          {disc ? "− " : ""}
          {vnd(amount)}
        </span>
      </div>

      {hasDesc && (
        <textarea
          className={`${inputCls} mt-2.5`}
          rows={2}
          style={{ minHeight: 64 }}
          autoFocus={it.description === ""}
          placeholder="Mô tả chi tiết: phạm vi công việc, số ảnh, thời gian giao…"
          value={it.description}
          onChange={(e) => setItem({ description: e.target.value })}
          aria-label="Mô tả hạng mục"
        />
      )}
    </li>
  );
}
