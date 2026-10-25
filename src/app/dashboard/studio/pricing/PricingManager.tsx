"use client";

import Link from "next/link";
import { Plus, Trash2, Link as LinkIcon, Copy, Check, Eye, EyeOff, Sparkles, Pencil, X, Home, GripVertical, FileEdit, ChevronDown } from "lucide-react";
import MoneyInput from "@/components/MoneyInput";
import LogoUpload from "@/components/LogoUpload";
import { BANKS } from "@/lib/banks";
import { VietQR } from "@/components/VietQR";
import { vnd } from "@/lib/types";
import { DEFAULT_APPEARANCE, usePricing, type Appearance, type PricingProps } from "./usePricing";

/** Bản cũ. Giao diện mới là PricingV2 — page.tsx chọn bản theo isUiV2(). */
export default function PricingManager(props: PricingProps) {
  const { ownerId, canQuote = false } = props;
  // Logic dùng chung với bản mới (PricingV2) — xem ./usePricing.
  const {
    activeList, add, addCustomList, addNote, allLists, ap, busy, c, categoryOptions, copied, createQuoteFromList, dragId, edit, editId, f, getLabel, hiddenRestorable, listUrl, newListName, note, notes, pkgs, quoteBusy, quoteClient, quoteErr, quoteOpen, quotePicks, remove, removeBuiltinList, removeCustomList, renameVal, renamingKey, reorderPkg, restoreBuiltinList, saveAppearance, saveContact, saveEdit, saveRename, savedAppear, savedContact, seedActive, setActiveList, setAp, setC, setCopied, setDragId, setEdit, setEditId, setF, setNewListName, setNote, setQuoteClient, setRenameVal, setRenamingKey, setShowNewList, showClauses, showNewList, startEdit, startRename, toggleActive, toggleHome, toggleQuoteOpen, toggleQuotePick, toggleShowClauses, visible, visibleCustom,
  } = usePricing(props);

  return (
    <div className="page-in">
      <p className="mb-3.5 text-[13px]" style={{ color: "var(--tx2)" }}>
        Mỗi loại dịch vụ có một bảng giá và link riêng để gửi khách.
      </p>

      {/* List tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {allLists.map((l) => {
          const isCustom = visibleCustom.some((c) => c.key === l.key);
          const displayLabel = getLabel(l.key, l.label);
          return (
            <div key={l.key} className="relative flex items-center">
              {renamingKey === l.key ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="input h-9 w-36 rounded-full px-3 text-sm"
                    value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveRename(l.key); if (e.key === "Escape") setRenamingKey(null); }}
                  />
                  <button onClick={() => saveRename(l.key)} className="btn-primary rounded-full px-2 py-1.5 text-xs" aria-label="Lưu tên bảng giá" title="Lưu tên bảng giá"><Check size={13} /></button>
                  <button onClick={() => setRenamingKey(null)} className="btn-ghost rounded-full px-2 py-1.5 text-xs" aria-label="Huỷ đổi tên" title="Huỷ đổi tên"><X size={13} /></button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setActiveList(l.key)}
                    className="rounded-[9px] px-4 py-2 text-[12.5px] font-semibold"
                    style={{
                      background: activeList === l.key ? "var(--acS)" : "var(--sf)",
                      border: `1px solid ${activeList === l.key ? "var(--acM)" : "var(--bd)"}`,
                      color: activeList === l.key ? "var(--ac)" : "var(--tx2)",
                      paddingRight: 48,
                    }}
                  >
                    Bảng giá {displayLabel}
                  </button>
                  <button
                    onClick={() => startRename(l.key, l.label)}
                    className="absolute right-7 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ color: "var(--text3)" }}
                    title="Đổi tên bảng giá"
                  >
                    <Pencil size={10} />
                  </button>
                  <button
                    onClick={() => (isCustom ? removeCustomList(l.key) : removeBuiltinList(l.key))}
                    className="absolute right-1 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ color: "var(--text3)" }}
                    title="Xoá bảng giá này"
                  >
                    <X size={11} />
                  </button>
                </>
              )}
            </div>
          );
        })}

        {/* Add new list type */}
        {showNewList ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              className="input h-9 w-36 rounded-full px-3 text-sm"
              placeholder="Tên loại mới…"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCustomList(); if (e.key === "Escape") setShowNewList(false); }}
            />
            <button onClick={addCustomList} className="btn-primary rounded-full px-3 py-1.5 text-xs" aria-label="Tạo bảng giá" title="Tạo bảng giá"><Check size={13} /></button>
            <button onClick={() => setShowNewList(false)} className="btn-ghost rounded-full px-3 py-1.5 text-xs" aria-label="Huỷ tạo bảng giá" title="Huỷ tạo bảng giá"><X size={13} /></button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewList(true)}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium"
            style={{ border: "1px dashed var(--border2)", color: "var(--text3)" }}
          >
            <Plus size={13} /> Thêm loại mới
          </button>
        )}
      </div>

      {/* Restore hidden built-in lists */}
      {hiddenRestorable.length > 0 && (
        <div className="mb-6 -mt-2 flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--text3)" }}>
          <span>Đã ẩn:</span>
          {hiddenRestorable.map((l) => (
            <button
              key={l.key}
              onClick={() => restoreBuiltinList(l.key)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1"
              style={{ border: "1px dashed var(--border2)" }}
              title="Khôi phục bảng giá"
            >
              <Plus size={11} /> {l.label}
            </button>
          ))}
        </div>
      )}

      {listUrl && (
        <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
          <LinkIcon size={16} style={{ color: "var(--text3)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text3)" }}>Link bảng giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")} gửi khách</p>
            <p className="truncate text-sm" style={{ color: "var(--text2)" }}>{listUrl}</p>
          </div>
          <a href={listUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">Xem thử</a>
          <button onClick={() => { navigator.clipboard?.writeText(listUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost px-3 py-2 text-xs">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
          </button>
        </div>
      )}

      {/* Báo giá nhanh — gộp tính năng báo giá vào bảng giá cho gọn */}
      {canQuote && (
      <div className="card mb-6 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FileEdit size={16} style={{ color: "var(--accent)" }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Báo giá cho khách</p>
            <p className="text-[12px]" style={{ color: "var(--text3)" }}>Chọn gói từ bảng giá này để tạo báo giá gửi khách — không cần nhập lại.</p>
          </div>
          <Link href="/dashboard/studio/quotes" className="btn-ghost px-3 py-2 text-xs">Danh sách báo giá</Link>
          <button onClick={toggleQuoteOpen} className="btn-primary px-3 py-2 text-xs">
            <ChevronDown size={14} className="transition-transform" style={{ transform: quoteOpen ? "rotate(180deg)" : "none" }} /> Tạo báo giá
          </button>
        </div>

        {quoteOpen && (
          <div className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {pkgs.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text3)" }}>Bảng giá này chưa có gói nào. Thêm gói bên dưới rồi tạo báo giá.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {pkgs.map((p) => (
                    <label key={p.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface2)" }}>
                      <input type="checkbox" checked={quotePicks.has(p.id)} onChange={() => toggleQuotePick(p.id)} />
                      <span className="min-w-0 flex-1 truncate">{p.name}{p.category ? <span className="text-[11px]" style={{ color: "var(--text3)" }}> · {p.category}</span> : null}</span>
                      <span className="font-medium">{vnd(p.price)}</span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="field"><label className="label">Tên khách (tuỳ chọn)</label><input className="input" value={quoteClient.name} onChange={(e) => setQuoteClient((p) => ({ ...p, name: e.target.value }))} /></div>
                  <div className="field"><label className="label">SĐT khách (tuỳ chọn)</label><input className="input" inputMode="numeric" value={quoteClient.phone} onChange={(e) => setQuoteClient((p) => ({ ...p, phone: e.target.value }))} /></div>
                </div>
                {quoteErr && <p className="text-sm" style={{ color: "var(--danger)" }}>{quoteErr}</p>}
                <div className="flex items-center gap-3">
                  <button onClick={createQuoteFromList} disabled={quoteBusy} className="btn-primary">
                    {quoteBusy ? "Đang tạo…" : `Tạo báo giá (${quotePicks.size} gói)`}
                  </button>
                  <span className="text-xs" style={{ color: "var(--text3)" }}>
                    Tạm tính: <b style={{ color: "var(--text2)" }}>{vnd(pkgs.filter((p) => quotePicks.has(p.id)).reduce((s, p) => s + (p.price || 0), 0))}</b>
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      )}

      {/* Contact + bank (shared across both lists) */}
      <div className="card mb-6 p-6">
        <h2 className="mb-4 font-serif text-lg font-medium">Liên hệ &amp; chuyển khoản (hiện trên bảng giá)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label className="label">Số điện thoại</label><input className="input" value={c.pl_phone} onChange={(e) => setC((p) => ({ ...p, pl_phone: e.target.value }))} /></div>
          <div className="field"><label className="label">Facebook</label><input className="input" placeholder="fb.com/…" value={c.pl_facebook} onChange={(e) => setC((p) => ({ ...p, pl_facebook: e.target.value }))} /></div>
          <div className="field"><label className="label">Chủ tài khoản</label><input className="input" value={c.pl_bank_holder} onChange={(e) => setC((p) => ({ ...p, pl_bank_holder: e.target.value }))} /></div>
          <div className="field"><label className="label">Số tài khoản</label><input className="input" value={c.pl_bank_account} onChange={(e) => setC((p) => ({ ...p, pl_bank_account: e.target.value }))} /></div>
          <div className="field">
            <label className="label">Ngân hàng</label>
            <select
              className="input"
              value={c.pl_bank_bin}
              onChange={(e) => {
                const b = BANKS.find((x) => x.bin === e.target.value);
                setC((p) => ({ ...p, pl_bank_bin: e.target.value, pl_bank_name: b ? b.name : p.pl_bank_name }));
              }}
            >
              <option value="">— Chọn ngân hàng (để tạo mã QR) —</option>
              {BANKS.map((b) => (
                <option key={b.bin} value={b.bin}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={saveContact} className="btn-primary mt-4">{savedContact ? <Check size={15} /> : null} {savedContact ? "Đã lưu" : "Lưu liên hệ"}</button>

        {/* QR preview — confirms the bank config works; this is the studio's open QR. */}
        <div className="mt-6 border-t pt-6" style={{ borderColor: "var(--border)" }}>
          <h3 className="mb-3 text-sm font-medium">Mã QR chuyển khoản (xem trước)</h3>
          {c.pl_bank_bin && c.pl_bank_account ? (
            <>
              <VietQR bank={{ bin: c.pl_bank_bin, account: c.pl_bank_account, holder: c.pl_bank_holder, name: c.pl_bank_name }} amount={0} addInfo="" />
              <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text3)" }}>Mã mở (khách tự nhập số tiền). Trong hợp đồng / công nợ, QR sẽ tự điền sẵn số tiền.</p>
            </>
          ) : (
            <p className="text-xs" style={{ color: "var(--text3)" }}>Chọn <b>Ngân hàng</b> + nhập <b>Số tài khoản</b> rồi bấm <b>Lưu liên hệ</b> để xem mã QR.</p>
          )}
        </div>
      </div>

      {/* Appearance: background / text / accent colours + logo on the public poster */}
      <div className="card mb-6 p-6">
        <h2 className="mb-1 font-serif text-lg font-medium">Giao diện bảng giá</h2>
        <p className="mb-4 text-sm" style={{ color: "var(--text2)" }}>Chọn màu nền, màu chữ, màu nhấn và logo hiển thị trên bảng giá gửi khách.</p>
        <label className="mb-4 flex items-center gap-2 text-sm" style={{ color: "var(--text2)" }}>
          <input type="checkbox" checked={showClauses} onChange={toggleShowClauses} />
          Hiện điều khoản của dịch vụ trên bảng giá công khai
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["pl_bg", "Màu nền"],
            ["pl_text", "Màu chữ"],
            ["pl_accent", "Màu nhấn"],
          ] as [keyof Appearance, string][]).map(([key, label]) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={ap[key] || DEFAULT_APPEARANCE[key]} onChange={(e) => setAp((p) => ({ ...p, [key]: e.target.value }))} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg" style={{ border: "1px solid var(--border)", background: "transparent" }} />
                <input className="input" value={ap[key]} placeholder={DEFAULT_APPEARANCE[key]} onChange={(e) => setAp((p) => ({ ...p, [key]: e.target.value }))} />
              </div>
            </div>
          ))}
          <div className="field">
            <LogoUpload
              ownerId={ownerId}
              value={ap.pl_logo_url}
              onChange={(url) => setAp((p) => ({ ...p, pl_logo_url: url }))}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={saveAppearance} className="btn-primary">{savedAppear ? <Check size={15} /> : null} {savedAppear ? "Đã lưu" : "Lưu giao diện"}</button>
          <button onClick={() => setAp(DEFAULT_APPEARANCE)} className="btn-ghost px-3 py-2 text-xs">Khôi phục mặc định</button>
          {/* Live preview swatch */}
          <span className="ml-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm" style={{ background: ap.pl_bg || DEFAULT_APPEARANCE.pl_bg, color: ap.pl_text || DEFAULT_APPEARANCE.pl_text, border: "1px solid var(--border)" }}>
            {ap.pl_logo_url ? (
              <img src={ap.pl_logo_url} alt="logo" className="h-5 w-5 rounded object-contain" />
            ) : null}
            Xem trước · <b style={{ color: ap.pl_accent || DEFAULT_APPEARANCE.pl_accent }}>10.000.000đ</b>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card h-fit p-6">
          <h2 className="mb-4 font-serif text-lg font-medium">Thêm mục</h2>
          <div className="space-y-3">
            <div className="field"><label className="label">Tên dịch vụ</label><input className="input" value={f.name} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Giá</label><MoneyInput value={f.price} onChange={(n) => setF((p) => ({ ...p, price: n }))} /></div>
              <div className="field"><label className="label">Đơn vị</label><input className="input" placeholder="/ gói" value={f.unit} onChange={(e) => setF((p) => ({ ...p, unit: e.target.value }))} /></div>
            </div>
            <div className="field">
              <label className="label">Nhóm</label>
              <input
                className="input"
                placeholder="Gói chụp / Gói quay…"
                value={f.category}
                list="category-options"
                onChange={(e) => setF((p) => ({ ...p, category: e.target.value }))}
              />
              <datalist id="category-options">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="field field-top"><label className="label">Mô tả (mỗi dòng 1 ý)</label><textarea className="input min-h-[70px]" value={f.description} onChange={(e) => setF((p) => ({ ...p, description: e.target.value }))} /></div>
            <button onClick={add} disabled={busy} className="btn-primary w-full"><Plus size={15} /> {busy ? "Đang thêm…" : "Thêm vào bảng giá"}</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {visible.length === 0 ? (
            <div className="card flex flex-col items-center justify-center gap-4 py-16 text-center text-sm" style={{ color: "var(--text3)" }}>
              <p>Bảng giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")} đang trống.</p>
              <button onClick={seedActive} disabled={busy} className="btn-primary"><Sparkles size={15} /> Dùng mẫu giá {getLabel(activeList, allLists.find((l) => l.key === activeList)?.label ?? "")}</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h2 className="font-serif text-lg font-medium">Các gói dịch vụ</h2>
                {pkgs.length > 1 && <p className="text-xs" style={{ color: "var(--text3)" }}>Kéo thả <GripVertical size={12} className="inline" /> để đổi vị trí các gói.</p>}
                {pkgs.length === 0 && <p className="text-sm" style={{ color: "var(--text3)" }}>Chưa có gói nào.</p>}
                {pkgs.map((it) =>
                  editId === it.id ? (
                    <div key={it.id} className="card space-y-2 p-4">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className="input" placeholder="Tên" value={edit.name} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} />
                        <div className="grid grid-cols-2 gap-2">
                          <MoneyInput placeholder="Giá" value={edit.price} onChange={(n) => setEdit((p) => ({ ...p, price: n }))} />
                          <input className="input" placeholder="Đơn vị" value={edit.unit} onChange={(e) => setEdit((p) => ({ ...p, unit: e.target.value }))} />
                        </div>
                      </div>
                      <input className="input" placeholder="Nhóm" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))} />
                      <textarea className="input min-h-[70px]" placeholder="Mô tả (mỗi dòng 1 ý)" value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(it.id)} className="btn-primary px-3 py-1.5 text-xs"><Check size={14} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className="btn-ghost px-3 py-1.5 text-xs"><X size={14} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={it.id}
                      draggable
                      onDragStart={() => setDragId(it.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => reorderPkg(it.id)}
                      onDragEnd={() => setDragId(null)}
                      className="card flex items-start gap-3 p-4"
                      style={{ opacity: dragId === it.id ? 0.4 : it.active ? 1 : 0.5, cursor: "grab" }}
                    >
                      <GripVertical size={16} className="mt-0.5 shrink-0" style={{ color: "var(--text3)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {it.name} {it.category && <span className="text-[11px]" style={{ color: "var(--text3)" }}>· {it.category}</span>}
                        </p>
                        <p className="font-serif text-lg font-medium" style={{ color: "var(--accent)" }}>{vnd(it.price)}<span className="text-xs" style={{ color: "var(--text3)" }}>{it.unit ? ` ${it.unit}` : ""}</span></p>
                        {it.description && <p className="whitespace-pre-line text-xs" style={{ color: "var(--text3)" }}>{it.description}</p>}
                        {!it.show_on_home && <p className="mt-1 text-[11px]" style={{ color: "var(--text3)" }}>Ẩn ở trang chủ</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => toggleHome(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.show_on_home ? "Đang hiện ở trang chủ — bấm để ẩn" : "Đang ẩn ở trang chủ — bấm để hiện"} style={{ color: it.show_on_home ? "var(--accent)" : "var(--text3)" }}>
                          <Home size={14} />
                        </button>
                        <button onClick={() => startEdit(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title="Sửa"><Pencil size={14} /></button>
                        <button onClick={() => toggleActive(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.active ? "Đang hiện" : "Đang ẩn"}>
                          {it.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => remove(it.id)} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label="Xoá mục" title="Xoá mục"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="space-y-2">
                <h2 className="font-serif text-lg font-medium">Chi phí phát sinh &amp; lưu ý</h2>
                <p className="text-xs" style={{ color: "var(--text3)" }}>Các mục ghi chú riêng, hiển thị tách khỏi gói ở cuối bảng giá.</p>
                {notes.map((it) =>
                  editId === it.id ? (
                    <div key={it.id} className="card space-y-2 p-4">
                      <input className="input" placeholder="Tiêu đề (vd: Phát sinh thêm)" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value, name: e.target.value }))} />
                      <textarea className="input min-h-[70px]" placeholder="Nội dung (mỗi dòng 1 ý)" value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(it.id)} className="btn-primary px-3 py-1.5 text-xs"><Check size={14} /> Lưu</button>
                        <button onClick={() => setEditId(null)} className="btn-ghost px-3 py-1.5 text-xs"><X size={14} /> Huỷ</button>
                      </div>
                    </div>
                  ) : (
                    <div key={it.id} className="card flex items-start justify-between gap-3 p-4" style={{ opacity: it.active ? 1 : 0.5 }}>
                      <div>
                        <p className="font-medium">{it.category || it.name}</p>
                        {it.description && <p className="whitespace-pre-line text-xs" style={{ color: "var(--text3)" }}>{it.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => startEdit(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title="Sửa"><Pencil size={14} /></button>
                        <button onClick={() => toggleActive(it)} className="btn-ghost px-2.5 py-1.5 text-xs" title={it.active ? "Đang hiện" : "Đang ẩn"}>
                          {it.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => remove(it.id)} className="btn-ghost px-2.5 py-1.5 text-xs" aria-label="Xoá mục" title="Xoá mục"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )
                )}
                <div className="card space-y-2 p-4">
                  <input className="input" placeholder="Tiêu đề mục (vd: Phát sinh thêm, Lưu ý…)" value={note.name} onChange={(e) => setNote((p) => ({ ...p, name: e.target.value }))} />
                  <textarea className="input min-h-[60px]" placeholder="Nội dung (mỗi dòng 1 ý)" value={note.description} onChange={(e) => setNote((p) => ({ ...p, description: e.target.value }))} />
                  <button onClick={addNote} className="btn-ghost w-full px-3 py-2 text-xs"><Plus size={14} /> Thêm mục ghi chú</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
