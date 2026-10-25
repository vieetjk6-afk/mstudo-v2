"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check, Copy, ExternalLink, Eye, EyeOff, FileEdit, GripVertical, Home, Landmark, ListOrdered, Palette, Pencil, Plus,
  Sparkles, StickyNote, Tags, Trash2, X,
} from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import { Badge, Callout, Empty, Field, PageHead, Stack, btn, iconBtn, inputCls } from "@/components/v2/kit";
import { Drawer, Menu, Tabs } from "@/components/v2/kit-client";
import { vnd, type PricelistItem } from "@/lib/types";
import { PaneItemV2, SaveBarV2 } from "../services/settings-v2";
import { usePricing, type PricingProps, type PricingState } from "./usePricing";
import { AppearanceTabV2, ContactTabV2 } from "./PricingSettingsV2";

/* ═══════════════════════════════════════════════════════════════════════════
   GÓI & BẢNG GIÁ — giao diện mới. Cùng logic với PricingManager (./usePricing);
   khác ở cách sắp xếp:
     • Ba tab: Bảng giá · Liên hệ & chuyển khoản · Giao diện. Phần cài đặt dùng
       chung cho mọi bảng giá không còn chen giữa danh sách gói nữa.
     • Tab Bảng giá là màn "danh sách | trình sửa": cột trái các bảng giá (thêm
       loại, khôi phục bảng đã ẩn), cột phải bảng đang mở: link gửi khách, các
       gói (kéo thả đổi thứ tự), chi phí phát sinh & lưu ý. Đổi tên / xoá bảng
       vào ⋯ ở đầu bảng; sửa từng mục bằng ngăn kéo.
     • "Tạo báo giá" mở ngăn kéo chọn gói (chỉ gói Studio, như bản cũ).
     • Liên hệ / giao diện có thay đổi là hiện thanh Lưu dính đáy.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = "lists" | "contact" | "look";
type Sheet = null | "add-pkg" | "add-note";

export default function PricingV2(props: PricingProps & { bankAuto?: React.ReactNode }) {
  const { canQuote = false, bankAuto } = props;
  const p = usePricing(props);
  const [tab, setTab] = useState<Tab>("lists");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const activeLabel = p.getLabel(p.activeList, p.allLists.find((l) => l.key === p.activeList)?.label ?? "");
  const settingsDirty = p.contactDirty || p.appearDirty;

  async function saveSettings() {
    setSavingSettings(true);
    try {
      if (p.contactDirty) await p.saveContact();
      if (p.appearDirty) await p.saveAppearance();
    } finally {
      setSavingSettings(false);
    }
  }

  const actions =
    tab === "lists" ? (
      <>
        {canQuote ? (
          <button type="button" onClick={p.toggleQuoteOpen} className={btn("secondary")}>
            <FileEdit size={16} /> Tạo báo giá
          </button>
        ) : null}
        <button type="button" onClick={() => setSheet("add-pkg")} className={btn("primary")}>
          <Plus size={17} /> Thêm gói
        </button>
      </>
    ) : null;

  return (
    <Stack>
      <PageHead
        desc={
          tab === "lists"
            ? "Mỗi loại dịch vụ có một bảng giá và link riêng để gửi khách."
            : tab === "contact"
              ? "Số điện thoại, Facebook và tài khoản ngân hàng in trên mọi bảng giá gửi khách."
              : "Màu nền, màu chữ, màu nhấn và logo của bảng giá gửi khách."
        }
        actions={actions}
      />

      <Tabs<Tab>
        label="Gói & bảng giá"
        value={tab}
        onChange={setTab}
        options={[
          { value: "lists", label: "Bảng giá", icon: ListOrdered, count: p.allLists.length },
          { value: "contact", label: <>Liên hệ & chuyển khoản{p.contactDirty ? <Dot /> : null}</>, icon: Landmark },
          { value: "look", label: <>Giao diện{p.appearDirty ? <Dot /> : null}</>, icon: Palette },
        ]}
      />

      {tab === "lists" ? (
        <ListsTab p={p} activeLabel={activeLabel} onAddPkg={() => setSheet("add-pkg")} onAddNote={() => setSheet("add-note")} />
      ) : tab === "contact" ? (
        <ContactTabV2 p={p} bankAuto={bankAuto} />
      ) : (
        <AppearanceTabV2 p={p} ownerId={props.ownerId} />
      )}

      <SaveBarV2
        show={settingsDirty}
        label={
          p.contactDirty && p.appearDirty
            ? "Liên hệ và giao diện bảng giá có thay đổi chưa lưu"
            : p.contactDirty
              ? "Liên hệ & chuyển khoản có thay đổi chưa lưu"
              : "Giao diện bảng giá có thay đổi chưa lưu"
        }
        saving={savingSettings}
        onSave={() => void saveSettings()}
        onReset={() => {
          p.resetContact();
          p.resetAppearance();
        }}
      />

      <ItemDrawer p={p} sheet={sheet} onClose={() => setSheet(null)} activeLabel={activeLabel} />
      {canQuote ? <QuoteDrawer p={p} activeLabel={activeLabel} /> : null}
    </Stack>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--am)" }} title="Có thay đổi chưa lưu" />;
}

/* ── Tab Bảng giá ────────────────────────────────────────────────────────── */
function ListsTab({ p, activeLabel, onAddPkg, onAddNote }: { p: PricingState; activeLabel: string; onAddPkg: () => void; onAddNote: () => void }) {
  const countOf = (key: string) => {
    const rows = p.list.filter((it) => (it.list_key || "cuoi") === key);
    return { pk: rows.filter((it) => it.price > 0).length, nt: rows.filter((it) => it.price === 0).length };
  };
  const activeIsCustom = p.visibleCustom.some((l) => l.key === p.activeList);
  const renaming = p.renamingKey === p.activeList;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Cột trái: các bảng giá */}
      <div className="v2-card overflow-hidden lg:sticky lg:top-[84px]">
        <div className="px-4 py-3 sm:px-5" style={{ borderBottom: "1px solid var(--bd2)" }}>
          <p className="v2-section-title">Các bảng giá</p>
          <p className="v2-section-desc">Mỗi bảng một link riêng gửi khách</p>
        </div>
        {p.allLists.map((l) => {
          const n = countOf(l.key);
          return (
            <PaneItemV2
              key={l.key}
              icon={Tags}
              active={p.activeList === l.key}
              onClick={() => p.setActiveList(l.key)}
              title={p.getLabel(l.key, l.label)}
              sub={`${n.pk} gói${n.nt ? ` · ${n.nt} ghi chú` : ""}`}
            />
          );
        })}
        <div className="px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--bd2)", background: "var(--sf2)" }}>
          {p.showNewList ? (
            <div className="flex gap-2">
              <input
                autoFocus
                className={inputCls}
                placeholder="Tên loại mới…"
                value={p.newListName}
                onChange={(e) => p.setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void p.addCustomList();
                  if (e.key === "Escape") p.setShowNewList(false);
                }}
                aria-label="Tên loại bảng giá mới"
              />
              <button type="button" onClick={() => void p.addCustomList()} className={iconBtn()} aria-label="Tạo bảng giá" title="Tạo bảng giá" style={{ color: "var(--ac)" }}>
                <Check size={17} />
              </button>
              <button type="button" onClick={() => p.setShowNewList(false)} className={iconBtn()} aria-label="Huỷ tạo bảng giá" title="Huỷ">
                <X size={17} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => p.setShowNewList(true)} className={btn("ghost", "sm", "w-full")} style={{ border: "1px dashed var(--bdS)" }}>
              <Plus size={15} /> Thêm loại bảng giá
            </button>
          )}
          {p.hiddenRestorable.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: "var(--tx3)" }}>
              <span>Đã ẩn:</span>
              {p.hiddenRestorable.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => void p.restoreBuiltinList(l.key)}
                  className="inline-flex h-6 items-center gap-1 rounded-full px-2 font-semibold"
                  style={{ border: "1px dashed var(--bdS)", color: "var(--tx2)" }}
                  title="Khôi phục bảng giá"
                >
                  <Plus size={11} /> {l.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Cột phải: bảng giá đang mở */}
      <div className="flex min-w-0 flex-col gap-4">
        <section className="v2-card">
          <header className="v2-section-head">
            <span className="v2-section-icon"><Tags size={17} /></span>
            <div className="min-w-0 flex-1">
              {renaming ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className={inputCls}
                    value={p.renameVal}
                    onChange={(e) => p.setRenameVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void p.saveRename(p.activeList);
                      if (e.key === "Escape") p.setRenamingKey(null);
                    }}
                    aria-label="Tên bảng giá"
                  />
                  <button type="button" onClick={() => void p.saveRename(p.activeList)} className={iconBtn()} aria-label="Lưu tên bảng giá" title="Lưu" style={{ color: "var(--ac)" }}>
                    <Check size={17} />
                  </button>
                  <button type="button" onClick={() => p.setRenamingKey(null)} className={iconBtn()} aria-label="Huỷ đổi tên" title="Huỷ">
                    <X size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="v2-section-title truncate">Bảng giá {activeLabel}</h3>
                  <p className="v2-section-desc truncate" title={p.listUrl || undefined}>{p.listUrl || "Chưa có link gửi khách"}</p>
                </>
              )}
            </div>
            {!renaming ? (
              <div className="flex flex-none items-center gap-2">
                {p.listUrl ? (
                  <>
                    <a href={p.listUrl} target="_blank" rel="noreferrer" className={btn("ghost", "sm", "hidden sm:inline-flex")}>
                      <ExternalLink size={15} /> Xem thử
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(p.listUrl);
                        p.setCopied(true);
                        setTimeout(() => p.setCopied(false), 1500);
                      }}
                      className={btn("secondary", "sm")}
                    >
                      {p.copied ? <Check size={15} /> : <Copy size={15} />} {p.copied ? "Đã chép" : "Chép link"}
                    </button>
                  </>
                ) : null}
                <Menu
                  label={`Thao tác với bảng giá ${activeLabel}`}
                  width={240}
                  items={[
                    ...(p.listUrl ? [{ label: "Xem thử trang khách", icon: ExternalLink, href: p.listUrl, external: true }] : []),
                    { label: "Đổi tên bảng giá", icon: Pencil, onClick: () => p.startRename(p.activeList, activeLabel) },
                    "divider",
                    {
                      label: activeIsCustom ? "Xoá bảng giá này" : "Ẩn bảng giá này",
                      hint: activeIsCustom ? undefined : "Khôi phục lại được",
                      icon: Trash2,
                      danger: true,
                      onClick: () => void (activeIsCustom ? p.removeCustomList(p.activeList) : p.removeBuiltinList(p.activeList)),
                    },
                  ]}
                />
              </div>
            ) : null}
          </header>

          {p.visible.length === 0 ? (
            <Empty
              icon={Sparkles}
              title={`Bảng giá ${activeLabel} đang trống`}
              hint="Dùng bộ giá mẫu để có ngay khung gói, hoặc tự thêm từng gói."
              action={
                <>
                  <button type="button" onClick={() => void p.seedActive()} disabled={p.busy} className={btn("soft")}>
                    <Sparkles size={16} /> Dùng mẫu giá {activeLabel}
                  </button>
                  <button type="button" onClick={onAddPkg} className={btn("secondary")}>
                    <Plus size={16} /> Thêm gói
                  </button>
                </>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5" style={{ background: "var(--sf2)", borderBottom: "1px solid var(--bd2)" }}>
                <p className="text-[12.5px] font-semibold" style={{ color: "var(--tx2)" }}>Các gói dịch vụ · {p.pkgs.length}</p>
                {p.pkgs.length > 1 ? (
                  <p className="hidden items-center gap-1 text-[12px] sm:flex" style={{ color: "var(--tx3)" }}>
                    <GripVertical size={13} /> Kéo để đổi vị trí
                  </p>
                ) : null}
              </div>
              {p.pkgs.length === 0 ? (
                <Empty compact icon={Tags} title="Chưa có gói nào" hint="Bấm “Thêm gói” ở đầu trang." />
              ) : (
                p.pkgs.map((it) => <PkgRow key={it.id} it={it} p={p} />)
              )}
            </>
          )}
        </section>

        {p.visible.length > 0 ? (
          <section className="v2-card">
            <header className="v2-section-head">
              <span className="v2-section-icon"><StickyNote size={17} /></span>
              <div className="min-w-0 flex-1">
                <h3 className="v2-section-title">Chi phí phát sinh & lưu ý</h3>
                <p className="v2-section-desc">Hiện tách riêng ở cuối bảng giá.</p>
              </div>
              <button type="button" onClick={onAddNote} className={btn("secondary", "sm")}>
                <Plus size={15} /> Thêm mục
              </button>
            </header>
            {p.notes.length === 0 ? (
              <Empty compact icon={StickyNote} title="Chưa có mục ghi chú" hint="VD: phụ thu đi tỉnh, chụp thêm giờ, lưu ý trang phục…" />
            ) : (
              p.notes.map((it) => (
                <div key={it.id} className="v2-row !items-start" style={{ opacity: it.active ? 1 : 0.55 }}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                      {it.category || it.name}
                      {!it.active ? <Badge tone="gray">Đang ẩn</Badge> : null}
                    </p>
                    {it.description ? <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-[13px]" style={{ color: "var(--tx3)" }}>{it.description}</p> : null}
                  </div>
                  <button type="button" onClick={() => p.startEdit(it)} className={iconBtn()} aria-label={`Sửa ${it.category || it.name}`} title="Sửa">
                    <Pencil size={16} />
                  </button>
                  <Menu
                    label={`Thao tác với ${it.category || it.name}`}
                    items={[
                      { label: it.active ? "Ẩn khỏi bảng giá" : "Hiện lại", icon: it.active ? EyeOff : Eye, onClick: () => void p.toggleActive(it) },
                      "divider",
                      { label: "Xoá mục", icon: Trash2, danger: true, onClick: () => void p.remove(it.id) },
                    ]}
                  />
                </div>
              ))
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function PkgRow({ it, p }: { it: PricelistItem; p: PricingState }) {
  return (
    <div
      draggable
      onDragStart={() => p.setDragId(it.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => void p.reorderPkg(it.id)}
      onDragEnd={() => p.setDragId(null)}
      className="v2-row !items-start"
      style={{ opacity: p.dragId === it.id ? 0.4 : it.active ? 1 : 0.55 }}
    >
      <GripVertical size={16} className="mt-1 hidden flex-none cursor-grab sm:block" style={{ color: "var(--tx3)" }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold">
          <span className="min-w-0">{it.name}</span>
          {it.category ? <Badge tone="gray">{it.category}</Badge> : null}
          {!it.active ? <Badge tone="gray">Đang ẩn</Badge> : null}
          {it.active && !it.show_on_home ? <Badge tone="amber">Ẩn ở trang chủ</Badge> : null}
        </p>
        {/* Điện thoại: giá nằm ngay dưới tên, nhường chỗ cho tên gói dài. */}
        <p className="v2-num mt-0.5 text-[14px] font-bold sm:hidden" style={{ color: "var(--ac)" }}>
          {vnd(it.price)}
          {it.unit ? <span className="font-medium" style={{ color: "var(--tx3)" }}> {it.unit}</span> : null}
        </p>
        {it.description ? <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-[13px]" style={{ color: "var(--tx3)" }}>{it.description}</p> : null}
      </div>
      <p className="v2-num hidden flex-none text-right text-[15px] font-bold sm:block" style={{ color: "var(--ac)" }}>
        {vnd(it.price)}
        {it.unit ? <span className="block text-[12px] font-medium" style={{ color: "var(--tx3)" }}>{it.unit}</span> : null}
      </p>
      <button type="button" onClick={() => p.startEdit(it)} className={iconBtn()} aria-label={`Sửa ${it.name}`} title="Sửa">
        <Pencil size={16} />
      </button>
      <Menu
        label={`Thao tác với ${it.name}`}
        width={240}
        items={[
          {
            label: it.show_on_home ? "Ẩn ở trang chủ" : "Hiện ở trang chủ",
            hint: it.show_on_home ? "Đang hiện trên website" : "Đang ẩn trên website",
            icon: Home,
            onClick: () => void p.toggleHome(it),
          },
          { label: it.active ? "Ẩn khỏi bảng giá" : "Hiện lại trong bảng giá", icon: it.active ? EyeOff : Eye, onClick: () => void p.toggleActive(it) },
          "divider",
          { label: "Xoá gói", icon: Trash2, danger: true, onClick: () => void p.remove(it.id) },
        ]}
      />
    </div>
  );
}

/* ── Ngăn kéo thêm / sửa một mục ─────────────────────────────────────────── */
function ItemDrawer({ p, sheet, onClose, activeLabel }: { p: PricingState; sheet: Sheet; onClose: () => void; activeLabel: string }) {
  const editing = p.editId ? p.list.find((x) => x.id === p.editId) ?? null : null;
  const isNote = editing ? editing.price === 0 : sheet === "add-note";
  const open = !!editing || sheet !== null;
  const close = () => {
    p.setEditId(null);
    onClose();
  };
  const title = editing ? (isNote ? "Sửa mục ghi chú" : "Sửa gói") : isNote ? "Thêm mục ghi chú" : "Thêm gói";

  async function submit() {
    if (editing) {
      await p.saveEdit(editing.id);
      onClose();
      return;
    }
    const ok = isNote ? await p.addNote() : await p.add();
    if (ok) onClose();
  }

  const disabled = editing ? false : isNote ? !p.note.name.trim() && !p.note.description.trim() : !p.f.name.trim();

  return (
    <Drawer
      open={open}
      onClose={close}
      title={title}
      desc={`Bảng giá ${activeLabel}`}
      footer={
        <>
          <button type="button" onClick={close} className={btn("ghost")}>Huỷ</button>
          <button type="button" onClick={() => void submit()} disabled={p.busy || disabled} className={btn("primary")}>
            {editing ? <Check size={16} /> : <Plus size={16} />} {editing ? "Lưu" : p.busy ? "Đang thêm…" : isNote ? "Thêm mục" : "Thêm vào bảng giá"}
          </button>
        </>
      }
    >
      {open ? (
        isNote ? (
          editing ? (
            <NoteFields
              title={p.edit.category}
              body={p.edit.description}
              onTitle={(v) => p.setEdit((x) => ({ ...x, category: v, name: v }))}
              onBody={(v) => p.setEdit((x) => ({ ...x, description: v }))}
            />
          ) : (
            <NoteFields
              title={p.note.name}
              body={p.note.description}
              onTitle={(v) => p.setNote((x) => ({ ...x, name: v }))}
              onBody={(v) => p.setNote((x) => ({ ...x, description: v }))}
            />
          )
        ) : editing ? (
          <PkgFields v={p.edit} set={(patch) => p.setEdit((x) => ({ ...x, ...patch }))} categories={p.categoryOptions} />
        ) : (
          <PkgFields v={p.f} set={(patch) => p.setF((x) => ({ ...x, ...patch }))} categories={p.categoryOptions} />
        )
      ) : null}
    </Drawer>
  );
}

type PkgDraft = { name: string; price: number; unit: string; category: string; description: string };

function PkgFields({ v, set, categories }: { v: PkgDraft; set: (patch: Partial<PkgDraft>) => void; categories: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tên gói">
        <input className={inputCls} value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="VD: Phóng sự cưới trọn ngày" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Giá">
          <MoneyInput className={inputCls} value={v.price} onChange={(n) => set({ price: n })} ariaLabel="Giá" />
        </Field>
        <Field label="Đơn vị">
          <input className={inputCls} placeholder="/ gói" value={v.unit} onChange={(e) => set({ unit: e.target.value })} />
        </Field>
      </div>
      <Field label="Nhóm" hint="Gói cùng nhóm đứng cạnh nhau trên bảng giá.">
        <input className={inputCls} placeholder="Gói chụp / Gói quay…" value={v.category} list="pricing-category-v2" onChange={(e) => set({ category: e.target.value })} />
        <datalist id="pricing-category-v2">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>
      <Field label="Mô tả" hint="Mỗi dòng một ý.">
        <textarea className={`${inputCls} !min-h-[140px]`} value={v.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      {v.price === 0 ? (
        <Callout tone="blue">Mục giá 0đ được xếp vào “Chi phí phát sinh & lưu ý”, không hiện như một gói.</Callout>
      ) : null}
    </div>
  );
}

function NoteFields({ title, body, onTitle, onBody }: { title: string; body: string; onTitle: (v: string) => void; onBody: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tiêu đề">
        <input className={inputCls} value={title} onChange={(e) => onTitle(e.target.value)} placeholder="VD: Phát sinh thêm, Lưu ý…" autoFocus />
      </Field>
      <Field label="Nội dung" hint="Mỗi dòng một ý.">
        <textarea className={`${inputCls} !min-h-[160px]`} value={body} onChange={(e) => onBody(e.target.value)} />
      </Field>
    </div>
  );
}

/* ── Ngăn kéo tạo báo giá từ bảng giá ────────────────────────────────────── */
function QuoteDrawer({ p, activeLabel }: { p: PricingState; activeLabel: string }) {
  const picked = p.pkgs.filter((x) => p.quotePicks.has(x.id));
  return (
    <Drawer
      open={p.quoteOpen}
      onClose={p.toggleQuoteOpen}
      title="Tạo báo giá cho khách"
      desc={`Chọn gói từ bảng giá ${activeLabel} — không cần nhập lại.`}
      footer={
        <>
          <Link href="/dashboard/studio/quotes" className={btn("ghost", "md", "mr-auto")}>
            Danh sách báo giá
          </Link>
          <button type="button" onClick={() => void p.createQuoteFromList()} disabled={p.quoteBusy || p.pkgs.length === 0} className={btn("primary")}>
            <FileEdit size={16} /> {p.quoteBusy ? "Đang tạo…" : `Tạo báo giá (${p.quotePicks.size} gói)`}
          </button>
        </>
      }
    >
      {p.pkgs.length === 0 ? (
        <Empty compact icon={Tags} title="Bảng giá này chưa có gói nào" hint="Thêm gói rồi tạo báo giá." />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="v2-card overflow-hidden" style={{ boxShadow: "none" }}>
            {p.pkgs.map((x) => {
              const on = p.quotePicks.has(x.id);
              return (
                <label key={x.id} className="v2-row v2-row-link cursor-pointer" style={on ? { background: "var(--acS)" } : undefined}>
                  <input type="checkbox" className="h-4 w-4 flex-none" checked={on} onChange={() => p.toggleQuotePick(x.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="v2-row-title">{x.name}</p>
                    {x.category ? <p className="v2-row-sub">{x.category}</p> : null}
                  </div>
                  <span className="v2-num flex-none font-semibold">{vnd(x.price)}</span>
                </label>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên khách (tuỳ chọn)">
              <input className={inputCls} value={p.quoteClient.name} onChange={(e) => p.setQuoteClient((x) => ({ ...x, name: e.target.value }))} />
            </Field>
            <Field label="SĐT khách (tuỳ chọn)">
              <input className={inputCls} inputMode="numeric" value={p.quoteClient.phone} onChange={(e) => p.setQuoteClient((x) => ({ ...x, phone: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-baseline justify-between rounded-[12px] px-4 py-3" style={{ background: "var(--sf2)" }}>
            <span className="text-[13px]" style={{ color: "var(--tx2)" }}>Tạm tính {picked.length} gói</span>
            <span className="v2-num text-[18px] font-bold">{vnd(picked.reduce((s, x) => s + (x.price || 0), 0))}</span>
          </div>
          {p.quoteErr ? <Callout tone="red">{p.quoteErr}</Callout> : null}
        </div>
      )}
    </Drawer>
  );
}
