"use client";

import dynamic from "next/dynamic";
import { fmtDateTime, fmtDate } from "@/lib/date";
import DateInput from "@/components/DateInput";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2, Lock, LockOpen, Send, FileSignature, X, Check, Save, Tag, CloudOff, Printer } from "lucide-react";
import { vnd, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/types";
import { quoteExpiryLabel, isQuoteExpired } from "@/lib/quote-expiry";
import { useUiV2 } from "@/components/v2/UiV2Context";
import { useQuoteEditor, type QuoteEditorProps } from "./useQuoteEditor";

// Bản giao diện mới tách thành chunk riêng: ai đang dùng bản cũ không phải tải nó.
const QuoteEditorV2 = dynamic(() => import("./QuoteEditorV2"));

/** Giao diện mới bật → bản V2; không thì bản cũ y nguyên. Hai bản dùng chung
 *  mọi state và luật ở ./useQuoteEditor. */
export default function QuoteEditor(props: QuoteEditorProps) {
  return useUiV2() ? <QuoteEditorV2 {...props} /> : <QuoteEditorV1 {...props} />;
}

function QuoteEditorV1(props: QuoteEditorProps) {
  const { canConvert } = props;
  const {
    quote, items, adjustments, saving, busy, msg, err,
    shareUrl, total, grossTotal, discountTotal, deposit, depositPct, locked,
    dirty, pendingAdj, packageGroups, bulkDiscountActive,
    printQuote, patchLocal, patchItemLocal, saveAll, changeStatus, addItem, deleteItem, copyLink, markSent,
    extendExpiry, clearExpiry, cancel, deleteQuote, convertToContract, resolveAdjustment,
  } = useQuoteEditor(props);

  return (
    <div className="space-y-6" data-testid="quote-edit-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/studio/quotes" aria-label="Quay lại danh sách báo giá" className="btn-ghost px-2 py-1.5"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="font-serif text-2xl font-medium">{quote.title}</h1>
            <p className="text-xs" style={{ color: "var(--text3)" }}>
              {quote.code || "—"} • <span className="text-accent">{QUOTE_STATUS_LABEL[quote.status]}</span>
              {dirty && !locked && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>
                  <CloudOff size={10} /> Chưa lưu
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text3)" }}>
            Trạng thái
            <select
              className="input py-1.5 text-xs"
              style={{ width: "auto" }}
              value={quote.status === "converted" ? "converted" : quote.status}
              onChange={(e) => changeStatus(e.target.value as QuoteStatus)}
              data-testid="quote-status-select"
            >
              {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((k) => (
                <option key={k} value={k} disabled={k === "converted"}>{QUOTE_STATUS_LABEL[k]}</option>
              ))}
            </select>
          </label>
          {!locked && (
            <button
              onClick={saveAll}
              disabled={!dirty || saving}
              className="btn-primary text-xs"
              data-testid="quote-save-btn"
            >
              <Save size={12} /> {saving ? "Đang lưu…" : dirty ? "Lưu thay đổi" : "Đã lưu"}
            </button>
          )}
          <button onClick={printQuote} className="btn-ghost px-3 py-2 text-xs">
            <Printer size={12} /> Xuất PDF
          </button>
          <button onClick={copyLink} className="btn-ghost px-3 py-2 text-xs" data-testid="quote-copy-link">
            <Copy size={12} /> Chép link kèm lời nhắn
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-xs">
            <ExternalLink size={12} /> Xem trang khách
          </a>
          {quote.status === "draft" && !dirty && (
            <button onClick={markSent} disabled={busy} className="btn-primary text-xs" data-testid="quote-mark-sent">
              <Send size={12} /> Đánh dấu đã gửi
            </button>
          )}
          {quote.status === "accepted" && !quote.contract_id && canConvert && (
            <button onClick={convertToContract} disabled={busy} className="btn-primary text-xs" data-testid="quote-convert">
              <FileSignature size={12} /> Tạo hợp đồng
            </button>
          )}
          {quote.status === "accepted" && !quote.contract_id && !canConvert && (
            <span className="rounded-md px-2 py-1.5 text-xs" style={{ background: "var(--surface2)", color: "var(--text3)" }} data-testid="quote-convert-upsell">
              Khách đã đồng ý — nâng cấp gói Studio để tạo hợp đồng
            </span>
          )}
          {quote.contract_id && (
            <Link href={`/dashboard/studio/contracts/${quote.contract_id}`} className="btn-primary text-xs">
              <FileSignature size={12} /> Mở hợp đồng
            </Link>
          )}
          {quote.status === "cancelled" && (
            <button onClick={deleteQuote} disabled={busy} className="btn-danger px-3 py-2 text-xs">
              <Trash2 size={12} /> Xoá
            </button>
          )}
        </div>
      </header>

      {msg && <p className="rounded-md px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}>{msg}</p>}
      {err && <p className="rounded-md px-3 py-2 text-xs" style={{ background: "color-mix(in srgb, var(--danger) 14%, transparent)", color: "var(--danger)" }}>{err}</p>}

      {/* Hạn hiệu lực — chỉ có nghĩa khi báo giá đã rời trạng thái nháp. Hết hạn
          KHÔNG khoá gì phía studio: nó chỉ chặn khách bấm đồng ý trên cổng
          khách, và là cái cớ để gọi lại khách. */}
      {quote.status !== "draft" && (() => {
        const expired = isQuoteExpired(quote.expires_at);
        const tone = expired
          ? { fg: "var(--s-red)", bg: "color-mix(in srgb, var(--s-red) 12%, transparent)" }
          : { fg: "var(--text2)", bg: "var(--surface2)" };
        return (
          <section className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4" data-testid="quote-expiry">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Hiệu lực báo giá</p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text3)" }}>
                {quote.expires_at
                  ? `Hết hiệu lực ngày ${fmtDate(quote.expires_at)}${expired ? " — khách không bấm đồng ý được nữa" : ""}`
                  : "Không đặt hạn — báo giá có hiệu lực tới khi bạn huỷ."}
              </p>
            </div>
            <span className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
              {quoteExpiryLabel(quote.expires_at)}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[7, 15, 30].map((d) => (
                <button key={d} onClick={() => extendExpiry(d)} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">
                  {quote.expires_at ? `Gia hạn ${d} ngày` : `Đặt hạn ${d} ngày`}
                </button>
              ))}
              {quote.expires_at && (
                <button onClick={clearExpiry} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs" style={{ color: "var(--text3)" }}>
                  Bỏ hạn
                </button>
              )}
            </div>
          </section>
        );
      })()}

      {adjustments.length > 0 && (
        <section className="card p-5" data-testid="quote-adjustments">
          <h2 className="text-sm font-medium" style={{ color: pendingAdj.length > 0 ? "var(--s-amber)" : "var(--text2)" }}>
            Trao đổi với khách {pendingAdj.length > 0 && <span className="ml-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>{pendingAdj.length} chưa xử lý</span>}
          </h2>
          <div className="mt-3 space-y-2">
            {adjustments.map((a) => {
              const isPending = !a.resolved && a.author === "client";
              return (
                <div
                  key={a.id}
                  className="rounded-md p-3"
                  style={{
                    background: isPending ? "var(--s-amberS)" : "var(--surface2)",
                    border: isPending ? "1px solid var(--s-amberS)" : "1px solid transparent",
                    opacity: a.resolved ? 0.55 : 1,
                  }}
                >
                  <div className="mb-1 flex items-center gap-2 text-[10px]" style={{ color: "var(--text3)" }}>
                    <span className="font-medium" style={{ color: a.author === "client" ? "var(--s-amber)" : "var(--text2)" }}>
                      {a.author === "client" ? "Khách" : "Studio"}
                    </span>
                    <span>{fmtDateTime(a.created_at)}</span>
                    {a.resolved && <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: "rgba(52,211,153,0.15)", color: "var(--success)" }}>Đã xử lý</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{a.message}</p>
                  {isPending && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => resolveAdjustment(a.id, true)} className="btn-ghost px-2 py-1 text-xs">
                        <Check size={10} /> Đánh dấu đã xử lý
                      </button>
                    </div>
                  )}
                  {a.resolved && (
                    <div className="mt-2 flex justify-end">
                      <button onClick={() => resolveAdjustment(a.id, false)} className="btn-ghost px-2 py-1 text-xs" style={{ color: "var(--text3)" }}>
                        <X size={10} /> Bỏ đánh dấu
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-sm font-medium" style={{ color: "var(--text2)" }}>Thông tin chung</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text3)" }}>
          {locked ? "Báo giá đã chốt — không thể chỉnh sửa." : "Bạn có thể chỉnh sửa thoải mái khi khách chưa đồng ý. Nhớ bấm Lưu sau khi sửa."}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Tiêu đề báo giá">
            <input className="input" value={quote.title} disabled={locked} onChange={(e) => patchLocal({ title: e.target.value })} />
          </Field>
          <Field label="Tên khách">
            <input className="input" value={quote.client_name || ""} disabled={locked} onChange={(e) => patchLocal({ client_name: e.target.value })} />
          </Field>
          <Field label="SĐT">
            <input className="input" value={quote.client_phone || ""} disabled={locked} onChange={(e) => patchLocal({ client_phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={quote.client_email || ""} disabled={locked} onChange={(e) => patchLocal({ client_email: e.target.value })} />
          </Field>
          <Field label="Link Facebook">
            <input className="input" value={quote.client_facebook || ""} disabled={locked} placeholder="https://facebook.com/..." onChange={(e) => patchLocal({ client_facebook: e.target.value })} />
          </Field>
          <Field label="Ngày sự kiện">
            <DateInput value={quote.event_date || ""} disabled={locked} onChange={(v) => patchLocal({ event_date: v || null })} />
          </Field>
          <Field label="Địa điểm">
            <input className="input" value={quote.location || ""} disabled={locked} onChange={(e) => patchLocal({ location: e.target.value })} />
          </Field>
        </div>
        <Field label="Lời chào / Giới thiệu" className="mt-3">
          <textarea className="input" rows={3} value={quote.intro || ""} disabled={locked} onChange={(e) => patchLocal({ intro: e.target.value })} />
        </Field>
        <div className="mt-4 rounded-lg p-3" style={{ background: "var(--surface2)" }}>
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--text2)" }}>Giảm giá theo gói chỉ định (tuỳ chọn)</p>
          <p className="mb-3 text-xs" style={{ color: "var(--text3)" }}>
            Nếu khách chọn đúng gói bạn chỉ định bên dưới, tự động giảm thêm số tiền tương ứng. Đặt nhóm gói cho từng hạng mục ở phần Hạng mục.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Gói được giảm">
              <select className="input" value={quote.discount_package_group ?? ""} disabled={locked}
                onChange={(e) => patchLocal({ discount_package_group: e.target.value || null })}>
                <option value="">— Không áp dụng —</option>
                {packageGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền giảm (VND)">
              <input type="number" min={0} className="input" value={quote.bulk_discount_amount ?? 0} disabled={locked}
                onChange={(e) => patchLocal({ bulk_discount_amount: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          {packageGroups.length === 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--text3)" }}>
              Chưa có gói nào. Thêm “Nhóm gói” cho các hạng mục tuỳ chọn để tạo gói.
            </p>
          )}
          {quote.discount_package_group && (quote.bulk_discount_amount ?? 0) > 0 && (
            <p className="mt-2 text-xs" style={{ color: bulkDiscountActive ? "var(--success)" : "var(--text3)" }}>
              {bulkDiscountActive
                ? `✓ Đang áp dụng — khách được giảm ${vnd(quote.bulk_discount_amount ?? 0)}`
                : `Khách chưa chọn gói “${quote.discount_package_group}” nên chưa được giảm`}
            </p>
          )}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium" style={{ color: "var(--text2)" }}>Hạng mục</h2>
          {!locked && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => addItem(false)} className="btn-ghost px-2.5 py-1.5 text-xs">
                <Plus size={12} /> Thêm hạng mục
              </button>
              <button onClick={() => addItem(true)} className="btn-ghost px-2.5 py-1.5 text-xs" style={{ color: "var(--s-amber)" }} data-testid="quote-add-discount">
                <Tag size={12} /> Thêm giảm giá
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="rounded-lg border p-3"
              style={{
                borderColor: it.is_discount ? "var(--s-amberS)" : "var(--border)",
                background: it.is_discount ? "var(--s-amberS)" : "transparent",
                opacity: it.is_optional && !it.selected ? 0.5 : 1,
              }}
              data-testid={`quote-edit-item-${it.id}`}
            >
              {it.is_discount && (
                <p className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--s-amberS)", color: "var(--s-amber)" }}>
                  <Tag size={10} /> Khoản giảm giá — trừ vào tổng
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-12">
                <input
                  className="input md:col-span-5"
                  value={it.name}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { name: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  className="input md:col-span-2"
                  value={it.qty}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { qty: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  min={0}
                  className="input md:col-span-3"
                  value={it.unit_price}
                  disabled={locked}
                  onChange={(e) => patchItemLocal(it.id, { unit_price: Number(e.target.value) || 0 })}
                />
                <div className="flex items-center gap-1 md:col-span-2">
                  <button
                    onClick={() => patchItemLocal(it.id, { is_optional: !it.is_optional })}
                    className="btn-ghost flex-1 px-2 py-1.5 text-xs"
                    disabled={locked}
                  >
                    {it.is_optional ? <LockOpen size={12} /> : <Lock size={12} />}
                    {it.is_optional ? "Tuỳ chọn" : "Bắt buộc"}
                  </button>
                  {!locked && (
                    <button onClick={() => deleteItem(it.id)} className="btn-ghost px-2 py-1.5" title="Xoá">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              {/* Khung nhiều dòng: Enter xuống dòng, khách thấy đúng từng dòng. */}
              <textarea
                className="input mt-2 block min-h-[42px] resize-y"
                rows={2}
                value={it.description || ""}
                disabled={locked}
                placeholder="Mô tả (tuỳ chọn) — Enter để xuống dòng"
                onChange={(e) => patchItemLocal(it.id, { description: e.target.value })}
              />
              {it.is_optional && !it.is_discount && (
                <input
                  className="input mt-1.5"
                  value={it.package_group || ""}
                  disabled={locked}
                  placeholder="Nhóm gói (VD: goi-co-ban) — để trống nếu không thuộc gói"
                  onChange={(e) => patchItemLocal(it.id, { package_group: e.target.value })}
                />
              )}
              <p className="mt-1 flex items-center justify-between text-xs" style={{ color: "var(--text3)" }}>
                <span>
                  {it.is_optional ? (it.selected ? "✓ Khách đã chọn" : "✗ Khách bỏ chọn") : "Bắt buộc"}
                </span>
                <span style={{ color: it.is_discount ? "var(--s-amber)" : "var(--text3)" }}>
                  {it.is_discount ? "Giảm: " : "Thành tiền: "}
                  <b style={{ color: it.is_discount ? "var(--s-amber)" : "var(--text)" }}>
                    {it.is_discount ? "−" : ""}{vnd((it.qty || 0) * (it.unit_price || 0))}
                  </b>
                </span>
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-col items-end gap-1 text-sm" style={{ color: "var(--text2)" }}>
          <p>Tổng hạng mục: {vnd(grossTotal)}</p>
          {discountTotal > 0 && <p style={{ color: "var(--s-amber)" }}>Giảm giá item: −{vnd(discountTotal)}</p>}
          {bulkDiscountActive && <p style={{ color: "var(--success)" }}>Ưu đãi gói {quote.discount_package_group}: −{vnd(quote.bulk_discount_amount ?? 0)}</p>}
          <p>
            <b className="text-base text-accent">
              Khách đang chọn: {vnd(bulkDiscountActive ? total - (quote.bulk_discount_amount ?? 0) : total)}
            </b>
          </p>
          <p className="text-xs">Cọc đề xuất (~{depositPct.toFixed(0)}%, làm tròn 500K): {vnd(deposit)}</p>
        </div>
      </section>

      {!locked && quote.status !== "cancelled" && (
        <button onClick={cancel} className="btn-ghost text-xs" style={{ color: "var(--text3)" }}>
          <X size={12} /> Hủy báo giá này
        </button>
      )}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
