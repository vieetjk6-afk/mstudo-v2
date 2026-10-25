"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  CloudOff,
  Copy,
  ExternalLink,
  FileSignature,
  Info,
  ListPlus,
  MessageSquareWarning,
  Plus,
  Printer,
  ReceiptText,
  Repeat,
  Save,
  Send,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { fmtDate, fmtDateTime, fmtDow } from "@/lib/date";
import { vnd, QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/types";
import { quoteDaysLeft, quoteExpiryLabel, isQuoteExpired } from "@/lib/quote-expiry";
import { Avatar, Badge, Callout, Empty, Field, Section, Stack, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import { Menu, Modal, type MenuItem } from "@/components/v2/kit-client";
import { HideCreateFab, Indicator, MobileActionBar, SumRow } from "@/app/dashboard/studio/contracts/new/form-v2-parts";
import QuoteItemRowV2 from "../new/QuoteItemRowV2";
import { useQuoteEditor, type QuoteEditorProps } from "./useQuoteEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   SỬA BÁO GIÁ — giao diện mới. Cùng dữ liệu, cùng thao tác với QuoteEditor
   (logic chung ở ./useQuoteEditor); khác ở cách sắp xếp:
     • Thẻ đầu trang: tên + mã + trạng thái, bốn ô thông tin (khách · giá trị
       khách đang chọn · hiệu lực kèm nút gia hạn · ngày sự kiện), MỘT nút chính
       theo tình huống (Lưu thay đổi / Gửi khách / Tạo hợp đồng / Mở hợp đồng)
       và menu ⋯ (PDF, link, trang khách, đổi trạng thái, huỷ, xoá).
     • "Gửi khách" mở hộp thoại: chép link kèm lời nhắn, mở trang khách, đánh
       dấu đã gửi — thay cho năm nút xếp hàng ngang.
     • Giữa: danh sách hạng mục (cùng dòng sửa với màn Tạo báo giá) + tổng;
       thông tin chung bên dưới. Phải: bản khách đang thấy + trao đổi với khách.
     • Điện thoại: có thay đổi chưa lưu thì hiện thanh ghim đáy "Lưu".
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS_TONE: Record<QuoteStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  viewed: "blue",
  adjust_requested: "amber",
  accepted: "green",
  converted: "green",
  expired: "gray",
  cancelled: "red",
};

export default function QuoteEditorV2(props: QuoteEditorProps) {
  const { canConvert, quoteValidDays = 15 } = props;
  const e = useQuoteEditor(props);
  const { quote, items, adjustments, saving, busy, locked, dirty } = e;
  const [sendOpen, setSendOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const showing = e.bulkDiscountActive ? e.total - (quote.bulk_discount_amount ?? 0) : e.total;
  const daysLeft = quoteDaysLeft(quote.expires_at);
  const expired = isQuoteExpired(quote.expires_at);
  const expiryTone: Tone = expired ? "red" : daysLeft !== null && daysLeft <= 3 ? "amber" : quote.expires_at ? "green" : "gray";
  const canSend = !locked && quote.status !== "cancelled";

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /* ── Nút chính: MỘT, theo tình huống ────────────────────────────────────── */
  const kind: "save" | "openContract" | "convert" | "send" | "delete" | null =
    !locked && dirty
      ? "save"
      : quote.contract_id
        ? "openContract"
        : quote.status === "accepted" && canConvert
          ? "convert"
          : canSend
            ? "send"
            : quote.status === "cancelled"
              ? "delete"
              : null;
  const primary =
    kind === "save" ? (
      <button type="button" onClick={e.saveAll} disabled={saving} className={btn("primary")} data-testid="quote-save-btn">
        <Save size={16} /> {saving ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    ) : kind === "openContract" ? (
      <Link href={`/dashboard/studio/contracts/${quote.contract_id}`} className={btn("primary")}>
        <FileSignature size={16} /> Mở hợp đồng
      </Link>
    ) : kind === "convert" ? (
      <button type="button" onClick={e.convertToContract} disabled={busy} className={btn("primary")} data-testid="quote-convert">
        <FileSignature size={16} /> Tạo hợp đồng
      </button>
    ) : kind === "send" ? (
      <button type="button" onClick={() => setSendOpen(true)} className={btn("primary")} aria-haspopup="dialog">
        <Send size={16} /> Gửi khách
      </button>
    ) : kind === "delete" ? (
      <button type="button" onClick={e.deleteQuote} disabled={busy} className={btn("danger")}>
        <Trash2 size={16} /> Xoá báo giá
      </button>
    ) : null;
  // Nút chính đang là việc khác (vd Lưu thay đổi) thì "Gửi khách" lùi thành nút phụ.
  const sendSecondary = canSend && kind !== "send";

  const menu: MenuItem[] = [
    ...(!canSend ? [{ label: "Gửi khách…", icon: Send, onClick: () => setSendOpen(true) } as MenuItem] : []),
    { label: "Xuất PDF", icon: Printer, onClick: e.printQuote, hint: "Mở bản A4 để in hoặc lưu PDF" },
    { label: "Chép link kèm lời nhắn", icon: Copy, onClick: e.copyLink },
    { label: "Xem trang khách", icon: ExternalLink, href: e.shareUrl, external: true },
    "divider",
    { label: "Đổi trạng thái…", icon: Repeat, onClick: () => setStatusOpen(true) },
    ...(!locked && quote.status !== "cancelled"
      ? (["divider", { label: "Huỷ báo giá này", icon: X, onClick: e.cancel, danger: true }] as MenuItem[])
      : []),
    // Báo giá đã huỷ: "Xoá báo giá" là nút chính ở đầu thẻ, không lặp lại trong menu.
  ];

  const expiryMenu: MenuItem[] = [
    ...[7, 15, 30].map((d) => ({ label: quote.expires_at ? `Gia hạn ${d} ngày` : `Đặt hạn ${d} ngày`, onClick: () => e.extendExpiry(d), disabled: busy })),
    ...(quote.expires_at ? (["divider", { label: "Bỏ hạn", onClick: e.clearExpiry, disabled: busy }] as MenuItem[]) : []),
  ];

  /* ── Thẻ đầu trang ──────────────────────────────────────────────────────── */
  const factLabel = "text-[12px] font-medium";
  const header = (
    <section className="v2-card" data-testid="quote-edit-page">
      <div className="flex flex-wrap items-start gap-3 px-5 pb-4 pt-4">
        <Link href="/dashboard/studio/quotes" aria-label="Quay lại danh sách báo giá" className={iconBtn("-ml-1.5 mt-0.5")}>
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1 basis-[240px]">
          <h2 className="text-[19px] font-bold leading-snug" style={{ letterSpacing: "-.3px" }}>{quote.title || "Báo giá chưa đặt tên"}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
            <span className="tnum">{quote.code || "Chưa có mã"}</span>
            <Badge tone={STATUS_TONE[quote.status]} dot>{QUOTE_STATUS_LABEL[quote.status]}</Badge>
            {dirty && !locked ? <Badge tone="amber" icon={CloudOff}>Chưa lưu</Badge> : null}
            {locked ? <Badge tone="gray">Đã chốt · chỉ xem</Badge> : null}
          </div>
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2">
          {quote.status === "accepted" && !quote.contract_id && !canConvert ? (
            <span className="rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }} data-testid="quote-convert-upsell">
              Khách đã đồng ý — nâng cấp gói Studio để tạo hợp đồng
            </span>
          ) : null}
          {sendSecondary ? (
            <button type="button" onClick={() => setSendOpen(true)} className={btn("secondary")} aria-haspopup="dialog">
              <Send size={15} /> Gửi khách
            </button>
          ) : null}
          {!locked && !dirty ? (
            <span className="hidden items-center gap-1 text-[12.5px] sm:inline-flex" style={{ color: "var(--tx3)" }}>
              <Check size={14} /> Đã lưu
            </span>
          ) : null}
          {primary}
          <Menu items={menu} label="Thao tác khác" width={250} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t px-5 py-4 lg:grid-cols-4" style={{ borderColor: "var(--bd2)" }}>
        <div className="min-w-0">
          <p className={factLabel} style={{ color: "var(--tx3)" }}>Khách hàng</p>
          {quote.client_name || quote.client_phone ? (
            <div className="mt-1.5 flex min-w-0 items-center gap-2.5">
              <Avatar name={quote.client_name || quote.client_phone || "?"} size={32} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold">{quote.client_name || "Chưa có tên"}</p>
                <p className="tnum truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{quote.client_phone || quote.client_email || "—"}</p>
              </div>
            </div>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-[13.5px]" style={{ color: "var(--tx3)" }}>
              <UserRound size={16} /> Khách tự điền khi xác nhận
            </p>
          )}
        </div>
        <div className="min-w-0">
          <p className={factLabel} style={{ color: "var(--tx3)" }}>Khách đang chọn</p>
          <p className="tnum mt-1 text-[20px] font-bold" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(showing)}</p>
          <p className="tnum text-[12.5px]" style={{ color: "var(--tx3)" }}>Cọc ~{e.depositPct.toFixed(0)}%: {vnd(e.deposit)}</p>
        </div>
        <div className="min-w-0" data-testid={quote.status !== "draft" ? "quote-expiry" : undefined}>
          <p className={factLabel} style={{ color: "var(--tx3)" }}>Hiệu lực</p>
          {quote.status === "draft" ? (
            <>
              <p className="mt-1.5 text-[14px] font-medium">{quoteValidDays > 0 ? `${quoteValidDays} ngày` : "Không đặt hạn"}</p>
              <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>Tính từ lúc gửi khách</p>
            </>
          ) : (
            <>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={expiryTone}>{quoteExpiryLabel(quote.expires_at)}</Badge>
                <Menu
                  items={expiryMenu}
                  label="Gia hạn báo giá"
                  align="left"
                  width={200}
                  trigger={({ open, toggle }) => (
                    <button type="button" onClick={toggle} aria-expanded={open} disabled={busy} className={btn("ghost", "sm", "-ml-1 px-2")}>
                      {quote.expires_at ? "Gia hạn" : "Đặt hạn"} <ChevronDown size={14} />
                    </button>
                  )}
                />
              </div>
              <p className="mt-0.5 text-[12.5px]" style={{ color: expired ? "var(--rd)" : "var(--tx3)" }}>
                {quote.expires_at ? `Đến ${fmtDate(quote.expires_at)}${expired ? " — khách không bấm đồng ý được nữa" : ""}` : "Có hiệu lực tới khi bạn huỷ"}
              </p>
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className={factLabel} style={{ color: "var(--tx3)" }}>Ngày sự kiện</p>
          <p className="mt-1.5 truncate text-[14px] font-medium" style={{ color: quote.event_date ? "var(--tx)" : "var(--tx3)" }}>
            {quote.event_date ? `${fmtDow(quote.event_date)} · ${fmtDate(quote.event_date)}` : "Chưa có"}
          </p>
          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{quote.location || "Chưa có địa điểm"}</p>
        </div>
      </div>
    </section>
  );

  /* ── Bản khách đang thấy (cột phải) ─────────────────────────────────────── */
  const clientView = (
    <aside className="v2-card overflow-hidden" aria-label="Bản khách đang thấy">
      <div className="flex items-start gap-2 px-5 pb-2 pt-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">Bản khách đang thấy</h3>
          <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
            {dirty && !locked ? "Gồm cả thay đổi chưa lưu — khách chỉ thấy sau khi lưu." : "Đúng như trang khách mở ra."}
          </p>
        </div>
        <a href={e.shareUrl} target="_blank" rel="noreferrer" aria-label="Mở trang khách" title="Mở trang khách" className={iconBtn()}>
          <ExternalLink size={16} />
        </a>
      </div>
      <div className="px-5 pb-1">
        {items.length === 0 ? (
          <p className="py-3 text-center text-[13px]" style={{ color: "var(--tx3)" }}>Chưa có hạng mục.</p>
        ) : (
          items.map((it, i) => {
            const off = it.is_optional && !it.selected;
            return (
              <div key={it.id} className="flex items-start gap-2.5 py-2" style={i ? { borderTop: "1px solid var(--bd2)" } : undefined}>
                <span className="mt-0.5">
                  <Indicator on={!off} mode="check" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px]" style={{ color: off ? "var(--tx3)" : "var(--tx)", textDecoration: off ? "line-through" : undefined }}>
                    {it.name || "(chưa đặt tên)"}
                    {it.qty > 1 ? ` ×${it.qty}` : ""}
                  </p>
                  <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{it.is_discount ? "Giảm giá" : it.is_optional ? "Khách tự chọn" : "Bắt buộc"}</p>
                </div>
                <span className="tnum flex-none whitespace-nowrap text-[13px] font-medium" style={{ color: it.is_discount ? "var(--am)" : off ? "var(--tx3)" : "var(--tx)" }}>
                  {it.is_discount ? "− " : ""}
                  {vnd((it.qty || 0) * (it.unit_price || 0))}
                </span>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t px-5 py-3" style={{ borderColor: "var(--bd2)" }}>
        <SumRow label="Khách đang chọn" value={vnd(showing)} strong />
        <SumRow label={`Cọc đề xuất ~${e.depositPct.toFixed(0)}%`} sub="Làm tròn 500K" value={vnd(e.deposit)} />
      </div>
    </aside>
  );

  /* ── Trao đổi với khách ─────────────────────────────────────────────────── */
  const adjustmentsSection =
    adjustments.length > 0 ? (
      <Section
        id="qe2-adjust"
        title="Trao đổi với khách"
        icon={MessageSquareWarning}
        className="scroll-mt-[84px]"
        actions={e.pendingAdj.length > 0 ? <Badge tone="amber">{e.pendingAdj.length} chưa xử lý</Badge> : null}
      >
        <div className="flex flex-col gap-2.5" data-testid="quote-adjustments">
          {adjustments.map((a) => {
            const isPending = !a.resolved && a.author === "client";
            return (
              <div
                key={a.id}
                className="rounded-[12px] px-3.5 py-3"
                style={{
                  background: isPending ? "var(--amS)" : "var(--sf2)",
                  border: `1px solid ${isPending ? "color-mix(in srgb, var(--am) 25%, transparent)" : "transparent"}`,
                  opacity: a.resolved ? 0.6 : 1,
                }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]" style={{ color: "var(--tx3)" }}>
                  <span className="font-semibold" style={{ color: a.author === "client" ? "var(--am)" : "var(--tx2)" }}>
                    {a.author === "client" ? "Khách" : "Studio"}
                  </span>
                  <span>{fmtDateTime(a.created_at)}</span>
                  {a.resolved ? <Badge tone="green">Đã xử lý</Badge> : null}
                </div>
                <p className="whitespace-pre-wrap text-[13.5px]">{a.message}</p>
                {isPending ? (
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={() => e.resolveAdjustment(a.id, true)} className={btn("secondary", "sm")}>
                      <Check size={14} /> Đánh dấu đã xử lý
                    </button>
                  </div>
                ) : null}
                {a.resolved ? (
                  <div className="mt-1.5 flex justify-end">
                    <button type="button" onClick={() => e.resolveAdjustment(a.id, false)} className={btn("ghost", "sm")}>
                      <X size={14} /> Bỏ đánh dấu
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>
    ) : null;

  const disabledHint = locked ? "Báo giá đã chốt — không thể chỉnh sửa." : "Sửa thoải mái khi khách chưa đồng ý. Nhớ bấm Lưu sau khi sửa.";

  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <HideCreateFab />
      <Stack gap={16}>
        {header}

        {e.msg ? <Callout tone="green" icon={Check}>{e.msg}</Callout> : null}
        {e.err ? <Callout tone="red" icon={CircleAlert}>{e.err}</Callout> : null}
        {e.pendingAdj.length > 0 ? (
          <Callout
            tone="amber"
            icon={MessageSquareWarning}
            title={`Khách đang xin chỉnh ${e.pendingAdj.length} điểm`}
            action={
              <button type="button" className={btn("secondary", "sm")} onClick={() => scrollTo("qe2-adjust")}>
                Xem
              </button>
            }
          >
            Sửa hạng mục theo yêu cầu, lưu lại rồi đánh dấu đã xử lý.
          </Callout>
        ) : null}

        <div className="grid items-start gap-5 min-[1280px]:grid-cols-[minmax(0,1fr)_330px]">
          <Stack gap={16} className="min-w-0">
            <Section
              title="Hạng mục"
              desc={disabledHint}
              icon={ReceiptText}
              flush={items.length > 0}
              actions={
                !locked ? (
                  <>
                    <button type="button" onClick={() => e.addItem(true)} className={btn("ghost", "sm")} style={{ color: "var(--am)" }} data-testid="quote-add-discount">
                      <Tag size={14} /> Giảm giá
                    </button>
                    <button type="button" onClick={() => e.addItem(false)} className={btn("secondary", "sm")}>
                      <Plus size={15} /> Hạng mục
                    </button>
                  </>
                ) : null
              }
            >
              {items.length === 0 ? (
                <Empty compact icon={ListPlus} title="Chưa có hạng mục" hint={locked ? undefined : "Bấm “Hạng mục” để thêm dòng đầu tiên."} />
              ) : (
                <>
                  <div className="[&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]">
                    {items.map((it, idx) => (
                      <QuoteItemRowV2
                        key={it.id}
                        item={it}
                        index={idx}
                        disabled={locked}
                        showSelection
                        onPatch={(patch) => e.patchItemLocal(it.id, patch)}
                        onRemove={() => e.deleteItem(it.id)}
                        testIds={{ row: `quote-edit-item-${it.id}` }}
                      />
                    ))}
                  </div>
                  <div className="border-t px-5 py-3.5" style={{ borderColor: "var(--bd)", background: "var(--sf2)" }}>
                    <div className="ml-auto max-w-[380px]">
                      <SumRow label="Tổng hạng mục" value={vnd(e.grossTotal)} />
                      {e.discountTotal > 0 ? <SumRow label="Giảm giá hạng mục" value={`− ${vnd(e.discountTotal)}`} tone="var(--am)" /> : null}
                      {e.bulkDiscountActive ? (
                        <SumRow label={`Ưu đãi gói ${quote.discount_package_group}`} value={`− ${vnd(quote.bulk_discount_amount ?? 0)}`} tone="var(--gn)" />
                      ) : null}
                      <SumRow label="Khách đang chọn" value={vnd(showing)} strong />
                      <SumRow label={`Cọc đề xuất ~${e.depositPct.toFixed(0)}%`} sub="Làm tròn 500K" value={vnd(e.deposit)} />
                    </div>
                  </div>
                </>
              )}
            </Section>

            <Section title="Thông tin chung" desc={disabledHint} icon={Info}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tiêu đề báo giá" htmlFor="qe2-title" className="md:col-span-2">
                  <input id="qe2-title" className={inputCls} value={quote.title} disabled={locked} onChange={(ev) => e.patchLocal({ title: ev.target.value })} />
                </Field>
                <Field label="Tên khách" htmlFor="qe2-name">
                  <input id="qe2-name" className={inputCls} value={quote.client_name || ""} disabled={locked} onChange={(ev) => e.patchLocal({ client_name: ev.target.value })} />
                </Field>
                <Field label="Số điện thoại" htmlFor="qe2-phone">
                  <input id="qe2-phone" className={inputCls} inputMode="numeric" value={quote.client_phone || ""} disabled={locked} onChange={(ev) => e.patchLocal({ client_phone: ev.target.value })} />
                </Field>
                <Field label="Email" htmlFor="qe2-email">
                  <input id="qe2-email" type="email" className={inputCls} value={quote.client_email || ""} disabled={locked} onChange={(ev) => e.patchLocal({ client_email: ev.target.value })} />
                </Field>
                <Field label="Link Facebook" htmlFor="qe2-fb">
                  <input id="qe2-fb" className={inputCls} value={quote.client_facebook || ""} disabled={locked} placeholder="https://facebook.com/…" onChange={(ev) => e.patchLocal({ client_facebook: ev.target.value })} />
                </Field>
                <Field label="Ngày sự kiện">
                  <DateInput value={quote.event_date || ""} disabled={locked} onChange={(v) => e.patchLocal({ event_date: v || null })} className={inputCls} />
                </Field>
                <Field label="Địa điểm" htmlFor="qe2-loc">
                  <input id="qe2-loc" className={inputCls} value={quote.location || ""} disabled={locked} onChange={(ev) => e.patchLocal({ location: ev.target.value })} />
                </Field>
                <Field label="Lời chào / giới thiệu" htmlFor="qe2-intro" className="md:col-span-2">
                  <textarea id="qe2-intro" className={inputCls} rows={3} value={quote.intro || ""} disabled={locked} onChange={(ev) => e.patchLocal({ intro: ev.target.value })} />
                </Field>
                <div className="rounded-[12px] px-4 py-3.5 md:col-span-2" style={{ background: "var(--sf2)" }}>
                  <p className="text-[13.5px] font-semibold">Giảm giá theo gói chỉ định</p>
                  <p className="mb-3 mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                    Khách chọn đúng gói chỉ định thì tự động giảm thêm. Đặt “Nhóm gói” cho từng hạng mục tuỳ chọn ở phần Hạng mục.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Gói được giảm" htmlFor="qe2-dg">
                      <select
                        id="qe2-dg"
                        className={inputCls}
                        value={quote.discount_package_group ?? ""}
                        disabled={locked}
                        onChange={(ev) => e.patchLocal({ discount_package_group: ev.target.value || null })}
                      >
                        <option value="">— Không áp dụng —</option>
                        {e.packageGroups.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Số tiền giảm">
                      {locked ? (
                        <input className={`${inputCls} tnum text-right`} value={vnd(quote.bulk_discount_amount ?? 0)} disabled readOnly aria-label="Số tiền giảm" />
                      ) : (
                        <MoneyInput
                          value={quote.bulk_discount_amount ?? 0}
                          onChange={(n) => e.patchLocal({ bulk_discount_amount: n })}
                          placeholder="0"
                          ariaLabel="Số tiền giảm"
                          className={`${inputCls} tnum text-right`}
                        />
                      )}
                    </Field>
                  </div>
                  {e.packageGroups.length === 0 ? (
                    <p className="mt-2.5 text-[12px]" style={{ color: "var(--tx3)" }}>Chưa có gói nào. Thêm “Nhóm gói” cho các hạng mục tuỳ chọn để tạo gói.</p>
                  ) : null}
                  {quote.discount_package_group && (quote.bulk_discount_amount ?? 0) > 0 ? (
                    <p className="mt-2.5 text-[12.5px]" style={{ color: e.bulkDiscountActive ? "var(--gn)" : "var(--tx3)" }}>
                      {e.bulkDiscountActive
                        ? `✓ Đang áp dụng — khách được giảm ${vnd(quote.bulk_discount_amount ?? 0)}`
                        : `Khách chưa chọn gói “${quote.discount_package_group}” nên chưa được giảm`}
                    </p>
                  ) : null}
                </div>
              </div>
            </Section>
          </Stack>

          <Stack gap={16} className="min-w-0 min-[1280px]:sticky min-[1280px]:top-[80px]">
            {clientView}
            {adjustmentsSection}
          </Stack>
        </div>
      </Stack>

      {/* Điện thoại: có thay đổi chưa lưu → thanh Lưu ghim đáy. */}
      {!locked && dirty ? (
        <MobileActionBar>
          <CloudOff size={18} style={{ color: "var(--am)", flex: "none" }} />
          <p className="min-w-0 flex-1 text-[13px] font-medium">Có thay đổi chưa lưu</p>
          <button type="button" onClick={e.saveAll} disabled={saving} className={btn("primary")}>
            <Save size={16} /> {saving ? "Đang lưu…" : "Lưu"}
          </button>
        </MobileActionBar>
      ) : null}

      {/* ── Hộp thoại: gửi khách ───────────────────────────────────────────── */}
      <Modal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        title="Gửi báo giá cho khách"
        desc="Chép link kèm lời nhắn rồi dán vào Zalo / Messenger / email của khách."
        icon={Send}
        width={520}
        footer={
          <>
            <a href={e.shareUrl} target="_blank" rel="noreferrer" className={btn("secondary")}>
              <ExternalLink size={15} /> Xem trang khách
            </a>
            <button type="button" onClick={e.copyLink} className={btn("primary")} data-testid="quote-copy-link">
              <Copy size={15} /> Chép link kèm lời nhắn
            </button>
          </>
        }
      >
        <Field label="Link báo giá của khách">
          <input className={`${inputCls} tnum`} value={e.shareUrl} readOnly onFocus={(ev) => ev.currentTarget.select()} aria-label="Link báo giá của khách" />
        </Field>
        {e.msg ? <p className="mt-2 text-[12.5px] font-medium" style={{ color: "var(--gn)" }}>{e.msg}</p> : null}
        {quote.status === "draft" ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] px-4 py-3" style={{ background: "var(--sf2)" }}>
            <CalendarClock size={18} style={{ color: "var(--ac)", flex: "none" }} />
            <p className="min-w-0 flex-1 basis-[200px] text-[12.5px]" style={{ color: "var(--tx2)" }}>
              {dirty
                ? "Lưu thay đổi trước, rồi đánh dấu đã gửi sau khi gửi link cho khách."
                : `Gửi link xong thì đánh dấu đã gửi${quoteValidDays > 0 ? ` — hiệu lực ${quoteValidDays} ngày bắt đầu tính từ lúc này` : ""}.`}
            </p>
            {!dirty ? (
              <button type="button" onClick={e.markSent} disabled={busy} className={btn("secondary", "sm")} data-testid="quote-mark-sent">
                <Check size={14} /> Đánh dấu đã gửi
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* ── Hộp thoại: đổi trạng thái ─────────────────────────────────────── */}
      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Đổi trạng thái báo giá" icon={Repeat} width={440}>
        <div className="overflow-hidden rounded-[12px] [&>*+*]:border-t [&>*+*]:border-[color:var(--bd2)]" style={{ border: "1px solid var(--bd)" }} data-testid="quote-status-select">
          {(Object.keys(QUOTE_STATUS_LABEL) as QuoteStatus[]).map((k) => {
            const on = quote.status === k;
            const off = k === "converted";
            return (
              <button
                key={k}
                type="button"
                disabled={off}
                onClick={async () => {
                  setStatusOpen(false);
                  await e.changeStatus(k);
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors enabled:hover:bg-[var(--sf2)] disabled:cursor-not-allowed"
                style={on ? { background: "color-mix(in srgb, var(--ac) 6%, var(--sf))" } : undefined}
              >
                <Indicator on={on} mode="radio" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px]" style={{ color: off && !on ? "var(--tx3)" : "var(--tx)" }}>{QUOTE_STATUS_LABEL[k]}</span>
                  {off ? <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>Chỉ nút Tạo hợp đồng mới đặt được</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
