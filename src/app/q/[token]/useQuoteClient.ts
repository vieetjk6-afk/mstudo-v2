"use client";

import { useEffect, useState } from "react";
import { isQuoteExpired, quoteDaysLeft } from "@/lib/quote-expiry";
import { quoteSelectedTotal, type StudioQuote, type QuoteItem, type QuoteAdjustment } from "@/lib/types";
import { safeDeposit } from "@/lib/quote-lines";
import { depositRatio } from "@/lib/quote-deposit";

/* ═══════════════════════════════════════════════════════════════════════════
   TRẠNG THÁI + THAO TÁC của trang báo giá gửi khách (/q/<token>) — dùng CHUNG
   cho bản cũ (QuoteClientView) và giao diện mới (QuoteClientViewV2): chọn/bỏ
   hạng mục và gói (gọi máy chủ, lỗi thì hoàn lại), phép tính tổng/ưu đãi/cọc,
   gửi yêu cầu chỉnh sửa, thông tin khách và đồng ý báo giá (tự tạo hợp đồng).
   ═══════════════════════════════════════════════════════════════════════════ */

export type QuoteClientProps = {
  quote: StudioQuote;
  initialItems: QuoteItem[];
  initialAdjustments: QuoteAdjustment[];
  studioName: string;
  studioLogo?: string | null;
  studioCanContract: boolean;
  initialContractToken: string | null;
};


export type Lang = "vi" | "en";
export const TR = {
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
    expiringToday: "Báo giá này hết hiệu lực hôm nay.",
    expiringIn: "Báo giá này còn hiệu lực {n} ngày.",
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
    expiringToday: "This quote expires today.",
    expiringIn: "This quote is valid for {n} more days.",
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

export function useQuoteClient({
  quote,
  initialItems,
  initialAdjustments,
  studioCanContract,
  initialContractToken,
}: QuoteClientProps) {
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

  // Xét cả expires_at chứ không chỉ status: cron đóng báo giá quá hạn chạy một
  // lần mỗi ngày, nên báo giá hết hạn lúc 23:59 vẫn còn status 'sent' suốt sáng
  // hôm sau. API cũng chặn y hệt — đây chỉ là để khách không bấm rồi mới báo lỗi.
  const expiredByDate = isQuoteExpired(quote.expires_at);
  const locked = accepted || quote.status === "cancelled" || quote.status === "expired" || expiredByDate;
  // Còn hiệu lực bao nhiêu ngày — chỉ hiện khi sắp hết, để khách biết mà quyết.
  const daysLeftNum = quoteDaysLeft(quote.expires_at);

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
  // Kẹp cọc về [0, tổng] — tổng 0 không được ra "Cọc Infinity%".
  const deposit = safeDeposit(effectiveTotal);
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

  function toggleLang() {
    const nx: Lang = lang === "vi" ? "en" : "vi";
    setLangState(nx);
    localStorage.setItem("vk_lang", nx);
  }

  return {
    quote, studioCanContract,
    lang, setLangState, toggleLang, tr,
    items, adjustments, message, setMessage, sending, accepting, error, accepted, contractToken,
    copied, setCopied, confirmOpen, setConfirmOpen,
    clientName, setClientName, clientPhone, setClientPhone, clientEmail, setClientEmail, clientFacebook, setClientFacebook,
    autoCreate, setAutoCreate,
    expiredByDate, locked, daysLeftNum,
    packageGroups, standaloneItems, total, selectedPackageGroup, bulkDiscountActive, effectiveTotal, deposit, depositPct,
    phoneDigits, phoneValid, formValid,
    toggleItem, sendAdjustment, accept, doAccept,
  };
}

export type QuoteClient = ReturnType<typeof useQuoteClient>;
