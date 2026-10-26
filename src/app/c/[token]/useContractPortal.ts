"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContractAddendum } from "@/lib/contract-addenda";
import { qrUrl, instalmentNote, type BankInfo } from "@/lib/vietqr";
import type { PortalLoyalty } from "./PortalVoucher";
import { usePaymentWatch, type PaidEvent } from "./PaidConfirm";
import { compressImage, checkImageFile } from "@/lib/image";
import { contractTotal, sumAmounts, type ShootType, type ContractStatus, type PaymentKind } from "@/lib/types";

/* ═══════════════════════════════════════════════════════════════════════════
   TRẠNG THÁI + THAO TÁC của trang hợp đồng gửi khách (/c/<token>) — dùng CHUNG
   cho bản cũ (ContractView) và giao diện mới (ContractViewV2). Mọi lời gọi máy
   chủ (mở khoá bằng SĐT, ký, gửi ảnh chuyển khoản, báo đã chuyển, chọn gói,
   brief, đánh giá, Messenger, yêu cầu sửa) và phép tính tiền đều nằm ở đây, nên
   hai bản luôn hành xử giống hệt nhau — chỉ khác cách sắp xếp trên màn hình.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Contract = {
  code: string | null;
  title: string;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_messenger: string | null;
  shoot_type: ShootType;
  event_date: string | null;
  event_time: string | null;
  location: string | null;
  status: ContractStatus;
  note: string | null;
  client_signed_name: string | null;
  client_signature: string | null;
  client_signed_at: string | null;
  studio_signed_name: string | null;
  studio_signature: string | null;
  studio_signed_at: string | null;
  brief_concept: string | null;
  brief_outfit: string | null;
  brief_refs: string | null;
  brief_note: string | null;
  brief_submitted_at: string | null;
  updated_at: string;
};
export type Item = { id: string; name: string; description: string | null; qty: number; unit_price: number };
export type Payment = { id: string; amount: number; kind: PaymentKind; paid_at: string };
export type Milestone = { id: string; title: string; event_date: string; event_time: string | null; note: string | null };
export type QuoteOption = { id: string; name: string; price: number; description: string | null };
export type PlanRow = { id: string; label: string; amount: number; due_date: string | null; paid: boolean; paid_at: string | null; pay_code?: string | null };
export type ExpenseRow = { id: string; title: string; amount: number; category: string | null; spent_at: string };
export type TaskRow = { id: string; label: string; done: boolean };
export type ProductRow = { id: string; name: string; qty: number; cost: number; status: string };
export type Gallery = { slug: string; title: string };
export type Selection = { slug: string; title: string; phase?: string };
export type GiftPage = { slug: string; edit_token: string; published: boolean };

/** Phần trả về của POST /api/c/<token> mà trang khách dùng tới. */
export type PortalPayload = {
  contract: Contract & { chosen_quote_option_id?: string | null };
  studio_name?: string | null;
  studio_logo?: string | null;
  studio_phone?: string | null;
  items?: Item[];
  payments?: Payment[];
  milestones?: Milestone[];
  gallery?: Gallery | null;
  selection?: Selection | null;
  wedding?: GiftPage | null;
  story?: GiftPage | null;
  quote_options?: QuoteOption[];
  plan?: PlanRow[];
  expenses?: ExpenseRow[];
  tasks?: TaskRow[];
  products?: ProductRow[];
  addenda?: ContractAddendum[];
  loyalty?: PortalLoyalty | null;
  bank?: BankInfo | null;
};

export type Lang = "vi" | "en";
export const TR = {
  vi: {
    portalTitle: "Hợp đồng của bạn", gatePrompt: "Nhập số điện thoại đã đăng ký để xem hợp đồng.",
    phone: "Số điện thoại", view: "Xem hợp đồng", opening: "Đang mở…", pdf: "Tải PDF / In",
    wrongPhone: "Số điện thoại không khớp. Vui lòng kiểm tra lại.", notFound: "Không tìm thấy hợp đồng.", genericErr: "Có lỗi xảy ra.",
    client: "Khách hàng", schedule: "Lịch trình", pickPhotos: "Chọn ảnh của bạn", pickPhotosSub: "đánh dấu những tấm ưng ý",
    viewPhotos: "Xem ảnh của bạn", viewPhotosSub: "mật khẩu là SĐT của bạn", open: "Mở →",
    items: "Hạng mục dịch vụ", noItems: "Chưa có hạng mục.", totalVal: "Tổng giá trị", paid: "Đã thanh toán", remaining: "Còn lại",
    terms: "Ghi chú / Điều khoản", signTitle: "Xác nhận & ký hợp đồng", signedOn: "Bạn đã ký ngày",
    signAgree: "Ký xác nhận đồng ý với nội dung hợp đồng trên.", signerName: "Họ tên người ký", signature: "Chữ ký",
    sign: "Đồng ý & ký", signing: "Đang ký…", review: "Đánh giá studio", reviewThanks: "Cảm ơn bạn đã đánh giá!",
    reviewPrompt: "Bạn hài lòng với dịch vụ chứ? Để lại cảm nhận giúp studio nhé.", reviewPh: "Cảm nhận của bạn…", sendReview: "Gửi đánh giá",
    messenger: "Liên hệ qua Messenger", messengerPrompt: "Dán link Facebook/Messenger của bạn để studio tiện liên hệ.", saveLink: "Lưu link", saved: "Đã lưu",
    editReq: "Yêu cầu chỉnh sửa", editPrompt: "Nếu có điểm chưa phù hợp, hãy gửi yêu cầu cho studio trước khi ký.",
    editSent: "Đã gửi yêu cầu. Studio sẽ liên hệ với bạn.", editPh: "Nội dung muốn chỉnh sửa…", send: "Gửi yêu cầu", sending: "Đang gửi…",
    updated: "Cập nhật", needName: "Nhập họ tên người ký.",
    briefTitle: "Brief buổi chụp", briefPrompt: "Cho studio biết mong muốn của bạn để buổi chụp đúng ý.",
    briefConcept: "Concept / phong cách", briefOutfit: "Trang phục / số người", briefRefs: "Link ảnh tham khảo", briefNote: "Yêu cầu khác",
    briefSave: "Gửi brief", briefSaved: "Đã gửi brief — cảm ơn bạn!",
    quoteTitle: "Chọn gói dịch vụ", quotePrompt: "Mời bạn chọn gói phù hợp nhất.", choose: "Chọn gói này", chosen: "Đã chọn",
  },
  en: {
    portalTitle: "Your contract", gatePrompt: "Enter your registered phone number to view the contract.",
    phone: "Phone number", view: "View contract", opening: "Opening…", pdf: "Save PDF / Print",
    wrongPhone: "Phone number doesn't match. Please check again.", notFound: "Contract not found.", genericErr: "Something went wrong.",
    client: "Client", schedule: "Schedule", pickPhotos: "Pick your photos", pickPhotosSub: "mark your favourites",
    viewPhotos: "View your photos", viewPhotosSub: "password is your phone number", open: "Open →",
    items: "Service items", noItems: "No items yet.", totalVal: "Total value", paid: "Paid", remaining: "Remaining",
    terms: "Notes / Terms", signTitle: "Confirm & sign contract", signedOn: "You signed on",
    signAgree: "Sign to agree with the contract above.", signerName: "Signer's full name", signature: "Signature",
    sign: "Agree & sign", signing: "Signing…", review: "Rate the studio", reviewThanks: "Thank you for your review!",
    reviewPrompt: "Happy with the service? Leave your feedback for the studio.", reviewPh: "Your feedback…", sendReview: "Send review",
    messenger: "Contact via Messenger", messengerPrompt: "Paste your Facebook/Messenger link so the studio can reach you.", saveLink: "Save link", saved: "Saved",
    editReq: "Request changes", editPrompt: "If something isn't right, send a request to the studio before signing.",
    editSent: "Request sent. The studio will contact you.", editPh: "What you'd like to change…", send: "Send request", sending: "Sending…",
    updated: "Updated", needName: "Enter the signer's name.",
    briefTitle: "Shoot brief", briefPrompt: "Tell the studio your wishes so the shoot turns out right.",
    briefConcept: "Concept / style", briefOutfit: "Outfit / headcount", briefRefs: "Reference photo links", briefNote: "Other requests",
    briefSave: "Send brief", briefSaved: "Brief sent — thank you!",
    quoteTitle: "Choose a package", quotePrompt: "Please pick the option that suits you best.", choose: "Choose this", chosen: "Chosen",
  },
} as const;

export function useContractPortal(
  token: string,
  opts: {
    /** Dữ liệu dựng sẵn (màn xem trước giao diện) — bỏ qua bước nhập SĐT. */
    initial?: PortalPayload;
  } = {},
) {
  const demo = !!opts.initial;
  const [phone, setPhone] = useState("");
  const [contract, setContract] = useState<Contract | null>(null);
  const [studioName, setStudioName] = useState("Studio");
  const [studioLogo, setStudioLogo] = useState<string | null>(null);
  const [studioPhone, setStudioPhone] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [wedding, setWedding] = useState<GiftPage | null>(null);
  const [story, setStory] = useState<GiftPage | null>(null);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [chosenQuote, setChosenQuote] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [addenda, setAddenda] = useState<ContractAddendum[]>([]);
  const [loyalty, setLoyalty] = useState<PortalLoyalty | null>(null);
  const [bank, setBank] = useState<BankInfo>({ bin: null, account: null, holder: null, name: null });
  const [paidReported, setPaidReported] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [qrOpen, setQrOpenRaw] = useState(false);
  // Khách có thao tác thanh toán (mở QR, gửi ảnh, báo đã chuyển) → theo dõi tiền về.
  const [payNudge, setPayNudge] = useState(0);
  const [paidNow, setPaidNow] = useState<PaidEvent | null>(null);
  const setQrOpen = (v: boolean) => {
    setQrOpenRaw(v);
    if (v) setPayNudge((n) => n + 1);
  };
  const [qr, setQr] = useState("");
  const [lang, setLang] = useState<Lang>("vi");
  const t = (k: keyof typeof TR.vi) => TR[lang][k];
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editMsg, setEditMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Báo lỗi bằng toast trong app thay vì alert() của trình duyệt (hộp thoại OS
  // chặn cứng, lạc lõng trên trang ký hợp đồng của khách).
  const [toast, setToast] = useState<string | null>(null);
  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }

  // signing
  const [signName, setSignName] = useState("");
  const [signature, setSignature] = useState("");
  const [signing, setSigning] = useState(false);

  // messenger link
  const [messenger, setMessenger] = useState("");
  const [msgrSaved, setMsgrSaved] = useState(false);

  // review
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSent, setReviewSent] = useState(false);

  // brief
  const [brief, setBrief] = useState({ concept: "", outfit: "", refs: "", note: "" });
  const [briefSent, setBriefSent] = useState(false);

  // QR of this portal page (printed on the PDF)
  useEffect(() => {
    if (!contract) return;
    (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        setQr(await QRCode.toDataURL(window.location.href, { margin: 1, width: 240, color: { dark: "#111", light: "#ffffff" } }));
      } catch {
        /* QR is optional */
      }
    })();
  }, [contract]);

  function apply(j: PortalPayload) {
    setContract(j.contract);
    setStudioName(j.studio_name || "Studio");
    setStudioLogo(j.studio_logo || null);
    setStudioPhone(j.studio_phone ?? null);
    setItems(j.items ?? []);
    setPayments(j.payments ?? []);
    setMilestones(j.milestones ?? []);
    setGallery(j.gallery ?? null);
    setSelection(j.selection ?? null);
    setWedding(j.wedding ?? null);
    setStory(j.story ?? null);
    setQuoteOptions(j.quote_options ?? []);
    setChosenQuote(j.contract?.chosen_quote_option_id ?? null);
    setPlan(j.plan ?? []);
    setExpenses(j.expenses ?? []);
    setTasks(j.tasks ?? []);
    setProducts(j.products ?? []);
    setAddenda(j.addenda ?? []);
    setLoyalty(j.loyalty ?? null);
    if (j.bank) setBank(j.bank as BankInfo);
    setMessenger(j.contract?.client_messenger ?? "");
    setBrief({
      concept: j.contract?.brief_concept ?? "",
      outfit: j.contract?.brief_outfit ?? "",
      refs: j.contract?.brief_refs ?? "",
      note: j.contract?.brief_note ?? "",
    });
  }

  // Màn xem trước: nạp sẵn dữ liệu giả một lần, như vừa mở khoá xong.
  const initial = opts.initial;
  useEffect(() => {
    if (initial) apply(initial);
  }, [initial]);

  async function fetchContract(pw: string) {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: pw }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.error as string };
    }
    const j = (await res.json()) as PortalPayload;
    apply(j);
    return { ok: true };
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const r = await fetchContract(phone);
    setLoading(false);
    if (!r.ok) {
      setErr(r.error === "wrong_phone" ? t("wrongPhone") : r.error === "not_found" ? t("notFound") : t("genericErr"));
    }
  }

  async function sendEdit() {
    if (!editMsg.trim()) return;
    setSending(true);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit_request", phone, message: editMsg.trim() }),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setEditMsg("");
      setTimeout(() => setSent(false), 4000);
    } else {
      flashToast(t("genericErr"));
    }
  }

  async function reportPaid() {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid", phone }),
    });
    if (res.ok) {
      setPaidReported(true);
      setPayNudge((n) => n + 1);
    }
    else flashToast(t("genericErr"));
  }

  async function uploadProof(file: File, planId?: string) {
    const check = checkImageFile(file);
    if (!check.ok) { flashToast(check.error); return; }
    setProofUploading(true);
    // Compress before upload (keep numbers legible) so stored proofs stay light.
    let upload: File = file;
    try {
      const dataUrl = await compressImage(file, { maxDim: 1600, quality: 0.85, mime: "image/webp" });
      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size > 0) upload = new File([blob], "proof.webp", { type: blob.type || "image/webp" });
    } catch { /* fall back to the original file */ }
    const form = new FormData();
    form.append("file", upload);
    form.append("phone", phone);
    if (planId) form.append("plan_id", planId);
    const res = await fetch(`/api/c/${token}/proof`, { method: "POST", body: form });
    if (res.ok) {
      const { url } = await res.json();
      setProofUrls((p) => [...p, url]);
      setPayNudge((n) => n + 1);
      setPaidReported(true);
    } else {
      flashToast(t("genericErr"));
    }
    setProofUploading(false);
  }

  async function chooseQuote(optionId: string) {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "choose_quote", phone, option_id: optionId }),
    });
    if (res.ok) setChosenQuote(optionId);
    else flashToast(t("genericErr"));
  }

  async function submitBrief() {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "brief", phone, brief }),
    });
    if (res.ok) {
      setBriefSent(true);
      setTimeout(() => setBriefSent(false), 3000);
    }
  }

  async function saveMessenger() {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_messenger", phone, link: messenger.trim() }),
    });
    if (res.ok) {
      setMsgrSaved(true);
      setTimeout(() => setMsgrSaved(false), 3000);
    }
  }

  async function sendReview() {
    if (!rating && !reviewText.trim()) return;
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", phone, rating, message: reviewText.trim() }),
    });
    if (res.ok) {
      setReviewSent(true);
      setReviewText("");
    }
  }

  async function sign() {
    if (!signName.trim()) {
      setErr(t("needName"));
      return;
    }
    setSigning(true);
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", phone, name: signName.trim(), signature }),
    });
    setSigning(false);
    if (res.ok) await fetchContract(phone);
    else setErr(t("genericErr"));
  }

  // Tiền về (SePay tự ghi thu, hoặc studio ghi tay) khi khách đang mở trang →
  // tải lại hợp đồng và chuyển sang màn "Đã nhận cọc".
  const knownPayIds = useMemo(() => payments.map((p) => p.id), [payments]);
  usePaymentWatch({
    token,
    phone,
    active:
      !demo &&
      !!contract &&
      contract.status !== "cancelled" &&
      (plan.some((p) => !p.paid) || contractTotal(items) > sumAmounts(payments)),
    knownIds: knownPayIds,
    nudge: payNudge,
    onPaid: async (e) => {
      await fetchContract(phone).catch(() => undefined);
      setQrOpenRaw(false);
      setPaidNow(e);
    },
  });

  /* ── Số liệu tính sẵn (chỉ có nghĩa khi đã mở khoá hợp đồng) ── */
  const itemsTotal = contractTotal(items);
  const surcharge = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const printing = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.qty) || 1), 0);
  const total = itemsTotal + surcharge + printing;
  const collected = sumAmounts(payments);
  const balance = total - collected;
  const signed = !!contract?.client_signed_at;
  // Khoản cần chuyển tiếp theo: đợt chưa thu sớm nhất, không có thì là phần
  // còn lại của hợp đồng. Phần trăm tính từ chính số tiền đó, không viết tay.
  const nextDue = plan.find((p) => !p.paid) ?? null;
  const dueAmount = nextDue ? nextDue.amount : balance;
  const duePct = total > 0 ? Math.round((dueAmount / total) * 100) : 0;
  // Có đợt kế tiếp → nội dung mang MÃ ĐỢT, để studio bật SePay là tiền về tự
  // ghi đúng đợt. Không còn đợt nào thì như cũ: mã hợp đồng.
  const contractRef = (contract?.code || contract?.title || "").slice(0, 25);
  const dueNote = nextDue ? instalmentNote(contractRef, nextDue.label, nextDue.pay_code) : contractRef;
  const dueQr = qrUrl(bank, dueAmount, dueNote);
  const unpaidPlan = plan.filter((p) => !p.paid);
  // Điều khoản: mỗi dòng một ý, để hiện thành danh sách có dấu tích như thiết kế.
  const termLines = (contract?.note || "")
    .split("\n")
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

  return {
    token,
    phone, setPhone,
    contract,
    studioName, studioLogo, studioPhone,
    items, payments, milestones, gallery, selection, wedding, story,
    quoteOptions, chosenQuote,
    plan, expenses, tasks, products, addenda, loyalty, bank,
    paidReported, proofUploading, proofUrls,
    selectedPlanId, setSelectedPlanId,
    qrOpen, setQrOpen,
    paidNow, setPaidNow,
    qr,
    lang, setLang, t,
    loading, err, setErr,
    editMsg, setEditMsg, sending, sent,
    toast, flashToast,
    signName, setSignName, signature, setSignature, signing,
    messenger, setMessenger, msgrSaved,
    rating, setRating, reviewText, setReviewText, reviewSent,
    brief, setBrief, briefSent,
    fetchContract, unlock, sendEdit, reportPaid, uploadProof, chooseQuote, submitBrief, saveMessenger, sendReview, sign,
    itemsTotal, surcharge, printing, total, collected, balance, signed,
    nextDue, dueAmount, duePct, contractRef, dueNote, dueQr, unpaidPlan, termLines,
  };
}

export type ContractPortal = ReturnType<typeof useContractPortal>;
