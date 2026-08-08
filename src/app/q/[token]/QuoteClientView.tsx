"use client";

import { useEffect, useState } from "react";

type Lang = "vi" | "en";
const TR = {
  vi: {
    errToggle: "Lỗi",
    errSend: "Lỗi gửi",
    errAccept: "Lỗi",
    confirmTitle: "Xác nhận đồng ý báo giá này?",
    confirmTotal: "Tổng tiền:",
    confirmDeposit: "Cọc đề xuất:",
    confirmAutoContract: "✅ Studio sẽ TỰ ĐỘNG tạo hợp đồng cho bạn ngay sau khi xác nhận.\n",
    confirmManual: "Studio sẽ liên hệ riêng để gửi hợp đồng.\n",
    lockedCancelled: "bị huỷ",
    lockedExpired: "hết hạn",
    lockedMsg: "và không thể thay đổi.",
    quotePrefix: "Báo giá này đã",
    codeLabel: "Mã:",
    eventTitle: "Sự kiện",
    dateLabel: "Ngày:",
    locationLabel: "Địa điểm:",
    itemsTitle: "Hạng mục báo giá",
    itemsHint: "Bấm vào hạng mục có ô vuông để chọn/bỏ. Hạng mục khoá",
    itemsHint2: "là bắt buộc.",
    choosePackage: "Chọn 1 gói dịch vụ",
    discount: "Giảm",
    standaloneTitle: "Hạng mục riêng lẻ",
    packageOffer: "Ưu đãi gói",
    selectPackageHint: "Chọn gói",
    selectPackageHint2: "để được giảm",
    depositLabel: "Cọc đề xuất (~",
    depositLabel2: "%, làm tròn 500K):",
    adjustTitle: "Yêu cầu chỉnh sửa",
    adjustHint: "Nếu cần thay đổi giá / thêm bớt hạng mục / điều khác, ghi rõ ở đây.",
    adjustPh: "Vd: Em muốn bớt khoản makeup, thêm 1 photographer phụ…",
    sending: "Đang gửi…",
    sendBtn: "Gửi yêu cầu",
    chatTitle: "Trao đổi với studio",
    you: "Bạn",
    yourInfoTitle: "Thông tin của bạn",
    yourInfoHint: "Vui lòng điền để studio liên hệ và (nếu chọn) tự tạo hợp đồng.",
    namePh: "Nguyễn Văn A",
    nameLabel: "Họ và tên *",
    phoneLabel: "Số điện thoại *",
    emailLabel: "Email",
    fbLabel: "Link Facebook",
    phoneErr: "SĐT phải có 9–11 chữ số.",
    autoContract: "Tự động tạo hợp đồng cho mình",
    autoContractHint: "Khi xác nhận, hệ thống sẽ tự tạo hợp đồng dựa trên báo giá này (kèm hạng mục đã chọn và mức cọc đề xuất). Studio có thể chỉnh thêm điều khoản trước khi gửi cho bạn ký.",
    processing: "Đang xử lý…",
    acceptBtn: "Tôi đồng ý với báo giá này",
    acceptedMsg: "Bạn đã đồng ý với báo giá này",
    contractCreated: "Hợp đồng đã được tạo tự động. Bấm nút dưới để xem chi tiết và ký xác nhận khi sẵn sàng.",
    viewContract: "Xem hợp đồng",
    copied: "Đã copy ✓",
    copyLink: "Copy link hợp đồng để lưu lại",
    keepLink: "Giữ link này — bạn có thể quay lại xem hợp đồng bất cứ lúc nào.",
    studioContact: "sẽ liên hệ để gửi hợp đồng cho bạn. Cảm ơn bạn!",
    contractNotice: "Lưu ý về hợp đồng",
    contractRef: "Hợp đồng tạo tự động từ báo giá này là",
    contractRefLabel: "hợp đồng tham khảo",
    contractRefHint: "Studio sẽ chỉnh sửa đầy đủ các điều khoản, thông tin chi tiết và gửi lại để bạn xem xét và ký chính thức.",
    cantModify: "Báo giá này không thể thao tác.",
    footer: "Báo giá tạo bởi",
    dateLocale: "vi-VN",
  },
  en: {
    errToggle: "Error",
    errSend: "Error sending",
    errAccept: "Error",
    confirmTitle: "Confirm acceptance of this quote?",
    confirmTotal: "Total:",
    confirmDeposit: "Proposed deposit:",
    confirmAutoContract: "✅ Studio will AUTOMATICALLY create a contract for you right after confirmation.\n",
    confirmManual: "Studio will contact separately to send the contract.\n",
    lockedCancelled: "cancelled",
    lockedExpired: "expired",
    lockedMsg: "and cannot be changed.",
    quotePrefix: "This quote has been",
    codeLabel: "Code:",
    eventTitle: "Event",
    dateLabel: "Date:",
    locationLabel: "Location:",
    itemsTitle: "Quote items",
    itemsHint: "Click items with checkboxes to select/deselect. Locked items",
    itemsHint2: "are required.",
    choosePackage: "Choose 1 service package",
    discount: "Discount",
    standaloneTitle: "Standalone items",
    packageOffer: "Package offer",
    selectPackageHint: "Choose package",
    selectPackageHint2: "to get discount",
    depositLabel: "Proposed deposit (~",
    depositLabel2: "%, rounded to 500K):",
    adjustTitle: "Request adjustment",
    adjustHint: "If you need to change price / add/remove items / anything else, specify clearly here.",
    adjustPh: "E.g.: I want to reduce makeup, add 1 additional photographer…",
    sending: "Sending…",
    sendBtn: "Send request",
    chatTitle: "Exchange with studio",
    you: "You",
    yourInfoTitle: "Your information",
    yourInfoHint: "Please fill in so the studio can contact and (if chosen) auto-create a contract.",
    namePh: "Jane Smith",
    nameLabel: "Full name *",
    phoneLabel: "Phone number *",
    emailLabel: "Email",
    fbLabel: "Facebook link",
    phoneErr: "Phone must have 9–11 digits.",
    autoContract: "Auto-create contract for me",
    autoContractHint: "When confirmed, the system will auto-create a contract based on this quote (with selected items and proposed deposit). Studio can adjust terms before sending for your signature.",
    processing: "Processing…",
    acceptBtn: "I agree with this quote",
    acceptedMsg: "You have agreed with this quote",
    contractCreated: "Contract has been auto-created. Click the button below to view details and sign when ready.",
    viewContract: "View contract",
    copied: "Copied ✓",
    copyLink: "Copy contract link to save",
    keepLink: "Keep this link — you can return to view the contract anytime.",
    studioContact: "will contact to send the contract to you. Thank you!",
    contractNotice: "Contract notice",
    contractRef: "The contract auto-created from this quote is",
    contractRefLabel: "a reference contract",
    contractRefHint: "Studio will fully edit the terms, details and send back for you to review and sign officially.",
    cantModify: "This quote cannot be modified.",
    footer: "Quote created by",
    dateLocale: "en-GB",
  },
} as const;
import {
  Check, MessageSquare, ShieldCheck, Lock, Facebook, Phone, Mail, User as UserIcon,
  Sparkles, FileSignature, ExternalLink, Copy, Tag, Package,
} from "lucide-react";
import {
  vnd,
  QUOTE_STATUS_LABEL,
  quoteSelectedTotal,
  type StudioQuote,
  type QuoteItem,
  type QuoteAdjustment,
} from "@/lib/types";
import { computeRoundedDeposit, depositRatio } from "@/lib/quote-deposit";
import { fmtDateLunar } from "@/lib/date";
import { mainUrl } from "@/lib/hosts";

export default function QuoteClientView({
  quote,
  initialItems,
  initialAdjustments,
  studioName,
  studioLogo = null,
  studioCanContract,
  initialContractToken,
}: {
  quote: StudioQuote;
  initialItems: QuoteItem[];
  initialAdjustments: QuoteAdjustment[];
  studioName: string;
  studioLogo?: string | null;
  studioCanContract: boolean;
  initialContractToken: string | null;
}) {
  const [lang, setLangState] = useState<Lang>("vi");
  useEffect(() => {
    const stored = localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "en") setLangState("en");
  }, []);
  const tr = TR[lang];

  const [items, setItems] = useState(initialItems);
  const [adjustments, setAdjustments] = useState(initialAdjustments);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(quote.status === "accepted" || quote.status === "converted");
  const [contractToken, setContractToken] = useState<string | null>(initialContractToken);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [clientName, setClientName] = useState(quote.client_name || "");
  const [clientPhone, setClientPhone] = useState(quote.client_phone || "");
  const [clientEmail, setClientEmail] = useState(quote.client_email || "");
  const [clientFacebook, setClientFacebook] = useState(quote.client_facebook || "");
  const [autoCreate, setAutoCreate] = useState(studioCanContract);

  const locked = accepted || quote.status === "cancelled" || quote.status === "expired";

  // Separate items into package groups and standalone items.
  const packageGroups = new Map<string, QuoteItem[]>();
  const standaloneItems: QuoteItem[] = [];
  for (const it of items) {
    if (it.package_group) {
      if (!packageGroups.has(it.package_group)) packageGroups.set(it.package_group, []);
      packageGroups.get(it.package_group)!.push(it);
    } else {
      standaloneItems.push(it);
    }
  }

  const total = quoteSelectedTotal(items);

  // Which package is currently selected (packages are mutually exclusive).
  const selectedPackageGroup = items.find((i) => i.package_group && i.selected)?.package_group ?? null;

  // Package-tied discount: applies only when the client picks the studio's
  // designated package (discount_package_group).
  const bulkDiscountActive =
    !!quote.discount_package_group &&
    selectedPackageGroup === quote.discount_package_group &&
    quote.bulk_discount_amount > 0;
  const effectiveTotal = bulkDiscountActive ? total - quote.bulk_discount_amount : total;
  const deposit = computeRoundedDeposit(effectiveTotal);
  const depositPct = depositRatio(effectiveTotal, deposit);

  const phoneDigits = clientPhone.replace(/\s+/g, "");
  const phoneValid = /^[0-9]{9,11}$/.test(phoneDigits);
  const formValid = clientName.trim().length > 0 && phoneValid;

  async function toggleItem(it: QuoteItem) {
    if ((!it.is_optional && !it.package_group) || locked) return;
    const next = !it.selected;
    const prevItems = items;
    // Packages are mutually exclusive: selecting one deselects every other
    // package. Standalone optional items toggle on their own.
    if (it.package_group) {
      setItems((arr) =>
        arr.map((i) => {
          if (!i.package_group) return i;
          if (next) return { ...i, selected: i.package_group === it.package_group };
          return i.package_group === it.package_group ? { ...i, selected: false } : i;
        }),
      );
    } else {
      setItems((arr) => arr.map((i) => i.id === it.id ? { ...i, selected: next } : i));
    }
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quote.client_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", item_id: it.id, selected: next }),
      });
      if (!r.ok) throw new Error((await r.json()).error || tr.errToggle);
    } catch (e) {
      setItems(prevItems);
      setError(e instanceof Error ? e.message : tr.errToggle);
    }
  }

  async function sendAdjustment() {
    if (!message.trim() || locked) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quote.client_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "adjust", message: message.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || tr.errSend);
      setAdjustments((arr) => [...arr, data.adjustment as QuoteAdjustment]);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.errSend);
    } finally {
      setSending(false);
    }
  }

  // Mở hộp xác nhận trong app (thay cho window.confirm gốc — đẹp & dịch được).
  function accept() {
    if (locked || !formValid) return;
    setConfirmOpen(true);
  }

  async function doAccept() {
    if (locked || !formValid) return;
    setConfirmOpen(false);
    setAccepting(true);
    setError(null);
    try {
      const r = await fetch(`/api/quote/${quote.client_token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          client_name: clientName.trim(),
          client_phone: phoneDigits,
          client_email: clientEmail.trim(),
          client_facebook: clientFacebook.trim(),
          auto_create_contract: autoCreate && studioCanContract,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || tr.errAccept);
      setAccepted(true);
      if (data.contract_token) setContractToken(data.contract_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr.errAccept);
    } finally {
      setAccepting(false);
    }
  }

  /* ── Khối dùng lại (bản thiết kế trang gửi khách) ───────────────────────── */
  const sectionCls = "overflow-hidden rounded-[14px]";
  const sectionStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const headCls = "px-5 py-4 text-[10.5px] font-extrabold uppercase";
  const headStyle = { letterSpacing: ".7px", color: "var(--tx3)", borderBottom: "1px solid var(--bd2)" } as const;

  return (
    <main className="client-doc min-h-screen px-4 py-6 sm:px-5 sm:py-9" data-testid="quote-client-page">
      <div className="mx-auto flex max-w-[720px] flex-col gap-3.5">

        {/* Báo giá đã khoá */}
        {locked && !accepted && (
          <div className="rounded-[11px] px-4 py-3 text-[12.5px] font-semibold" style={{ background: "var(--blS)", color: "var(--bl)" }}>
            {tr.quotePrefix} {quote.status === "cancelled" ? tr.lockedCancelled : tr.lockedExpired} {tr.lockedMsg}
          </div>
        )}

        {/* Điều khiển phụ — không thuộc văn bản nên đứng ngoài, canh phải. */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => { const nx: Lang = lang === "vi" ? "en" : "vi"; setLangState(nx); localStorage.setItem("vk_lang", nx); }}
            className="flex-none text-[11.5px] font-bold"
            style={{ color: "var(--tx3)" }}
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
        </div>

        {/* ══ Thẻ báo giá ═════════════════════════════════════════════════ */}
        <div className={sectionCls} style={sectionStyle}>

          {/* Đầu văn bản — thương hiệu studio canh giữa ngay trên nhãn văn bản,
              đúng đầu trang của bản thiết kế. */}
          <div className="px-5 py-7 text-center sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <div className="flex items-center justify-center gap-2">
              {studioLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={studioLogo} alt={studioName} className="h-8 w-auto object-contain" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-[7px] text-[13px] font-extrabold text-white" style={{ background: "var(--ac)" }}>
                  {studioName.trim().charAt(0).toUpperCase() || "S"}
                </span>
              )}
              <span className="text-[16px] font-extrabold" style={{ letterSpacing: "-.4px" }}>{studioName}</span>
            </div>
            <p className="mt-4 text-[11px] font-bold uppercase" style={{ letterSpacing: "1px", color: "var(--tx3)" }}>
              {lang === "vi" ? "Báo giá dịch vụ chụp ảnh" : "Photography service quote"}
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold sm:text-[27px]" style={{ letterSpacing: "-.6px", textWrap: "pretty" }}>{quote.title}</h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {quote.code && (
                <span className="text-[12px]" style={{ color: "var(--tx3)", fontFamily: "ui-monospace, monospace" }}>{quote.code}</span>
              )}
              <span
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold"
                style={accepted
                  ? { background: "var(--gnS)", color: "var(--gn)" }
                  : { background: "var(--sf2)", color: "var(--tx2)" }}
                data-testid="quote-status-badge"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: accepted ? "var(--gn)" : "var(--tx3)" }} />
                {QUOTE_STATUS_LABEL[accepted ? "accepted" : quote.status]}
              </span>
            </div>
          </div>

          {/* Lời chào */}
          {quote.intro && (
            <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{quote.intro}</p>
            </div>
          )}

          {/* Sự kiện */}
          {(quote.event_date || quote.location) && (
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              {quote.event_date && (
                <div>
                  <p className="eyebrow">{tr.dateLabel.replace(":", "")}</p>
                  <p className="mt-1 text-[14px] font-semibold">{fmtDateLunar(quote.event_date)}</p>
                </div>
              )}
              {quote.location && (
                <div>
                  <p className="eyebrow">{tr.locationLabel.replace(":", "")}</p>
                  <p className="mt-1 text-[14px] font-semibold">{quote.location}</p>
                </div>
              )}
            </div>
          )}

          {/* Hạng mục */}
          <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
            <p className="eyebrow">{tr.itemsTitle}</p>
            {!locked && (
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                {tr.itemsHint} <Lock size={10} className="inline" /> {tr.itemsHint2}
              </p>
            )}

            {/* Gói dịch vụ — chọn 1 */}
            {packageGroups.size > 0 && (
              <div className="mt-3 space-y-2">
                <p className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
                  <Package size={12} /> {tr.choosePackage}
                </p>
                {Array.from(packageGroups.entries()).map(([groupName, groupItems]) => {
                  const groupSelected = groupItems.some((i) => i.selected);
                  const groupTotal = groupItems.reduce((s, i) => s + (i.qty || 0) * (i.unit_price || 0), 0);
                  return (
                    <button
                      key={groupName}
                      onClick={() => toggleItem(groupItems[0])}
                      disabled={locked}
                      className="w-full rounded-[12px] p-4 text-left"
                      style={{
                        border: `1px solid ${groupSelected ? "var(--ac)" : "var(--bd)"}`,
                        background: groupSelected ? "var(--acS)" : "var(--sf)",
                        cursor: locked ? "default" : "pointer",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="grid h-5 w-5 flex-none place-items-center rounded-full"
                            style={{
                              border: `2px solid ${groupSelected ? "var(--ac)" : "var(--bd)"}`,
                              background: groupSelected ? "var(--ac)" : "transparent",
                            }}
                          >
                            {groupSelected && <Check size={11} color="#fff" />}
                          </span>
                          <span className="truncate text-[13.5px] font-bold">{groupName}</span>
                          {quote.discount_package_group === groupName && quote.bulk_discount_amount > 0 && (
                            <span className="flex-none whitespace-nowrap rounded-[20px] px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--amS)", color: "var(--am)" }}>
                              <Tag size={9} className="mr-0.5 inline" /> {tr.discount} {vnd(quote.bulk_discount_amount)}
                            </span>
                          )}
                        </div>
                        <span className="flex-none whitespace-nowrap text-[13.5px] font-bold" style={{ color: "var(--ac)" }}>{vnd(groupTotal)}</span>
                      </div>
                      <ul className="mt-2 space-y-0.5 pl-[30px] text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {groupItems.map((gi) => (
                          <li key={gi.id}>• {gi.name}{gi.description ? ` — ${gi.description}` : ""} ({gi.qty} × {vnd(gi.unit_price)})</li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Hạng mục riêng lẻ */}
            {standaloneItems.length > 0 && (
              <div className="mt-3 space-y-2">
                {packageGroups.size > 0 && (
                  <p className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>{tr.standaloneTitle}</p>
                )}
                {standaloneItems.map((it) => {
                  const isOn = !it.is_optional || it.selected;
                  const lineTotal = (it.qty || 0) * (it.unit_price || 0);
                  return (
                    <button
                      key={it.id}
                      onClick={() => toggleItem(it)}
                      disabled={!it.is_optional || locked}
                      className="w-full rounded-[11px] p-3 text-left"
                      style={{
                        border: `1px solid ${it.is_discount ? "var(--am)" : isOn ? "var(--ac)" : "var(--bd)"}`,
                        background: it.is_discount ? "var(--amS)" : isOn ? "var(--acS)" : "var(--sf)",
                        cursor: it.is_optional && !locked ? "pointer" : "default",
                        opacity: isOn ? 1 : 0.6,
                      }}
                      data-testid={`quote-item-${it.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-[6px]"
                          style={{
                            border: `1px solid ${it.is_discount ? "var(--am)" : isOn ? "var(--ac)" : "var(--bd)"}`,
                            background: it.is_discount ? "var(--am)" : isOn ? "var(--ac)" : "transparent",
                          }}
                        >
                          {it.is_discount ? <Tag size={11} color="#fff" />
                            : !it.is_optional ? <Lock size={11} color="#fff" />
                            : isOn ? <Check size={12} color="#fff" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold" style={{ color: it.is_discount ? "var(--am)" : undefined }}>{it.name}</p>
                          {it.description && <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>{it.description}</p>}
                          <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>{it.qty} × {vnd(it.unit_price)}</p>
                        </div>
                        <p className="flex-none whitespace-nowrap text-[13px] font-bold" style={{ color: it.is_discount ? "var(--am)" : "var(--tx)" }}>
                          {it.is_discount ? "−" : ""}{vnd(lineTotal)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tổng cộng */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--bd)" }}>
              {bulkDiscountActive && (
                <div className="mb-1.5 flex justify-between text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>{tr.packageOffer} {quote.discount_package_group}</span>
                  <strong style={{ color: "var(--am)" }}>− {vnd(quote.bulk_discount_amount)}</strong>
                </div>
              )}
              {quote.discount_package_group && quote.bulk_discount_amount > 0 && !bulkDiscountActive && !locked && (
                <p className="mb-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {tr.selectPackageHint} <b style={{ color: "var(--tx2)" }}>{quote.discount_package_group}</b> {tr.selectPackageHint2} {vnd(quote.bulk_discount_amount)}
                </p>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-[13.5px] font-bold">{lang === "vi" ? "Tổng cộng" : "Total"}</span>
                <span className="text-[22px] font-bold" style={{ letterSpacing: "-.6px", color: "var(--ac)" }} data-testid="quote-client-total">
                  {vnd(effectiveTotal)}
                </span>
              </div>
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                {tr.depositLabel}{depositPct.toFixed(0)}{tr.depositLabel2} <b style={{ color: "var(--tx2)" }}>{vnd(deposit)}</b>
              </p>
            </div>
          </div>

          {/* Thông tin của bạn + nút đồng ý */}
          {!locked && (
            <div className="px-5 py-6 sm:px-7" style={{ background: "var(--sf2)" }} data-testid="quote-accept-form">
              <p className="eyebrow flex items-center gap-1.5"><ShieldCheck size={13} /> {tr.yourInfoTitle}</p>
              <p className="mt-1 text-[12px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{tr.yourInfoHint}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <ClientField icon={<UserIcon size={13} />} label={tr.nameLabel}>
                  <input className="input mt-1 w-full" style={{ background: "var(--sf)" }} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={tr.namePh} data-testid="accept-name" />
                </ClientField>
                <ClientField icon={<Phone size={13} />} label={tr.phoneLabel}>
                  <input className="input mt-1 w-full" style={{ background: "var(--sf)" }} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="0901234567" inputMode="numeric" data-testid="accept-phone" />
                  {clientPhone && !phoneValid && (
                    <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--rd)" }}>{tr.phoneErr}</p>
                  )}
                </ClientField>
                <ClientField icon={<Mail size={13} />} label={tr.emailLabel}>
                  <input className="input mt-1 w-full" style={{ background: "var(--sf)" }} type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="abc@gmail.com" data-testid="accept-email" />
                </ClientField>
                <ClientField icon={<Facebook size={13} />} label={tr.fbLabel}>
                  <input className="input mt-1 w-full" style={{ background: "var(--sf)" }} value={clientFacebook} onChange={(e) => setClientFacebook(e.target.value)} placeholder="https://facebook.com/..." data-testid="accept-facebook" />
                </ClientField>
              </div>

              {studioCanContract && (
                <label
                  className="mt-4 flex cursor-pointer items-start gap-3 rounded-[11px] p-3"
                  style={{ border: `1px solid ${autoCreate ? "var(--ac)" : "var(--bd)"}`, background: autoCreate ? "var(--acS)" : "var(--sf)" }}
                >
                  <input
                    type="checkbox"
                    checked={autoCreate}
                    onChange={(e) => setAutoCreate(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                    style={{ accentColor: "var(--ac)" }}
                    data-testid="accept-auto-create"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">
                      <Sparkles size={13} style={{ color: "var(--ac)" }} /> {tr.autoContract}
                    </span>
                    <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>{tr.autoContractHint}</span>
                  </span>
                </label>
              )}

              {error && <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }} data-testid="quote-error">{error}</p>}

              <button
                onClick={accept}
                disabled={accepting || items.length === 0 || !formValid}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14.5px] font-bold disabled:opacity-50"
                style={{ background: "var(--ac)", color: "#fff" }}
                data-testid="quote-accept-btn"
              >
                <ShieldCheck size={19} /> {accepting ? tr.processing : tr.acceptBtn}
              </button>
            </div>
          )}
        </div>

        {/* Đã đồng ý */}
        {locked && accepted && (
          <div className="flex flex-col gap-3.5">
            <div className={`${sectionCls} px-5 py-7 text-center`} style={{ ...sectionStyle, borderColor: "var(--gn)" }} data-testid="quote-accepted-banner">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
                <Check size={26} />
              </span>
              <p className="mt-3 text-[17px] font-bold" style={{ color: "var(--gn)" }}>{tr.acceptedMsg}</p>
              {contractToken ? (
                <>
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{tr.contractCreated}</p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <a
                      href={mainUrl(`/c/${contractToken}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-[11px] px-5 py-3 text-[13.5px] font-bold"
                      style={{ background: "var(--ac)", color: "#fff" }}
                      data-testid="contract-view-link"
                    >
                      <FileSignature size={16} /> {tr.viewContract} <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(mainUrl(`/c/${contractToken}`));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1800);
                      }}
                      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold"
                      style={{ color: "var(--tx2)" }}
                      data-testid="contract-copy-link"
                    >
                      <Copy size={12} /> {copied ? tr.copied : tr.copyLink}
                    </button>
                    <p className="text-[11px]" style={{ color: "var(--tx3)" }}>{tr.keepLink}</p>
                  </div>
                </>
              ) : (
                <p className="mt-1.5 text-[13px]" style={{ color: "var(--tx2)" }}>{studioName} {tr.studioContact}</p>
              )}
            </div>

            <div className="rounded-[11px] px-4 py-3.5" style={{ background: "var(--amS)" }}>
              <p className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--am)" }}>
                <FileSignature size={14} /> {tr.contractNotice}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {tr.contractRef} <b>{tr.contractRefLabel}</b>. {tr.contractRefHint}
              </p>
            </div>
          </div>
        )}

        {locked && !accepted && (
          <p className="text-center text-[13px]" style={{ color: "var(--tx3)" }}>{tr.cantModify}</p>
        )}

        {/* Yêu cầu chỉnh sửa */}
        {!locked && (
          <div className={sectionCls} style={sectionStyle} data-testid="quote-adjust-section">
            <p className={headCls} style={headStyle}>
              <MessageSquare size={12} className="mr-1 inline" /> {tr.adjustTitle}
            </p>
            <div className="px-5 py-4">
              <p className="text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{tr.adjustHint}</p>
              <textarea
                className="input mt-2.5 w-full"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={tr.adjustPh}
                data-testid="quote-adjust-input"
              />
              <button
                onClick={sendAdjustment}
                disabled={sending || !message.trim()}
                className="mt-2.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
                style={{ background: "var(--ac)", color: "#fff" }}
                data-testid="quote-adjust-send"
              >
                {sending ? tr.sending : tr.sendBtn}
              </button>
            </div>
          </div>
        )}

        {/* Trao đổi với studio */}
        {adjustments.length > 0 && (
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{tr.chatTitle}</p>
            <div className="space-y-2 px-5 py-4">
              {adjustments.map((a) => (
                <div
                  key={a.id}
                  className="rounded-[11px] p-3"
                  style={{ background: a.author === "client" ? "var(--sf2)" : "var(--acS)" }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "var(--tx3)" }}>
                    {a.author === "client" ? tr.you : studioName} · {new Date(a.created_at).toLocaleString(tr.dateLocale)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px]" style={{ textWrap: "pretty" }}>{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && locked && (
          <p className="rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }} data-testid="quote-error">{error}</p>
        )}

        <p className="pb-2 text-center text-[11.5px]" style={{ color: "var(--tx3)" }}>
          {tr.footer} <b>{studioName}</b>
        </p>
      </div>

      {/* Hộp xác nhận đồng ý báo giá (thay window.confirm) */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,.5)", backdropFilter: "blur(2px)" }}
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setConfirmOpen(false)}
        >
          <div className="w-full max-w-[380px] rounded-[16px] p-6" style={{ background: "var(--sf)", border: "1px solid var(--bd)", boxShadow: "0 24px 70px rgba(20,15,25,.28)" }}>
            <h2 className="text-[18px] font-bold" style={{ letterSpacing: "-.4px" }}>{tr.confirmTitle}</h2>
            <div className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span style={{ color: "var(--tx2)" }}>{tr.confirmTotal}</span><b>{vnd(effectiveTotal)}</b></div>
              <div className="flex justify-between"><span style={{ color: "var(--tx2)" }}>{tr.confirmDeposit}</span><b>{vnd(deposit)}</b></div>
            </div>
            <p className="mt-3 whitespace-pre-line text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
              {autoCreate && studioCanContract ? tr.confirmAutoContract : tr.confirmManual}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-[10px] py-2.5 text-[13px] font-semibold"
                style={{ border: "1px solid var(--bd)" }}
              >
                {lang === "en" ? "Cancel" : "Huỷ"}
              </button>
              <button
                onClick={doAccept}
                disabled={accepting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] font-bold disabled:opacity-50"
                style={{ background: "var(--ac)", color: "#fff" }}
                data-testid="quote-accept-confirm"
              >
                <ShieldCheck size={16} /> {accepting ? tr.processing : tr.acceptBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ClientField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label flex items-center gap-1.5">{icon}{label}</span>
      {children}
    </label>
  );
}
