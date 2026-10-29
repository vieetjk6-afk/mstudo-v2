"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  Eye,
  ListPlus,
  Package,
  Pencil,
  ReceiptText,
  Send,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Plus,
  User,
  Check,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { fmtDate } from "@/lib/date";
import { vnd } from "@/lib/types";
import { Callout, Empty, Field, InfoList, Section, Stack, btn, inputCls } from "@/components/v2/kit";
import QuickContractBoxV2 from "@/app/dashboard/studio/contracts/new/QuickContractBoxV2";
import {
  ChoiceRow,
  HideCreateFab,
  MobileActionBar,
  PriceText,
  RowGroup,
  RowList,
  SumRow,
} from "@/app/dashboard/studio/contracts/new/form-v2-parts";
import QuoteItemRowV2 from "./QuoteItemRowV2";
import { useNewQuoteForm, type NewQuoteFormProps } from "./useNewQuoteForm";

/* ═══════════════════════════════════════════════════════════════════════════
   TẠO BÁO GIÁ — giao diện mới. Cùng dữ liệu, cùng thao tác với NewQuoteForm
   (logic chung ở ./useNewQuoteForm); khác ở cách sắp xếp:
     • Trái (màn rộng): mục lục 4 phần, có dấu ✓ phần đã điền, bấm để cuộn tới.
     • Giữa: Khách hàng (cả email/Facebook) → Gói chính → Hạng mục thêm →
       Danh sách hạng mục (sửa giá/số lượng/bắt buộc ngay trên dòng) → Điều kiện.
     • Phải: "Bản khách sẽ nhận" ghim, tổng & cọc, MỘT nút chính.
     • Điện thoại: thanh ghim đáy gồm tổng · nút chính; bản xem trước nằm cuối.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function NewQuoteFormV2(props: NewQuoteFormProps) {
  const q = useNewQuoteForm(props);
  // Hàng hạng mục khoá theo vị trí (dòng chưa có id riêng). Xoá một dòng thì đổi
  // "thế hệ" để mọi dòng dựng lại — không thì ô mô tả đang mở của dòng bị xoá
  // trượt sang dòng ngay dưới nó.
  const [rowGen, setRowGen] = useState(0);
  const { services, pricelist, items, total, deposit, depositPct, saving } = q;
  const serviceName = services.find((s) => s.id === q.serviceId)?.name;

  const toc = [
    { id: "q2-client", label: "Khách hàng", done: !!(q.clientName.trim() || q.clientPhone.trim()) },
    { id: "q2-packages", label: "Gói & hạng mục", done: items.length > 0 },
    { id: "q2-items", label: "Hạng mục", done: items.some((i) => i.name.trim()) },
    { id: "q2-terms", label: "Điều kiện", done: !!(q.eventDate || q.location.trim() || q.title.trim()) },
  ];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ── Bản khách sẽ nhận ──────────────────────────────────────────────────── */
  const preview = (
    <aside className="v2-card overflow-hidden" aria-label="Bản khách sẽ nhận">
      <div className="flex items-start gap-2 px-5 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">Bản khách sẽ nhận</h3>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Cập nhật ngay khi bạn chọn</p>
        </div>
        <Eye size={18} style={{ color: "var(--tx3)", flex: "none", marginTop: 2 }} />
      </div>
      <div className="px-5">
        <p className="truncate text-[13.5px] font-semibold">{q.title.trim() || q.autoTitle}</p>
        <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {[q.clientName.trim() || "Khách tự điền tên", q.eventDate ? fmtDate(q.eventDate) : null, q.location.trim() || null].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="mt-3 border-t px-5 py-2" style={{ borderColor: "var(--bd2)" }}>
        {q.previewLines.length === 0 ? (
          <p className="py-3 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có hạng mục nào — chọn gói chính để bắt đầu.</p>
        ) : (
          q.previewLines.map((l, i) => (
            <div key={i} className="flex items-start gap-3 py-2" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{l.name || "(chưa đặt tên)"}</p>
                <p className="mt-px truncate text-[12px]" style={{ color: "var(--tx3)" }}>
                  {[l.is_discount ? "Giảm giá" : l.is_optional ? "Khách tự chọn" : "Bắt buộc", l.qty > 1 ? `×${l.qty}` : null].filter(Boolean).join(" · ")}
                </p>
                {l.description.trim() ? (
                  <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-[12px]" style={{ color: "var(--tx3)" }}>{l.description.trim()}</p>
                ) : null}
              </div>
              <span className="tnum flex-none whitespace-nowrap text-[13.5px] font-semibold" style={{ color: l.is_discount ? "var(--am)" : "var(--tx)" }}>
                {l.is_discount ? "− " : ""}
                {vnd((l.qty || 0) * (l.unit_price || 0))}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="border-t px-5 py-3" style={{ borderColor: "var(--bd2)" }}>
        <SumRow label="Tổng hạng mục" value={vnd(q.grossTotal)} />
        {q.discountTotal > 0 && <SumRow label="Giảm giá" value={`− ${vnd(q.discountTotal)}`} tone="var(--am)" />}
        <div className="mt-1 border-t pt-1.5" style={{ borderColor: "var(--bd2)" }}>
          <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-[13px] font-semibold">Tổng báo giá</span>
            <strong className="tnum text-[20px]" style={{ color: "var(--ac)", letterSpacing: "-.4px" }} data-testid="quote-total">
              {vnd(total)}
            </strong>
          </div>
          <SumRow label={`Cọc đề xuất ≈${depositPct.toFixed(0)}%`} sub="Làm tròn 500K" value={vnd(deposit)} />
        </div>
      </div>

      <div className="border-t px-5 pb-4 pt-3.5" style={{ borderColor: "var(--bd2)", background: "var(--sf2)" }}>
        {q.error && (
          <p className="mb-3 rounded-[10px] px-3 py-2 text-[12.5px] font-medium" style={{ background: "var(--rdS)", color: "var(--rd)" }} data-testid="quote-save-error">
            {q.error}
          </p>
        )}
        <button type="button" onClick={() => q.save("send")} disabled={!!saving} className={btn("primary", "lg", "w-full")} data-testid="quote-save-btn">
          <Send size={17} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi khách"}
        </button>
        <button type="button" onClick={() => q.save("draft")} disabled={!!saving} className={btn("secondary", "md", "mt-2 w-full")}>
          {saving === "draft" ? "Đang lưu…" : "Lưu nháp"}
        </button>
        <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "var(--tx3)" }}>
          Cả hai nút đều lưu rồi mở màn chi tiết — nơi có link gửi khách và nút gửi Zalo / Messenger / email.
        </p>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto w-full max-w-[1240px]" data-testid="quote-new-page">
      <HideCreateFab />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px] min-[1360px]:grid-cols-[208px_minmax(0,1fr)_330px]">
        {/* ── Trái: mục lục ─────────────────────────────────────────────── */}
        <nav aria-label="Các phần của báo giá" className="sticky top-[80px] hidden min-[1360px]:block">
          <div className="v2-card p-2">
            <ol>
              {toc.map((t, i) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => jump(t.id)}
                    className="flex w-full items-center gap-3 rounded-[11px] px-2.5 py-2.5 text-left transition-colors hover:bg-[var(--sf2)]"
                  >
                    <span
                      className="tnum flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-bold"
                      style={t.done ? { background: "var(--ac)", color: "#fff" } : { background: "var(--sf)", color: "var(--tx3)", border: "1.5px solid var(--bd)" }}
                    >
                      {t.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <span className="text-[13.5px] font-medium">{t.label}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-1.5 border-t px-1 pt-1.5" style={{ borderColor: "var(--bd2)" }}>
              <Link href="/dashboard/studio/quotes" className={btn("ghost", "sm", "w-full justify-start")}>
                <ArrowLeft size={15} /> Về danh sách báo giá
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Giữa: nhập liệu ───────────────────────────────────────────── */}
        <Stack gap={16} className="min-w-0">
          <QuickContractBoxV2
            context={q.quickContext}
            onApply={q.applyQuick}
            title="Tạo báo giá nhanh bằng AI"
            subtitle="Dán tin nhắn hỏi giá của khách — hệ thống điền khách, gói và hạng mục, bạn chỉ chỉnh lại."
            actionLabel="Phân tích & điền báo giá"
            hideHints={["startTime", "deposit", "crewIds", "note", "internalNote"]}
          />
          {q.quickDone && (
            <Callout tone="green" icon={Sparkles} title={q.quickDone === "ai" ? "AI đã điền sẵn báo giá." : "Đã điền sẵn báo giá."}>
              Kiểm tra lại khách, gói và giá bên dưới trước khi gửi.
            </Callout>
          )}

          <Section id="q2-client" title="Khách hàng" desc="Bỏ trống cũng được — khách tự điền khi xác nhận báo giá." icon={User} className="scroll-mt-[84px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên khách" htmlFor="q2-name">
                <input id="q2-name" className={inputCls} value={q.clientName} onChange={(e) => q.setClientName(e.target.value)} placeholder="Nguyễn Văn A" data-testid="quote-client-name" />
              </Field>
              <Field label="Số điện thoại" htmlFor="q2-phone">
                <input id="q2-phone" className={inputCls} inputMode="numeric" value={q.clientPhone} onChange={(e) => q.setClientPhone(e.target.value)} placeholder="0901234567" data-testid="quote-client-phone" />
              </Field>
              <Field label="Email" htmlFor="q2-email">
                <input id="q2-email" type="email" className={inputCls} value={q.clientEmail} onChange={(e) => q.setClientEmail(e.target.value)} placeholder="ten@email.com" />
              </Field>
              <Field label="Link Facebook" htmlFor="q2-fb">
                <input id="q2-fb" className={inputCls} placeholder="https://facebook.com/…" value={q.clientFacebook} onChange={(e) => q.setClientFacebook(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="q2-packages" title="Gói & hạng mục từ bảng giá" desc="Một chạm để đưa vào báo giá — sửa giá ở danh sách hạng mục bên dưới." icon={Package} className="scroll-mt-[84px]">
            {pricelist.length === 0 ? (
              <div className="rounded-[12px]" style={{ border: "1px dashed var(--bd)" }}>
                <Empty
                  compact
                  icon={Package}
                  title="Bảng giá đang trống"
                  hint={
                    <>
                      Thêm gói vào{" "}
                      <Link href="/dashboard/studio/pricing" className="font-semibold underline" style={{ color: "var(--ac)" }}>bảng giá</Link>{" "}
                      để chọn một chạm — hoặc tự nhập hạng mục ở khối dưới.
                    </>
                  }
                />
              </div>
            ) : (
              <Stack gap={20}>
                <div>
                  <p className="mb-2.5 text-[13.5px] font-semibold">Gói chính <span className="font-normal" style={{ color: "var(--tx3)" }}>· khách nhận là bắt buộc</span></p>
                  <RowList>
                    {q.priceGroups.map(([key, list]) => (
                      <div key={key} className="min-w-0 [&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]">
                        {q.priceGroups.length > 1 && <RowGroup>{q.listLabel(key)}</RowGroup>}
                        {list.map((p) => (
                          <ChoiceRow
                            key={p.id}
                            mode="radio"
                            on={q.mainSrc === p.id}
                            onToggle={() => q.pickMain(p)}
                            title={p.name}
                            sub={[p.category, p.description?.split("\n")[0]].filter(Boolean).join(" · ") || "Gói trong bảng giá"}
                            right={<PriceText value={p.price} />}
                          />
                        ))}
                      </div>
                    ))}
                  </RowList>
                </div>
                {pricelist.some((p) => p.id !== q.mainSrc) && (
                  <div>
                    <p className="mb-2.5 text-[13.5px] font-semibold">
                      Hạng mục thêm <span className="font-normal" style={{ color: "var(--tx3)" }}>· gửi dạng tuỳ chọn, khách tự tick</span>
                    </p>
                    <RowList>
                      {pricelist
                        .filter((p) => p.id !== q.mainSrc)
                        .map((p) => (
                          <ChoiceRow
                            key={p.id}
                            mode="check"
                            on={q.extraSrcs.includes(p.id)}
                            onToggle={() => q.toggleExtra(p)}
                            title={p.name}
                            sub={[q.priceGroups.length > 1 ? q.listLabel(p.list_key || "cuoi") : p.category, p.unit].filter(Boolean).join(" · ") || undefined}
                            right={<PriceText value={p.price} muted={!q.extraSrcs.includes(p.id)} />}
                          />
                        ))}
                    </RowList>
                  </div>
                )}
              </Stack>
            )}
          </Section>

          <Section
            id="q2-items"
            title="Danh sách hạng mục"
            desc={<>Khoá <b>Bắt buộc</b> thì khách không bỏ được; <b>Tuỳ chọn</b> thì khách tự chọn.</>}
            icon={ReceiptText}
            className="scroll-mt-[84px]"
            flush
          >
            {items.length === 0 ? (
              <Empty compact icon={ListPlus} title="Chưa có hạng mục nào" hint="Chọn một gói ở trên, hoặc thêm hạng mục tự nhập." />
            ) : (
              <div className="[&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]">
                {items.map((it, idx) => (
                  <QuoteItemRowV2
                    key={`${rowGen}-${idx}`}
                    item={it}
                    index={idx}
                    onPatch={(patch) => q.update(idx, patch as Parameters<typeof q.update>[1])}
                    onRemove={() => {
                      q.remove(idx);
                      setRowGen((g) => g + 1);
                    }}
                    testIds={{ row: `quote-item-${idx}`, name: `quote-item-name-${idx}`, toggle: `quote-item-toggle-${idx}` }}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t px-3.5 py-3" style={{ borderColor: "var(--bd2)" }}>
              <button type="button" onClick={() => q.add(false)} className={btn("secondary", "sm")} data-testid="quote-item-add">
                <Plus size={15} /> Thêm hạng mục
              </button>
              <button type="button" onClick={() => q.add(true)} className={btn("ghost", "sm")} style={{ color: "var(--am)" }} data-testid="quote-add-discount">
                <Tag size={14} /> Thêm giảm giá
              </button>
            </div>
          </Section>

          <Section
            id="q2-terms"
            title="Điều kiện báo giá"
            desc="Tiêu đề, ngày, địa điểm, lời chào và ưu đãi theo gói."
            icon={SlidersHorizontal}
            className="scroll-mt-[84px]"
            actions={
              <button type="button" onClick={() => q.setShowConditions((v) => !v)} className={btn(q.showConditions ? "soft" : "secondary", "sm")} aria-expanded={q.showConditions}>
                {q.showConditions ? <Check size={15} /> : <Pencil size={14} />} {q.showConditions ? "Xong" : "Sửa"}
              </button>
            }
          >
            {!q.showConditions ? (
              <InfoList
                items={[
                  { label: "Tiêu đề", value: q.title.trim() || q.autoTitle },
                  { label: "Dịch vụ (điều khoản)", value: serviceName || "Không chọn" },
                  { label: "Ngày sự kiện", value: q.eventDate ? fmtDate(q.eventDate) : "Chưa có" },
                  { label: "Địa điểm", value: q.location.trim() || "Chưa có" },
                  { label: "Cọc đề xuất", value: total > 0 ? `${vnd(deposit)} (≈${depositPct.toFixed(0)}%)` : "—" },
                  {
                    label: "Giảm theo gói chỉ định",
                    value: q.bulkDiscountAmount > 0 && q.discountPackageGroup ? `${q.discountPackageGroup} · −${vnd(q.bulkDiscountAmount)}` : "Không áp dụng",
                  },
                ]}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tiêu đề báo giá" htmlFor="q2-title" className="sm:col-span-2">
                  <input id="q2-title" className={inputCls} placeholder={q.autoTitle} value={q.title} onChange={(e) => q.setTitle(e.target.value)} data-testid="quote-title" />
                </Field>
                {services.length > 0 && (
                  <Field label="Dịch vụ (điều khoản riêng)" htmlFor="q2-svc">
                    <select id="q2-svc" className={inputCls} value={q.serviceId} onChange={(e) => q.setServiceId(e.target.value)}>
                      <option value="">— Không chọn —</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Ngày sự kiện">
                  <DateInput value={q.eventDate} onChange={q.setEventDate} className={inputCls} />
                </Field>
                <Field label="Địa điểm" htmlFor="q2-loc" className="sm:col-span-2">
                  <input id="q2-loc" className={inputCls} value={q.location} onChange={(e) => q.setLocation(e.target.value)} placeholder="Nhà hàng, studio, ngoại cảnh…" />
                </Field>
                <Field label="Lời chào / giới thiệu" htmlFor="q2-intro" className="sm:col-span-2">
                  <textarea id="q2-intro" className={inputCls} rows={3} value={q.intro} onChange={(e) => q.setIntro(e.target.value)} />
                </Field>
                <div className="rounded-[12px] px-4 py-3.5 sm:col-span-2" style={{ background: "var(--sf2)" }}>
                  <p className="text-[13.5px] font-semibold">Giảm giá theo gói chỉ định</p>
                  <p className="mb-3 mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Đặt “Nhóm gói” cho hạng mục tuỳ chọn ở trên để tạo gói (khách chỉ chọn 1 gói). Khách chọn đúng gói chỉ định thì tự động giảm thêm.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Gói được giảm" htmlFor="q2-dg">
                      <select id="q2-dg" className={inputCls} value={q.discountPackageGroup} onChange={(e) => q.setDiscountPackageGroup(e.target.value)}>
                        <option value="">— Không áp dụng —</option>
                        {q.packageGroups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Số tiền giảm">
                      <MoneyInput value={q.bulkDiscountAmount} onChange={q.setBulkDiscountAmount} placeholder="0" ariaLabel="Số tiền giảm" className={`${inputCls} tnum text-right`} />
                    </Field>
                  </div>
                  {q.packageGroups.length === 0 && (
                    <p className="mt-2.5 text-[12px]" style={{ color: "var(--tx3)" }}>Chưa có gói nào — thêm “Nhóm gói” cho hạng mục tuỳ chọn để tạo gói.</p>
                  )}
                </div>
              </div>
            )}
          </Section>
        </Stack>

        {/* ── Phải: bản khách sẽ nhận (ghim). Điện thoại: tự rơi xuống cuối luồng. ── */}
        <div className="min-w-0 xl:sticky xl:top-[80px]">{preview}</div>
      </div>

      <MobileActionBar>
        <div className="min-w-0 flex-1">
          <p className="tnum truncate text-[15px] font-bold" style={{ color: total > 0 ? "var(--tx)" : "var(--tx3)", letterSpacing: "-.2px" }}>
            {total > 0 ? vnd(total) : "Chưa có giá"}
          </p>
          <p className="tnum truncate text-[11.5px]" style={{ color: q.error ? "var(--rd)" : "var(--tx3)" }}>
            {q.error ? (
              <span className="inline-flex items-center gap-1"><CircleAlert size={12} /> {q.error}</span>
            ) : total > 0 ? (
              `Cọc đề xuất ${vnd(deposit)}`
            ) : (
              `${items.length} hạng mục`
            )}
          </p>
        </div>
        <button type="button" onClick={() => q.save("send")} disabled={!!saving} className={btn("primary")}>
          <Send size={16} /> {saving === "send" ? "Đang tạo…" : "Tạo & gửi"}
        </button>
      </MobileActionBar>
    </div>
  );
}
