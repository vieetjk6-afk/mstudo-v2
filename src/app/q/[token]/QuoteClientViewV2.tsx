"use client";

import { useState } from "react";
import {
  Ban,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  FileSignature,
  ListChecks,
  Lock,
  MessageSquare,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { CustomerHeaderV2, CustomerMainV2 } from "@/components/v2/customer";
import { Badge, Callout, Card, Field, Section, Stack, btn, inputCls, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { Modal, Switch } from "@/components/v2/kit-client";
import { vnd, type QuoteItem, type QuoteStatus } from "@/lib/types";
import { fmtDate, fmtDateTime, fmtLunar } from "@/lib/date";
import { CustomerRootAuto, Fact, LangToggle, MoneyLine, StickyActionBar, useInView } from "@/app/c/[token]/DocPartsV2";
import { useQuoteClient, type QuoteClient, type QuoteClientProps } from "./useQuoteClient";

/* ═══════════════════════════════════════════════════════════════════════════
   BÁO GIÁ GỬI KHÁCH — giao diện mới. Cùng state, cùng lời gọi máy chủ với bản
   cũ (./useQuoteClient); khác ở cách sắp xếp, viết cho khách trên điện thoại:
     • Đầu trang thương hiệu studio; thẻ đầu nói rõ việc cần làm ("Chọn dịch vụ
       rồi bấm Đồng ý" / "Bạn đã đồng ý" / "Báo giá đã hết hạn") + ngày, địa
       điểm, hạn báo giá, tổng tạm tính.
     • Gói dịch vụ là thẻ chọn một; hạng mục là dòng có ô chọn, số tiền canh
       phải; hạng mục bắt buộc có ổ khoá, giảm giá màu hổ phách.
     • Tổng cộng + cọc đề xuất + MỘT nút "Đồng ý báo giá": máy tính ở cột phải
       dính theo cuộn; điện thoại ngay sau ô thông tin, và thanh dính dưới đáy
       khi nút đó cuộn khuất. Đồng ý luôn hỏi lại bằng hộp thoại.
     • Yêu cầu chỉnh sửa và lịch sử trao đổi gộp thành một khối hội thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATUS: Record<QuoteStatus, { tone: Tone; vi: string; en: string }> = {
  draft: { tone: "gray", vi: "Bản nháp", en: "Draft" },
  sent: { tone: "blue", vi: "Chờ bạn xác nhận", en: "Awaiting you" },
  viewed: { tone: "blue", vi: "Chờ bạn xác nhận", en: "Awaiting you" },
  adjust_requested: { tone: "amber", vi: "Đã gửi yêu cầu chỉnh", en: "Changes requested" },
  accepted: { tone: "green", vi: "Bạn đã đồng ý", en: "Accepted" },
  converted: { tone: "green", vi: "Đã tạo hợp đồng", en: "Contract created" },
  expired: { tone: "gray", vi: "Hết hạn", en: "Expired" },
  cancelled: { tone: "red", vi: "Đã huỷ", en: "Cancelled" },
};

export default function QuoteClientViewV2(props: QuoteClientProps) {
  const { quote, studioName, studioLogo = null, studioCanContract } = props;
  const q = useQuoteClient(props);
  const { tr } = q;
  const L = (vi: string, en: string) => (q.lang === "vi" ? vi : en);

  /* Bấm "Đồng ý" khi thiếu tên / SĐT: đưa khách tới ô thông tin thay vì nút chết. */
  const [showErrors, setShowErrors] = useState(false);
  const tryAccept = () => {
    if (q.locked || q.items.length === 0) return;
    if (!q.formValid) {
      setShowErrors(true);
      const el = document.getElementById("v2-info");
      if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 76, behavior: "smooth" });
      window.setTimeout(() => document.getElementById(q.clientName.trim() ? "v2-q-phone" : "v2-q-name")?.focus({ preventScroll: true }), 350);
      return;
    }
    q.accept();
  };

  const [acceptEl, setAcceptEl] = useState<HTMLDivElement | null>(null);
  const acceptInView = useInView(acceptEl, "-60px 0px 0px 0px");

  const st = STATUS[q.accepted ? "accepted" : quote.status];
  const cancelled = quote.status === "cancelled";

  /* ── Thẻ đầu: trạng thái bằng chữ ── */
  let hero: { tone: Tone; icon: LucideIcon; title: string; sub: string };
  if (q.accepted) {
    hero = {
      tone: "green",
      icon: CheckCircle2,
      title: tr.acceptedMsg,
      sub: q.contractToken ? tr.contractCreated : `${studioName} ${tr.studioContact}`,
    };
  } else if (q.locked) {
    hero = {
      tone: cancelled ? "red" : "gray",
      icon: cancelled ? Ban : Clock,
      title: cancelled ? L("Báo giá đã huỷ", "This quote was cancelled") : L("Báo giá đã hết hạn", "This quote has expired"),
      sub: `${tr.quotePrefix} ${cancelled ? tr.lockedCancelled : tr.lockedExpired} ${tr.lockedMsg} ${L("Liên hệ studio nếu bạn vẫn quan tâm.", "Contact the studio if you're still interested.")}`,
    };
  } else {
    hero = {
      tone: "brand",
      icon: ListChecks,
      title: L("Chọn dịch vụ bạn cần, rồi bấm Đồng ý", "Pick what you need, then accept"),
      sub: L(
        "Tổng tiền tự cập nhật theo lựa chọn của bạn. Cần đổi giá hay thêm bớt? Gửi yêu cầu chỉnh sửa cho studio ở cuối trang.",
        "The total updates as you choose. Need changes? Send the studio a request at the bottom of the page.",
      ),
    };
  }
  const HeroIcon = hero.icon;
  const expiring = !q.locked && q.daysLeftNum !== null && q.daysLeftNum <= 7;

  return (
    <CustomerRootAuto>
      <CustomerHeaderV2
        brand={{ name: studioName, logoUrl: studioLogo }}
        sub={L("Báo giá dịch vụ", "Service quote")}
        right={<LangToggle lang={q.lang} onToggle={q.toggleLang} />}
      />
      <CustomerMainV2>
        <div data-testid="quote-client-page">
          <Stack gap={16}>
            {/* ── Thẻ đầu ── */}
            <header className="v2-card overflow-hidden">
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  <span>{L("Báo giá dịch vụ chụp ảnh", "Photography service quote")}</span>
                  {quote.code && (
                    <>
                      <span>·</span>
                      <span className="font-mono font-semibold" style={{ color: "var(--tx2)" }}>
                        {quote.code}
                      </span>
                    </>
                  )}
                  <span data-testid="quote-status-badge">
                    <Badge tone={st.tone} dot>
                      {q.lang === "vi" ? st.vi : st.en}
                    </Badge>
                  </span>
                </div>
                <h1 className="mt-2 text-[20px] font-bold leading-snug tracking-[-0.3px] sm:text-[24px]" style={{ textWrap: "pretty" }}>
                  {quote.title}
                </h1>
                {quote.intro && (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    {quote.intro}
                  </p>
                )}

                <div className="mt-4 flex items-start gap-3 rounded-[14px] p-3.5 sm:p-4" style={{ background: toneBg(hero.tone) }} data-testid={q.accepted ? "quote-accepted-banner" : undefined}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px]" style={{ background: "var(--sf)", color: toneFg(hero.tone) }}>
                    <HeroIcon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold leading-snug tracking-[-0.2px]" style={{ color: hero.tone === "gray" ? "var(--tx)" : toneFg(hero.tone) }}>
                      {hero.title}
                    </p>
                    <p className="mt-0.5 text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                      {hero.sub}
                    </p>
                    {q.accepted && q.contractToken && <ContractLink q={q} L={L} />}
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 lg:grid-cols-4" style={{ borderTop: "1px solid var(--bd2)" }}>
                <Fact label={L("Ngày chụp", "Date")} className="[border-right:1px_solid_var(--bd2)]">
                  {quote.event_date ? (
                    <>
                      <span className="block">{fmtDate(quote.event_date)}</span>
                      <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
                        ÂL {fmtLunar(quote.event_date)}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "var(--tx3)" }}>{L("Chưa chốt ngày", "Not set")}</span>
                  )}
                </Fact>
                <Fact label={L("Địa điểm", "Location")} className="lg:[border-right:1px_solid_var(--bd2)]">
                  <span className="line-clamp-2 text-[14px] leading-snug" style={{ color: quote.location ? "var(--tx)" : "var(--tx3)" }}>
                    {quote.location || "—"}
                  </span>
                </Fact>
                <Fact label={L("Hiệu lực báo giá", "Valid until")} className="[border-right:1px_solid_var(--bd2)] [border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
                  {quote.expires_at ? (
                    <>
                      <span className="block">{fmtDate(quote.expires_at)}</span>
                      <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: q.locked ? "var(--tx3)" : expiring ? "var(--am)" : "var(--tx3)" }}>
                        {q.locked && !q.accepted
                          ? L("Đã hết hiệu lực", "No longer valid")
                          : q.daysLeftNum !== null && !q.accepted
                            ? q.daysLeftNum <= 0
                              ? L("Hết hạn hôm nay", "Expires today")
                              : L(`Còn ${q.daysLeftNum} ngày`, `${q.daysLeftNum} days left`)
                            : ""}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: "var(--tx3)" }}>{L("Không giới hạn", "No expiry")}</span>
                  )}
                </Fact>
                <Fact label={L("Tổng tạm tính", "Current total")} className="[border-top:1px_solid_var(--bd2)] lg:[border-top:0]">
                  <span className="block" style={{ color: "var(--ac)", fontVariantNumeric: "tabular-nums" }} data-testid="quote-client-total">
                    {vnd(q.effectiveTotal)}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-medium" style={{ color: "var(--tx3)" }}>
                    {L("Cọc đề xuất", "Deposit")} {vnd(q.deposit)}
                  </span>
                </Fact>
              </dl>
            </header>

            {expiring && (
              <Callout tone="amber" icon={Clock}>
                {q.daysLeftNum! <= 0 ? tr.expiringToday : tr.expiringIn.replace("{n}", String(q.daysLeftNum))}
              </Callout>
            )}

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-5">
              <Stack gap={16}>
                {q.packageGroups.size > 0 && <PackagesSection q={q} L={L} />}
                {q.standaloneItems.length > 0 && <ItemsSection q={q} L={L} />}

                {!q.locked && (
                  <InfoSection q={q} L={L} studioCanContract={studioCanContract} showErrors={showErrors} />
                )}

                {/* Điện thoại: tổng + nút đồng ý ngay sau ô thông tin. */}
                <div className="lg:hidden" ref={setAcceptEl}>
                  <TotalsCard q={q} L={L} onAccept={tryAccept} />
                </div>

                {q.accepted && <AcceptedNotice q={q} />}

                {(!q.locked || q.adjustments.length > 0) && <ChatSection q={q} studioName={studioName} />}

                {q.locked && !q.accepted && (
                  <p className="text-center text-[13.5px]" style={{ color: "var(--tx3)" }}>
                    {tr.cantModify}
                  </p>
                )}
                {q.error && q.locked && (
                  <Callout tone="red" icon={CircleAlert}>
                    <span data-testid="quote-error">{q.error}</span>
                  </Callout>
                )}

                <p className="pb-2 text-center text-[12.5px]" style={{ color: "var(--tx3)" }}>
                  {tr.footer} <b>{studioName}</b>
                </p>
              </Stack>

              <aside className="hidden lg:sticky lg:top-[76px] lg:flex lg:flex-col lg:gap-4" aria-label={L("Tổng cộng", "Total")}>
                <TotalsCard q={q} L={L} onAccept={tryAccept} />
              </aside>
            </div>
          </Stack>
          {!q.locked && <div className="h-16 lg:hidden" aria-hidden />}
        </div>
      </CustomerMainV2>

      {!q.locked && (
        <StickyActionBar show={!acceptInView}>
          <div className="min-w-0 flex-1">
            <span className="block text-[12px]" style={{ color: "var(--tx3)" }}>
              {L("Tổng cộng", "Total")}
            </span>
            <span className="block truncate text-[16px] font-bold" style={{ color: "var(--ac)", fontVariantNumeric: "tabular-nums" }}>
              {vnd(q.effectiveTotal)}
            </span>
          </div>
          <button type="button" onClick={tryAccept} disabled={q.accepting || q.items.length === 0} className={btn("primary")}>
            <ShieldCheck size={16} /> {L("Đồng ý báo giá", "Accept quote")}
          </button>
        </StickyActionBar>
      )}

      {/* Hỏi lại trước khi đồng ý (thay window.confirm) */}
      <Modal
        open={q.confirmOpen}
        onClose={() => q.setConfirmOpen(false)}
        title={tr.confirmTitle}
        icon={ShieldCheck}
        width={420}
        footer={
          <>
            <button type="button" className={btn("ghost")} onClick={() => q.setConfirmOpen(false)}>
              {L("Huỷ", "Cancel")}
            </button>
            <button type="button" className={btn("primary")} onClick={q.doAccept} disabled={q.accepting} data-testid="quote-accept-confirm">
              <ShieldCheck size={16} /> {q.accepting ? tr.processing : tr.acceptBtn}
            </button>
          </>
        }
      >
        <div className="rounded-[12px] px-4 py-2" style={{ background: "var(--sf2)" }}>
          <MoneyLine label={tr.confirmTotal.replace(":", "")} value={vnd(q.effectiveTotal)} big tone="var(--ac)" />
          <MoneyLine label={tr.confirmDeposit.replace(":", "")} value={vnd(q.deposit)} />
        </div>
        <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
          {(q.autoCreate && studioCanContract ? tr.confirmAutoContract : tr.confirmManual).replace(/^✅\s*/, "")}
        </p>
      </Modal>
    </CustomerRootAuto>
  );
}

type Tr = (vi: string, en: string) => string;

/* ── Gói dịch vụ: chọn MỘT ── */
function PackagesSection({ q, L }: { q: QuoteClient; L: Tr }) {
  const { tr } = q;
  return (
    <Section icon={Package} title={tr.choosePackage} desc={!q.locked ? L("Bấm vào gói để chọn, bấm lần nữa để bỏ.", "Tap a package to choose it, tap again to clear.") : undefined}>
      <div className="flex flex-col gap-3">
        {Array.from(q.packageGroups.entries()).map(([groupName, groupItems]) => {
          const on = groupItems.some((i) => i.selected);
          const groupTotal = groupItems.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0);
          const discounted = q.quote.discount_package_group === groupName && q.quote.bulk_discount_amount > 0;
          return (
            <button
              key={groupName}
              type="button"
              onClick={() => q.toggleItem(groupItems[0])}
              disabled={q.locked}
              aria-pressed={on}
              className="w-full rounded-[14px] p-4 text-left transition-colors disabled:cursor-default"
              style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-full"
                  style={{ border: `2px solid ${on ? "var(--ac)" : "var(--bdS)"}`, background: on ? "var(--ac)" : "transparent" }}
                >
                  {on && <Check size={12} color="#fff" strokeWidth={3} />}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-semibold leading-snug">{groupName}</span>
                  {discounted && (
                    <Badge tone="amber" icon={Tag}>
                      {tr.discount} {vnd(q.quote.bulk_discount_amount)}
                    </Badge>
                  )}
                </div>
                <span className="flex-none whitespace-nowrap text-[15px] font-bold" style={{ color: on ? "var(--ac)" : "var(--tx)", fontVariantNumeric: "tabular-nums" }}>
                  {vnd(groupTotal)}
                </span>
              </div>
              <ul className="mt-2.5 flex flex-col gap-1.5 pl-[34px]">
                {groupItems.map((gi) => (
                  <li key={gi.id} className="flex items-start gap-1.5 text-[13px] leading-snug" style={{ color: "var(--tx2)" }}>
                    <Check size={14} className="mt-[2px] flex-none" style={{ color: on ? "var(--ac)" : "var(--tx3)" }} />
                    <span className="min-w-0">
                      {gi.name}
                      <span className="whitespace-nowrap" style={{ color: "var(--tx3)" }}>
                        {" "}
                        · {gi.qty} × {vnd(gi.unit_price)}
                      </span>
                      {gi.description?.trim() && (
                        <span className="block whitespace-pre-line break-words text-[12.5px]" style={{ color: "var(--tx3)" }}>
                          {gi.description.trim()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ── Hạng mục riêng lẻ: dòng có ô chọn, số tiền canh phải ── */
function ItemsSection({ q, L }: { q: QuoteClient; L: Tr }) {
  const { tr } = q;
  const hasOptional = q.standaloneItems.some((i) => i.is_optional);
  return (
    <Section
      icon={ListChecks}
      title={q.packageGroups.size > 0 ? tr.standaloneTitle : tr.itemsTitle}
      desc={!q.locked && hasOptional ? L("Bấm vào hạng mục tuỳ chọn để thêm hoặc bỏ. Hạng mục có ổ khoá là bắt buộc.", "Tap optional items to add or remove. Locked items are required.") : undefined}
      flush
    >
      {q.standaloneItems.map((it) => (
        <ItemRow key={it.id} it={it} q={q} L={L} />
      ))}
    </Section>
  );
}

function ItemRow({ it, q, L }: { it: QuoteItem; q: QuoteClient; L: Tr }) {
  const on = !it.is_optional || it.selected;
  const lineTotal = (it.qty || 0) * (it.unit_price || 0);
  const clickable = it.is_optional && !q.locked;
  const box = it.is_discount ? (
    <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px]" style={{ background: "var(--amS)", color: "var(--am)" }}>
      <Tag size={13} />
    </span>
  ) : !it.is_optional ? (
    <span className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px]" style={{ background: "var(--sf2)", color: "var(--tx3)" }} title={L("Bắt buộc", "Required")}>
      <Lock size={12} />
    </span>
  ) : (
    <span
      className="grid h-[22px] w-[22px] flex-none place-items-center rounded-[7px]"
      style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bdS)"}`, background: on ? "var(--ac)" : "var(--sf)" }}
    >
      {on && <Check size={13} color="#fff" strokeWidth={3} />}
    </span>
  );
  const body = (
    <>
      <span className="mt-0.5">{box}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug" style={{ color: it.is_discount ? "var(--am)" : on ? "var(--tx)" : "var(--tx2)" }}>
          {it.name}
        </span>
        {it.description?.trim() && (
          <span className="mt-0.5 block whitespace-pre-line break-words text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>
            {it.description.trim()}
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--tx3)" }}>
          {it.qty} × {vnd(it.unit_price)}
          {!it.is_optional && !it.is_discount && <span>· {L("Bắt buộc", "Required")}</span>}
          {it.is_optional && !on && <span>· {L("Chưa chọn", "Not selected")}</span>}
        </span>
      </span>
      <span
        className="flex-none whitespace-nowrap text-[14px] font-semibold"
        style={{ color: it.is_discount ? "var(--am)" : on ? "var(--tx)" : "var(--tx3)", textDecoration: on ? "none" : "line-through", fontVariantNumeric: "tabular-nums" }}
      >
        {it.is_discount ? "−" : ""}
        {vnd(lineTotal)}
      </span>
    </>
  );
  const cls = "flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5";
  const style = { borderBottom: "1px solid var(--bd2)" };
  return clickable ? (
    <button type="button" onClick={() => q.toggleItem(it)} aria-pressed={on} className={`${cls} v2-row-link`} style={style} data-testid={`quote-item-${it.id}`}>
      {body}
    </button>
  ) : (
    <div className={cls} style={style} data-testid={`quote-item-${it.id}`}>
      {body}
    </div>
  );
}

/* ── Tổng cộng + cọc + nút đồng ý ── */
function TotalsCard({ q, L, onAccept }: { q: QuoteClient; L: Tr; onAccept: () => void }) {
  const { tr, quote } = q;
  return (
    <Card>
      <p className="text-[15px] font-semibold">{L("Tổng cộng", "Total")}</p>
      <div className="mt-2">
        {q.bulkDiscountActive && (
          <MoneyLine label={`${tr.packageOffer} ${quote.discount_package_group}`} value={`− ${vnd(quote.bulk_discount_amount)}`} tone="var(--am)" />
        )}
        <MoneyLine big label={L("Tổng tiền", "Total")} value={vnd(q.effectiveTotal)} tone="var(--ac)" />
        <MoneyLine
          label={L("Cọc đề xuất", "Proposed deposit")}
          sub={L(`~${q.depositPct.toFixed(0)}%, làm tròn 500K`, `~${q.depositPct.toFixed(0)}%, rounded to 500K`)}
          value={vnd(q.deposit)}
        />
      </div>
      {quote.discount_package_group && quote.bulk_discount_amount > 0 && !q.bulkDiscountActive && !q.locked && (
        <div className="mt-2">
          <Callout tone="amber" icon={Tag}>
            {tr.selectPackageHint} <b>{quote.discount_package_group}</b> {tr.selectPackageHint2} {vnd(quote.bulk_discount_amount)}
          </Callout>
        </div>
      )}
      {!q.locked && (
        <>
          {q.error && (
            <div className="mt-3">
              <Callout tone="red" icon={CircleAlert}>
                <span data-testid="quote-error">{q.error}</span>
              </Callout>
            </div>
          )}
          <button
            type="button"
            onClick={onAccept}
            disabled={q.accepting || q.items.length === 0}
            className={btn("primary", "lg", "mt-4 w-full")}
            data-testid="quote-accept-btn"
          >
            <ShieldCheck size={18} /> {q.accepting ? tr.processing : L("Đồng ý báo giá", "Accept quote")}
          </button>
          <p className="mt-2 text-center text-[12px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
            {q.autoCreate && q.studioCanContract
              ? L("Studio sẽ tự tạo hợp đồng ngay khi bạn đồng ý.", "A contract is created as soon as you accept.")
              : L("Studio sẽ liên hệ để gửi hợp đồng cho bạn.", "The studio will contact you with the contract.")}
          </p>
        </>
      )}
    </Card>
  );
}

/* ── Thông tin của khách ── */
function InfoSection({ q, L, studioCanContract, showErrors }: { q: QuoteClient; L: Tr; studioCanContract: boolean; showErrors: boolean }) {
  const { tr } = q;
  const nameErr = showErrors && !q.clientName.trim() ? L("Nhập họ tên của bạn.", "Enter your name.") : null;
  const phoneErr = q.clientPhone && !q.phoneValid ? tr.phoneErr : showErrors && !q.clientPhone ? L("Nhập số điện thoại để studio liên hệ.", "Enter a phone number.") : null;
  return (
    <Section id="v2-info" icon={UserRound} title={tr.yourInfoTitle} desc={tr.yourInfoHint}>
      <div className="flex flex-col gap-4" data-testid="quote-accept-form">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={tr.nameLabel} error={nameErr} htmlFor="v2-q-name">
            <input id="v2-q-name" className={inputCls} autoComplete="name" value={q.clientName} onChange={(e) => q.setClientName(e.target.value)} placeholder={tr.namePh} data-testid="accept-name" />
          </Field>
          <Field label={tr.phoneLabel} error={phoneErr} htmlFor="v2-q-phone">
            <input id="v2-q-phone" className={inputCls} type="tel" autoComplete="tel" value={q.clientPhone} onChange={(e) => q.setClientPhone(e.target.value)} placeholder="0901234567" inputMode="numeric" data-testid="accept-phone" />
          </Field>
          <Field label={tr.emailLabel}>
            <input className={inputCls} type="email" autoComplete="email" value={q.clientEmail} onChange={(e) => q.setClientEmail(e.target.value)} placeholder="abc@gmail.com" data-testid="accept-email" />
          </Field>
          <Field label={tr.fbLabel}>
            <input className={inputCls} inputMode="url" value={q.clientFacebook} onChange={(e) => q.setClientFacebook(e.target.value)} placeholder="https://facebook.com/..." data-testid="accept-facebook" />
          </Field>
        </div>
        {studioCanContract && (
          <div className="rounded-[12px] px-3.5 py-1" style={{ background: q.autoCreate ? "var(--acS)" : "var(--sf2)" }} data-testid="accept-auto-create">
            <Switch
              checked={q.autoCreate}
              onChange={q.setAutoCreate}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles size={14} style={{ color: "var(--ac)" }} /> {tr.autoContract}
                </span>
              }
              desc={tr.autoContractHint}
            />
          </div>
        )}
      </div>
    </Section>
  );
}

/* ── Đã đồng ý: link hợp đồng + lưu ý ── */
function ContractLink({ q, L }: { q: QuoteClient; L: Tr }) {
  const { tr } = q;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <a href={`/c/${q.contractToken}`} target="_blank" rel="noreferrer" className={btn("primary")} data-testid="contract-view-link">
        <FileSignature size={16} /> {tr.viewContract} <ExternalLink size={13} />
      </a>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(`${window.location.origin}/c/${q.contractToken}`);
          q.setCopied(true);
          setTimeout(() => q.setCopied(false), 1800);
        }}
        className={btn("secondary")}
        data-testid="contract-copy-link"
      >
        {q.copied ? <Check size={15} /> : <Copy size={15} />} {q.copied ? tr.copied.replace(" ✓", "") : L("Chép link hợp đồng", "Copy contract link")}
      </button>
      <p className="w-full text-[12.5px]" style={{ color: "var(--tx3)" }}>
        {tr.keepLink}
      </p>
    </div>
  );
}

function AcceptedNotice({ q }: { q: QuoteClient }) {
  const { tr } = q;
  return (
    <Callout tone="amber" icon={FileSignature} title={tr.contractNotice}>
      {tr.contractRef} <b>{tr.contractRefLabel}</b>. {tr.contractRefHint}
    </Callout>
  );
}

/* ── Trao đổi với studio: lịch sử + yêu cầu chỉnh sửa ── */
function ChatSection({ q, studioName }: { q: QuoteClient; studioName: string }) {
  const { tr } = q;
  return (
    <Section
      icon={MessageSquare}
      title={q.locked ? tr.chatTitle : tr.adjustTitle}
      desc={!q.locked ? tr.adjustHint : undefined}
    >
      <div className="flex flex-col gap-3" data-testid={!q.locked ? "quote-adjust-section" : undefined}>
        {q.adjustments.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {q.adjustments.map((a) => {
              const me = a.author === "client";
              return (
                <li key={a.id} className={`flex ${me ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[88%] rounded-[14px] px-3.5 py-2.5" style={{ background: me ? "var(--acS)" : "var(--sf2)", borderTopRightRadius: me ? 4 : 14, borderTopLeftRadius: me ? 14 : 4 }}>
                    <p className="text-[12px] font-semibold" style={{ color: "var(--tx3)" }}>
                      {me ? tr.you : studioName} · {fmtDateTime(a.created_at)}
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed" style={{ textWrap: "pretty" }}>
                      {a.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!q.locked && (
          <>
            <textarea className={inputCls} rows={3} value={q.message} onChange={(e) => q.setMessage(e.target.value)} placeholder={tr.adjustPh} data-testid="quote-adjust-input" />
            <div>
              <button type="button" onClick={q.sendAdjustment} disabled={q.sending || !q.message.trim()} className={btn("secondary")} data-testid="quote-adjust-send">
                <Send size={15} /> {q.sending ? tr.sending : tr.sendBtn}
              </button>
            </div>
          </>
        )}
      </div>
    </Section>
  );
}

