"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtDate, fmtDateLunar } from "@/lib/date";
import { Lock, MapPin, Calendar, Send, Check, Printer, PenLine, Images, ImagePlus, Star, ListChecks, Package, Upload, Heart } from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import CalendarButtons from "@/components/CalendarButtons";
import VietQRButton, { VietQR, qrUrl, instalmentNote, type BankInfo } from "@/components/VietQR";
import { thiepUrl } from "@/lib/hosts";
import { contractPrintBody, contractPrintCss, type ContractPrintData } from "@/lib/contract-print";
import { compressImage, checkImageFile } from "@/lib/image";
import {
  contractTotal,
  vnd,
  sumAmounts,
  SHOOT_TYPE_LABEL,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUS_TONE,
  PRODUCT_STATUS_LABEL,
  PAYMENT_KIND_LABEL,
  type ShootType,
  type ContractStatus,
  type PaymentKind,
} from "@/lib/types";

type Contract = {
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
type Item = { id: string; name: string; qty: number; unit_price: number };
type Payment = { id: string; amount: number; kind: PaymentKind; paid_at: string };
type Milestone = { id: string; title: string; event_date: string; event_time: string | null; note: string | null };
type QuoteOption = { id: string; name: string; price: number; description: string | null };
type PlanRow = { id: string; label: string; amount: number; due_date: string | null; paid: boolean; paid_at: string | null };
type ExpenseRow = { id: string; title: string; amount: number; category: string | null; spent_at: string };
type TaskRow = { id: string; label: string; done: boolean };
type ProductRow = { id: string; name: string; qty: number; cost: number; status: string };
type Gallery = { slug: string; title: string };
type Selection = { slug: string; title: string; phase?: string };

type Lang = "vi" | "en";
const TR = {
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

export default function ContractView({ token }: { token: string }) {
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
  const [wedding, setWedding] = useState<{ slug: string; edit_token: string; published: boolean } | null>(null);
  const [story, setStory] = useState<{ slug: string; edit_token: string; published: boolean } | null>(null);
  const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([]);
  const [chosenQuote, setChosenQuote] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [bank, setBank] = useState<BankInfo>({ bin: null, account: null, holder: null, name: null });
  const [paidReported, setPaidReported] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrls, setProofUrls] = useState<string[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState("");
  const [lang, setLang] = useState<Lang>("vi");
  const t = (k: keyof typeof TR.vi) => TR[lang][k];
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editMsg, setEditMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

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
    const j = await res.json();
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
    if (j.bank) setBank(j.bank as BankInfo);
    setMessenger(j.contract?.client_messenger ?? "");
    setBrief({
      concept: j.contract?.brief_concept ?? "",
      outfit: j.contract?.brief_outfit ?? "",
      refs: j.contract?.brief_refs ?? "",
      note: j.contract?.brief_note ?? "",
    });
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
      alert(t("genericErr"));
    }
  }

  async function reportPaid() {
    const res = await fetch(`/api/c/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid", phone }),
    });
    if (res.ok) setPaidReported(true);
    else alert(t("genericErr"));
  }

  async function uploadProof(file: File, planId?: string) {
    const check = checkImageFile(file);
    if (!check.ok) { alert(check.error); return; }
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
      setPaidReported(true);
    } else {
      alert(t("genericErr"));
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
    else alert(t("genericErr"));
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

  /* ── Khối dùng lại của trang khách (bản thiết kế "Hợp đồng gửi khách") ──
     Thẻ bo 14–16px, chỉ có viền, không đổ bóng; nhãn viết hoa 10.5px/800. */
  const sectionCls = "overflow-hidden rounded-[14px]";
  const sectionStyle = { background: "var(--sf)", border: "1px solid var(--bd)" } as const;
  const headCls = "px-5 py-4 text-[10.5px] font-extrabold uppercase";
  const headStyle = { letterSpacing: ".7px", color: "var(--tx3)", borderBottom: "1px solid var(--bd2)" } as const;

  if (!contract) {
    return (
      <div className="client-doc flex min-h-screen items-center justify-center px-5 py-10">
        <form onSubmit={unlock} className="w-full max-w-[400px] rounded-[16px] px-7 py-8 text-center" style={sectionStyle}>
          <div className="mb-1 flex justify-end">
            <button type="button" onClick={() => setLang(lang === "vi" ? "en" : "vi")} className="text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </div>
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
            <Lock size={21} />
          </span>
          <h1 className="mt-3.5 text-[21px] font-bold" style={{ letterSpacing: "-.5px" }}>{t("portalTitle")}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "var(--tx2)" }}>{t("gatePrompt")}</p>
          <input
            className="mt-5 w-full rounded-[11px] px-3.5 py-3 text-center text-[15px] font-semibold tracking-wide"
            style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
            inputMode="numeric"
            placeholder={t("phone")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {err && (
            <p className="mt-3 rounded-[10px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--rdS)", color: "var(--rd)" }}>{err}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-3.5 w-full rounded-[11px] py-3 text-[14px] font-bold disabled:opacity-60"
            style={{ background: "var(--ac)", color: "#fff" }}
          >
            {loading ? t("opening") : t("view")}
          </button>
        </form>
      </div>
    );
  }

  const itemsTotal = contractTotal(items);
  const surcharge = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const printing = products.reduce((s, p) => s + (Number(p.cost) || 0) * (Number(p.qty) || 1), 0);
  const total = itemsTotal + surcharge + printing;
  const collected = sumAmounts(payments);
  const balance = total - collected;
  const signed = !!contract.client_signed_at;
  const st = CONTRACT_STATUS_TONE[contract.status];
  // Khoản cần chuyển tiếp theo: đợt chưa thu sớm nhất, không có thì là phần
  // còn lại của hợp đồng. Phần trăm tính từ chính số tiền đó, không viết tay.
  const nextDue = plan.find((p) => !p.paid) ?? null;
  const dueAmount = nextDue ? nextDue.amount : balance;
  const duePct = total > 0 ? Math.round((dueAmount / total) * 100) : 0;
  const dueQr = qrUrl(bank, dueAmount, (contract.code || contract.title || "").slice(0, 25));
  const unpaidPlan = plan.filter((p) => !p.paid);
  // Điều khoản: mỗi dòng một ý, để hiện thành danh sách có dấu tích như thiết kế.
  const termLines = (contract.note || "")
    .split("\n")
    .map((s) => s.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

  return (
    <>
      {/* Bản trên màn hình (ẩn khi in) */}
      <div className="client-doc no-print min-h-screen">
        <div className="mx-auto flex max-w-[720px] flex-col gap-3.5 px-4 py-6 sm:px-5 sm:py-9">

          {/* Điều khiển phụ — không thuộc văn bản nên đứng ngoài, canh phải. */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setLang(lang === "vi" ? "en" : "vi")} className="flex-none text-[11.5px] font-bold" style={{ color: "var(--tx3)" }}>
              {lang === "vi" ? "EN" : "VI"}
            </button>
            <button
              onClick={() => window.print()}
              className="flex flex-none items-center gap-1.5 rounded-[9px] px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
            >
              <Printer size={14} /> {t("pdf")}
            </button>
          </div>

          {/* Đường dẫn sang TRANG RIÊNG của khách (cùng token, cùng mật khẩu là
              SĐT): bản hợp đồng này là văn bản để đọc và ký, còn trang kia là nơi
              theo dõi lịch trình, các đợt thanh toán và sản phẩm — và biến thành
              trang album khi hợp đồng hoàn thành. */}
          <Link
            href={`/portal/${token}`}
            className="flex items-center gap-3 rounded-[14px] px-4 py-3.5"
            style={{ background: "var(--acS)", border: "1px solid var(--acM)" }}
          >
            <span className="flex-none rounded-[10px] p-2" style={{ background: "var(--sf)", lineHeight: 0 }}>
              <ListChecks size={17} style={{ color: "var(--ac)" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold">
                {lang === "vi" ? "Trang theo dõi của bạn" : "Your tracking page"}
              </span>
              <span className="block text-[11.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                {lang === "vi"
                  ? "Lịch trình hẹn, tiến độ thanh toán, sản phẩm và album ảnh"
                  : "Appointments, payment progress, products and your photo album"}
              </span>
            </span>
            <span className="flex-none text-[12.5px] font-bold" style={{ color: "var(--ac)" }}>
              {lang === "vi" ? "Mở →" : "Open →"}
            </span>
          </Link>

          {/* ══ Thẻ hợp đồng ═══════════════════════════════════════════════ */}
          <div className={sectionCls} style={sectionStyle}>

            {/* Đầu văn bản — thương hiệu studio canh giữa ngay trên nhãn văn
                bản, đúng đầu trang của bản thiết kế. */}
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
                {lang === "vi" ? "Hợp đồng dịch vụ chụp ảnh" : "Photography service contract"}
              </p>
              <h1 className="mt-1.5 text-[24px] font-bold sm:text-[27px]" style={{ letterSpacing: "-.6px", textWrap: "pretty" }}>{contract.title}</h1>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {contract.code && (
                  <span className="text-[12px]" style={{ color: "var(--tx3)", fontFamily: "ui-monospace, monospace" }}>{contract.code}</span>
                )}
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[11px] font-bold"
                  style={{ background: st.bg, color: st.fg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.fg }} />
                  {CONTRACT_STATUS_LABEL[contract.status]}
                </span>
              </div>
            </div>

            {/* Thông tin hai bên & buổi chụp */}
            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Bên A · Studio" : "Party A · Studio"}</p>
                <p className="mt-1 text-[14px] font-semibold">{studioName}</p>
                {studioPhone && <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>{studioPhone}</p>}
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Bên B · Khách hàng" : "Party B · Client"}</p>
                <p className="mt-1 text-[14px] font-semibold">{contract.client_name || "—"}</p>
                <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>
                  {[contract.client_phone, contract.client_email].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Ngày chụp" : "Shoot date"}</p>
                <p className="mt-1 text-[14px] font-semibold">{contract.event_date ? fmtDateLunar(contract.event_date) : "—"}</p>
                <p className="mt-px text-[12px]" style={{ color: "var(--tx3)" }}>
                  {contract.event_time || SHOOT_TYPE_LABEL[contract.shoot_type]}
                </p>
              </div>
              <div>
                <p className="eyebrow">{lang === "vi" ? "Gói dịch vụ" : "Service"}</p>
                <p className="mt-1 text-[14px] font-semibold">{SHOOT_TYPE_LABEL[contract.shoot_type]}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="eyebrow">{lang === "vi" ? "Địa điểm" : "Location"}</p>
                <p className="mt-1 flex items-start gap-1.5 text-[14px] font-semibold">
                  <MapPin size={15} style={{ flex: "none", marginTop: 3, color: "var(--tx3)" }} />
                  {contract.location || "—"}
                </p>
                {contract.event_date && (
                  <div className="mt-2">
                    <CalendarButtons compact event={{ date: contract.event_date, time: contract.event_time, title: contract.title, location: contract.location }} />
                  </div>
                )}
              </div>
            </div>

            {/* Nội dung dịch vụ */}
            <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
              <p className="eyebrow mb-2.5">{t("items")}</p>
              {items.length === 0 ? (
                <p className="text-[13px]" style={{ color: "var(--tx3)" }}>{t("noItems")}</p>
              ) : (
                items.map((it) => {
                  const isDiscount = it.unit_price < 0;
                  return (
                    <div key={it.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold">{it.name}</p>
                        {!isDiscount && it.qty > 1 && (
                          <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)" }}>
                            {it.qty} × {vnd(it.unit_price)}
                          </p>
                        )}
                      </div>
                      <span
                        className="flex-none whitespace-nowrap text-[13px] font-bold"
                        style={{ color: isDiscount ? "var(--am)" : "var(--tx)" }}
                      >
                        {isDiscount ? `− ${vnd(Math.abs(it.qty * it.unit_price))}` : vnd(it.qty * it.unit_price)}
                      </span>
                    </div>
                  );
                })
              )}

              {surcharge > 0 && (
                <div className="flex justify-between py-1.5 pt-3 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>{lang === "vi" ? "Chi phí phát sinh" : "Surcharges"}</span>
                  <strong>{vnd(surcharge)}</strong>
                </div>
              )}
              {printing > 0 && (
                <div className="flex justify-between py-1.5 text-[12.5px]">
                  <span style={{ color: "var(--tx2)" }}>{lang === "vi" ? "Chi phí in ấn" : "Printing"}</span>
                  <strong>{vnd(printing)}</strong>
                </div>
              )}

              <div className="flex items-baseline justify-between pt-3.5">
                <span className="text-[13.5px] font-bold">{lang === "vi" ? "Tổng cộng" : "Total"}</span>
                <span className="text-[22px] font-bold" style={{ letterSpacing: "-.6px", color: "var(--ac)" }}>{vnd(total)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px]">
                <span>
                  <span style={{ color: "var(--tx2)" }}>{t("paid")}: </span>
                  <b style={{ color: "var(--gn)" }}>{vnd(collected)}</b>
                </span>
                <span>
                  <span style={{ color: "var(--tx2)" }}>{t("remaining")}: </span>
                  <b style={{ color: balance > 0 ? "var(--am)" : "var(--gn)" }}>{vnd(balance)}</b>
                </span>
              </div>
            </div>

            {/* Cọc / chuyển khoản */}
            {balance > 0 && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                {/* Mã QR 96px bên trái, số tiền và hướng dẫn bên phải — đúng
                    khối "Cọc giữ lịch" của bản thiết kế. Bấm vào mã để phóng to
                    kèm nút chép số tài khoản / nội dung chuyển khoản. */}
                <div className="flex items-center gap-4 sm:gap-[18px]">
                  <div className="flex-none">
                    {dueQr ? (
                      <button onClick={() => setQrOpen(true)} aria-label={lang === "vi" ? "Phóng to mã QR" : "Enlarge QR"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={dueQr}
                          alt="VietQR"
                          width={96}
                          height={96}
                          className="h-24 w-24 rounded-[10px] bg-white object-contain"
                          style={{ border: "1px solid var(--bd)" }}
                        />
                      </button>
                    ) : (
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-[10px] p-2 text-center text-[10.5px] leading-tight"
                        style={{ border: "1px dashed var(--bd)", color: "var(--tx3)" }}
                      >
                        {lang === "vi" ? "Liên hệ studio để nhận số tài khoản" : "Ask the studio for details"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">
                      {nextDue ? nextDue.label : lang === "vi" ? "Còn phải thanh toán" : "Amount due"}
                      {duePct > 0 ? ` (${duePct}%)` : ""}
                    </p>
                    <p className="mt-1 text-[20px] font-bold" style={{ letterSpacing: "-.5px" }}>{vnd(dueAmount)}</p>
                    <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--tx2)" }}>
                      {lang === "vi"
                        ? `Quét mã để chuyển khoản.${dueAmount < balance ? ` Còn lại ${vnd(balance - dueAmount)} thanh toán ở các đợt sau.` : ""}`
                        : `Scan to transfer.${dueAmount < balance ? ` ${vnd(balance - dueAmount)} remains for later instalments.` : ""}`}
                    </p>
                    {nextDue?.due_date && (
                      <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--am)" }}>
                        {lang === "vi" ? "Hạn" : "Due"}: {fmtDate(nextDue.due_date)}
                      </p>
                    )}
                    {bank.account && (
                      <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {[bank.name, bank.account, bank.holder].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Phóng to mã QR — chỗ duy nhất cần nút chép số tài khoản. */}
                {qrOpen && (
                  <div
                    className="fixed inset-0 z-[80] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,.55)" }}
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.target === e.currentTarget && setQrOpen(false)}
                  >
                    <div className="w-full max-w-[320px] rounded-[16px] p-6" style={{ background: "var(--sf)", border: "1px solid var(--bd)" }}>
                      <VietQR bank={bank} amount={dueAmount} addInfo={(contract.code || contract.title || "").slice(0, 25)} />
                      <button
                        onClick={() => setQrOpen(false)}
                        className="mt-4 w-full rounded-[10px] py-2.5 text-[12.5px] font-semibold"
                        style={{ border: "1px solid var(--bd)" }}
                      >
                        {lang === "vi" ? "Đóng" : "Close"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Kế hoạch thanh toán */}
                {plan.length > 0 && (
                  <div className="mt-4">
                    <p className="eyebrow mb-2">{lang === "vi" ? "Kế hoạch thanh toán" : "Payment schedule"}</p>
                    {plan.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: "1px solid var(--bd2)" }}>
                        {p.paid
                          ? <Check size={16} style={{ flex: "none", color: "var(--gn)" }} />
                          : <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: "var(--am)" }} />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{p.label}</p>
                          <p className="text-[11.5px]" style={{ color: p.paid ? "var(--gn)" : "var(--tx3)" }}>
                            {p.paid
                              ? `${lang === "vi" ? "Đã thanh toán" : "Paid"}${p.paid_at ? ` · ${fmtDate(p.paid_at)}` : ""}`
                              : p.due_date
                                ? `${lang === "vi" ? "Hạn" : "Due"} ${fmtDate(p.due_date)}`
                                : lang === "vi" ? "Chưa thanh toán" : "Pending"}
                          </p>
                        </div>
                        <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(p.amount)}</span>
                        {!p.paid && bank.bin && (
                          <VietQRButton bank={bank} amount={p.amount} addInfo={instalmentNote((contract.code || contract.title || "").slice(0, 25), p.label)} label="QR" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Gửi ảnh chuyển khoản */}
                <div className="mt-4">
                  <p className="eyebrow mb-2">{lang === "vi" ? "Đã chuyển khoản? Gửi ảnh cho studio" : "Transferred? Send the receipt"}</p>
                  {proofUrls.length > 0 && (
                    <div className="mb-2.5 flex flex-wrap gap-2">
                      {proofUrls.map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt="proof" className="h-16 w-16 rounded-[10px] object-cover" style={{ border: "1px solid var(--bd)" }} />
                        </a>
                      ))}
                    </div>
                  )}
                  {unpaidPlan.length > 0 && (
                    <select
                      className="mb-2 w-full rounded-[10px] px-3 py-2.5 text-[13px]"
                      style={{ border: "1px solid var(--bd)", background: "var(--sf2)", color: "var(--tx)" }}
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                    >
                      <option value="">{lang === "vi" ? "— Chọn đợt thanh toán —" : "— Select instalment —"}</option>
                      {unpaidPlan.map((p) => (
                        <option key={p.id} value={p.id}>{p.label} · {vnd(p.amount)}</option>
                      ))}
                    </select>
                  )}
                  <label
                    className="relative block w-full cursor-pointer rounded-[12px] py-7 text-center"
                    style={{
                      border: `1.5px dashed ${proofUploading ? "var(--ac)" : "var(--bd)"}`,
                      background: proofUploading ? "var(--acS)" : "var(--sf2)",
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--ac)"; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = "";
                      const fl = e.dataTransfer.files?.[0];
                      if (fl && fl.type.startsWith("image/")) uploadProof(fl, selectedPlanId || undefined);
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      disabled={proofUploading}
                      onChange={(e) => { const fl = e.target.files?.[0]; if (fl) uploadProof(fl, selectedPlanId || undefined); e.target.value = ""; }}
                    />
                    <Upload size={20} className="mx-auto mb-1.5" style={{ color: proofUploading ? "var(--ac)" : "var(--tx3)" }} />
                    <p className="text-[13px] font-semibold" style={{ color: proofUploading ? "var(--ac)" : "var(--tx2)" }}>
                      {proofUploading
                        ? (lang === "vi" ? "Đang tải lên…" : "Uploading…")
                        : (lang === "vi" ? "Kéo ảnh vào đây hoặc bấm để chọn" : "Drag a photo here or tap to select")}
                    </p>
                    {!proofUploading && (
                      <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {lang === "vi" ? "Ảnh chuyển khoản · tối đa 10MB" : "Bank transfer screenshot · max 10MB"}
                      </p>
                    )}
                  </label>
                  {paidReported ? (
                    <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--gn)" }}>
                      <Check size={15} /> {lang === "vi" ? "Đã thông báo, studio sẽ đối soát." : "Notified — the studio will reconcile."}
                    </p>
                  ) : (
                    <button
                      onClick={reportPaid}
                      className="mt-2 w-full rounded-[10px] py-2.5 text-[12.5px] font-semibold"
                      style={{ border: "1px solid var(--bd)" }}
                    >
                      {lang === "vi" ? "Tôi đã chuyển khoản (không có ảnh)" : "I have transferred (no screenshot)"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Điều khoản chính */}
            {termLines.length > 0 && (
              <div className="px-5 py-5 sm:px-7" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <p className="eyebrow mb-2.5">{t("terms")}</p>
                {termLines.slice(0, 6).map((line, i) => (
                  <div key={i} className="flex gap-2.5 py-1">
                    <Check size={15} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{line}</span>
                  </div>
                ))}
                {termLines.length > 6 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer list-none text-[11.5px] font-bold" style={{ color: "var(--ac)" }}>
                      {lang === "vi" ? `Xem đầy đủ ${termLines.length} điều khoản` : `Read all ${termLines.length} terms`}
                    </summary>
                    <div className="mt-2">
                      {termLines.slice(6).map((line, i) => (
                        <div key={i} className="flex gap-2.5 py-1">
                          <Check size={15} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                          <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{line}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Ký hợp đồng */}
            <div className="px-5 py-6 sm:px-7" style={{ background: "var(--sf2)" }}>
              <p className="eyebrow mb-2">{lang === "vi" ? "Bên A · Studio" : "Party A · Studio"}</p>
              <div className="mb-4 flex items-center gap-3">
                {contract.studio_signature ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contract.studio_signature} alt="Chữ ký của studio" className="h-12 rounded bg-white p-1" />
                ) : (
                  <span className="text-[12px]" style={{ color: "var(--tx3)" }}>{lang === "vi" ? "Studio chưa ký" : "Not signed yet"}</span>
                )}
                <span className="text-[13px] font-semibold">{contract.studio_signed_name || studioName}</span>
              </div>

              <p className="eyebrow mb-2">{lang === "vi" ? "Bên B · Khách hàng" : "Party B · Client"}</p>
              {signed ? (
                <div>
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                    <Check size={16} /> {t("signedOn")} {new Date(contract.client_signed_at!).toLocaleString("vi-VN")}
                  </p>
                  {contract.client_signature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contract.client_signature} alt="Chữ ký" className="mt-2.5 h-16 rounded bg-white p-1" />
                  )}
                </div>
              ) : (
                <>
                  <p className="mb-3 text-center text-[12.5px] leading-relaxed" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
                    {t("signAgree")}
                  </p>
                  <input
                    className="w-full rounded-[11px] px-3.5 py-3 text-[13.5px]"
                    style={{ border: "1px solid var(--bd)", background: "var(--sf)", color: "var(--tx)" }}
                    placeholder={t("signerName")}
                    value={signName}
                    onChange={(e) => setSignName(e.target.value)}
                  />
                  <div className="mt-3">
                    <p className="eyebrow mb-1.5">{t("signature")}</p>
                    <SignaturePad onChange={setSignature} />
                  </div>
                  {err && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: "var(--rd)" }}>{err}</p>}
                  <button
                    onClick={sign}
                    disabled={signing}
                    className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[12px] py-3.5 text-[14.5px] font-bold disabled:opacity-60"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <PenLine size={19} /> {signing ? t("signing") : t("sign")}
                  </button>
                </>
              )}
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 rounded-[11px] py-2.5 text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                >
                  {t("pdf")}
                </button>
                <a
                  href={studioPhone ? `tel:${studioPhone}` : "#edit-request"}
                  className="flex-1 rounded-[11px] py-2.5 text-center text-[12.5px] font-semibold"
                  style={{ border: "1px solid var(--bd)", background: "var(--sf)" }}
                >
                  {lang === "vi" ? "Hỏi studio" : "Ask the studio"}
                </a>
              </div>
            </div>
          </div>

          {/* ══ Khối phụ ═══════════════════════════════════════════════════ */}

          {/* Chọn gói dịch vụ */}
          {quoteOptions.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{t("quoteTitle")}</p>
              <div className="grid gap-2.5 px-5 py-4 sm:grid-cols-2">
                {quoteOptions.map((o) => {
                  const isChosen = chosenQuote === o.id;
                  return (
                    <div
                      key={o.id}
                      className="rounded-[12px] p-4"
                      style={{ background: isChosen ? "var(--acS)" : "var(--sf2)", border: `1px solid ${isChosen ? "var(--ac)" : "var(--bd)"}` }}
                    >
                      <p className="text-[14px] font-bold">{o.name}</p>
                      <p className="mt-0.5 text-[18px] font-bold" style={{ color: "var(--ac)", letterSpacing: "-.4px" }}>{vnd(o.price)}</p>
                      {o.description && <p className="mt-1.5 whitespace-pre-wrap text-[12px]" style={{ color: "var(--tx2)" }}>{o.description}</p>}
                      <button
                        onClick={() => chooseQuote(o.id)}
                        disabled={isChosen}
                        className="mt-3 w-full rounded-[10px] py-2.5 text-[12.5px] font-bold"
                        style={isChosen
                          ? { border: "1px solid var(--ac)", color: "var(--ac)" }
                          : { background: "var(--ac)", color: "#fff" }}
                      >
                        {isChosen ? `✓ ${t("chosen")}` : t("choose")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lịch trình */}
          {(contract.event_date || milestones.length > 0) && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{lang === "vi" ? "Lịch trình chi tiết" : "Schedule"}</p>
              <div className="px-5 py-2">
                {contract.event_date && (
                  <div className="flex flex-wrap items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Calendar size={16} style={{ flex: "none", marginTop: 2, color: "var(--ac)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{lang === "vi" ? "Buổi chính" : "Main session"}{contract.title ? ` — ${contract.title}` : ""}</p>
                      {contract.location && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{contract.location}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx2)" }}>
                      {fmtDateLunar(contract.event_date)}{contract.event_time ? ` · ${contract.event_time}` : ""}
                    </span>
                    <CalendarButtons compact event={{ date: contract.event_date, time: contract.event_time, title: contract.title, location: contract.location }} />
                  </div>
                )}
                {milestones.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-start gap-3 py-3" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Calendar size={16} style={{ flex: "none", marginTop: 2, color: "var(--tx3)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{m.title}</p>
                      {m.note && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{m.note}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[12.5px]" style={{ color: "var(--tx2)" }}>
                      {fmtDateLunar(m.event_date)}{m.event_time ? ` · ${m.event_time}` : ""}
                    </span>
                    <CalendarButtons compact event={{ date: m.event_date, time: m.event_time, title: m.title, location: contract.location }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Album chọn ảnh / album giao */}
          {selection && (
            <a href={`/a/${selection.slug}`} target="_blank" rel="noreferrer" className={`${sectionCls} flex items-center gap-3 px-5 py-4`} style={sectionStyle}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                {selection.phase === "delivery" ? <Images size={20} /> : <ImagePlus size={20} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{selection.phase === "delivery" ? t("viewPhotos") : t("pickPhotos")}</p>
                <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>
                  {selection.title} · {selection.phase === "delivery" ? t("viewPhotosSub") : t("pickPhotosSub")}
                </p>
              </div>
              <span className="flex-none text-[13px] font-bold" style={{ color: "var(--ac)" }}>{t("open")}</span>
            </a>
          )}

          {gallery && (
            <a href={`/album/${gallery.slug}`} target="_blank" rel="noreferrer" className={`${sectionCls} flex items-center gap-3 px-5 py-4`} style={sectionStyle}>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                <Images size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold">{t("viewPhotos")}</p>
                <p className="mt-px truncate text-[11.5px]" style={{ color: "var(--tx3)" }}>{gallery.title} · {t("viewPhotosSub")}</p>
              </div>
              <span className="flex-none text-[13px] font-bold" style={{ color: "var(--ac)" }}>{t("open")}</span>
            </a>
          )}

          {/* Quà tặng: thiệp cưới & love story */}
          {wedding && (
            <div className={`${sectionCls} px-5 py-4`} style={sectionStyle}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
                  <Heart size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">🎁 Thiệp cưới online tặng bạn</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Studio tặng bạn một thiệp cưới online — bạn tự điền thông tin, chọn ảnh &amp; chia sẻ cho khách mời.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={thiepUrl(`/sua/${wedding.edit_token}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                  <PenLine size={15} /> Chỉnh sửa thiệp của tôi
                </a>
                {wedding.published && (
                  <a href={thiepUrl(`/${wedding.slug}`)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                    <Images size={15} /> Xem thiệp
                  </a>
                )}
              </div>
            </div>
          )}

          {story && (
            <div className={`${sectionCls} px-5 py-4`} style={sectionStyle}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--rdS)", color: "var(--rd)" }}>
                  <Heart size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold">💞 Trang Love Story tặng bạn</p>
                  <p className="mt-px text-[11.5px]" style={{ color: "var(--tx3)", textWrap: "pretty" }}>
                    Trang chia sẻ khoảnh khắc — bạn điền nội dung &amp; dán link folder ảnh/video Google Drive của mình.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/story/sua/${story.edit_token}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold" style={{ background: "var(--ac)", color: "#fff" }}>
                  <PenLine size={15} /> Chỉnh sửa trang của tôi
                </a>
                {story.published && (
                  <a href={`/story/${story.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                    <Images size={15} /> Xem trang
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tiến độ công việc */}
          {tasks.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--bd2)" }}>
                <ListChecks size={17} style={{ color: "var(--ac)" }} />
                <p className="text-[14px] font-bold">{lang === "vi" ? "Tiến độ công việc" : "Progress"}</p>
                <span className="ml-auto rounded-[20px] px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--acS)", color: "var(--ac)" }}>
                  {tasks.filter((x) => x.done).length}/{tasks.length}
                </span>
              </div>
              <div className="px-5 py-3">
                {tasks.map((tk) => (
                  <div key={tk.id} className="flex items-center gap-2.5 py-1.5">
                    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px]" style={{ border: "1px solid var(--bd)", background: tk.done ? "var(--gn)" : "transparent" }}>
                      {tk.done && <Check size={13} color="#fff" />}
                    </span>
                    <span className="text-[13px]" style={{ color: tk.done ? "var(--tx3)" : "var(--tx)", textDecoration: tk.done ? "line-through" : "none" }}>
                      {tk.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sản phẩm đính kèm */}
          {products.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{lang === "vi" ? "Sản phẩm đính kèm" : "Products"}</p>
              <div className="px-5 py-2">
                {products.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <Package size={16} style={{ flex: "none", color: "var(--tx3)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{p.name}{p.qty > 1 ? ` ×${p.qty}` : ""}</p>
                      <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>
                        {PRODUCT_STATUS_LABEL[p.status as keyof typeof PRODUCT_STATUS_LABEL] || p.status}
                      </p>
                    </div>
                    {p.cost > 0 && <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(p.cost * (p.qty || 1))}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chi phí phát sinh */}
          {expenses.length > 0 && (
            <div className={sectionCls} style={sectionStyle}>
              <p className={headCls} style={headStyle}>{lang === "vi" ? "Chi phí phát sinh" : "Extra costs"}</p>
              <div className="px-5 py-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bd2)" }}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{e.title}</p>
                      {e.spent_at && <p className="text-[11.5px]" style={{ color: "var(--tx3)" }}>{fmtDate(e.spent_at)}</p>}
                    </div>
                    <span className="flex-none whitespace-nowrap text-[13px] font-bold">{vnd(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brief buổi chụp */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("briefTitle")}</p>
            <div className="px-5 py-4">
              <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("briefPrompt")}</p>
              <div className="space-y-2.5">
                <input className="input w-full" placeholder={t("briefConcept")} value={brief.concept} onChange={(e) => setBrief((p) => ({ ...p, concept: e.target.value }))} />
                <input className="input w-full" placeholder={t("briefOutfit")} value={brief.outfit} onChange={(e) => setBrief((p) => ({ ...p, outfit: e.target.value }))} />
                <input className="input w-full" placeholder={t("briefRefs")} value={brief.refs} onChange={(e) => setBrief((p) => ({ ...p, refs: e.target.value }))} />
                <textarea className="input min-h-[70px] w-full" placeholder={t("briefNote")} value={brief.note} onChange={(e) => setBrief((p) => ({ ...p, note: e.target.value }))} />
                <button
                  onClick={submitBrief}
                  className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold"
                  style={{ background: "var(--ac)", color: "#fff" }}
                >
                  {briefSent ? <Check size={15} /> : null} {briefSent ? t("briefSaved") : t("briefSave")}
                </button>
              </div>
            </div>
          </div>

          {/* Đánh giá studio */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("review")}</p>
            <div className="px-5 py-4">
              {reviewSent ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {t("reviewThanks")}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("reviewPrompt")}</p>
                  <div className="mb-3 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRating(n)} aria-label={`${n} sao`}>
                        <Star size={26} style={{ color: n <= rating ? "var(--am)" : "var(--tx3)" }} fill={n <= rating ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <textarea className="input min-h-[80px] w-full" placeholder={t("reviewPh")} value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
                  <button
                    onClick={sendReview}
                    disabled={!rating && !reviewText.trim()}
                    className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Star size={15} /> {t("sendReview")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Link Messenger */}
          <div className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("messenger")}</p>
            <div className="px-5 py-4">
              <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("messengerPrompt")}</p>
              <div className="flex flex-wrap gap-2">
                <input className="input min-w-[200px] flex-1" placeholder="m.me/… hoặc facebook.com/…" value={messenger} onChange={(e) => setMessenger(e.target.value)} />
                <button onClick={saveMessenger} className="flex flex-none items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-semibold" style={{ border: "1px solid var(--bd)" }}>
                  {msgrSaved ? <Check size={15} /> : null} {msgrSaved ? t("saved") : t("saveLink")}
                </button>
              </div>
            </div>
          </div>

          {/* Yêu cầu chỉnh sửa */}
          <div id="edit-request" className={sectionCls} style={sectionStyle}>
            <p className={headCls} style={headStyle}>{t("editReq")}</p>
            <div className="px-5 py-4">
              {sent ? (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--gn)" }}>
                  <Check size={15} /> {t("editSent")}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-[12.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t("editPrompt")}</p>
                  <textarea className="input min-h-[90px] w-full" placeholder={t("editPh")} value={editMsg} onChange={(e) => setEditMsg(e.target.value)} />
                  <button
                    onClick={sendEdit}
                    disabled={sending || !editMsg.trim()}
                    className="mt-3 flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-bold disabled:opacity-50"
                    style={{ background: "var(--ac)", color: "#fff" }}
                  >
                    <Send size={15} /> {sending ? t("sending") : t("send")}
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="pb-2 text-center text-[11.5px]" style={{ color: "var(--tx3)" }}>
            {t("updated")}: {new Date(contract.updated_at).toLocaleString("vi-VN")}
          </p>
        </div>
      </div>

      {/* Print-only formal document (black on white) */}
      <PrintDoc
        contract={contract}
        studioName={studioName}
        studioLogo={studioLogo}
        studioPhone={studioPhone}
        bank={bank}
        items={items}
        products={products}
        payments={payments}
        plan={plan}
        milestones={milestones}
        itemsTotal={itemsTotal}
        surcharge={surcharge}
        printing={printing}
        total={total}
        collected={collected}
        balance={balance}
        qr={qr}
      />
    </>
  );
}

/**
 * Bản in chính thức (đen trắng, khổ A4) — ẩn trên màn hình, chỉ hiện khi in.
 * Dựng bằng bộ dựng dùng chung src/lib/contract-print.ts nên bản khách in ra
 * giống hệt bản studio xuất từ màn quản trị.
 *
 * Vẫn in trong CHÍNH trang này (không mở cửa sổ mới): khách hay bấm từ điện
 * thoại, mà Safari iOS chặn/nuốt cửa sổ pop-up.
 */
function PrintDoc({
  contract,
  studioName,
  studioLogo,
  studioPhone,
  bank,
  items,
  products,
  payments,
  plan,
  milestones,
  itemsTotal,
  surcharge,
  printing,
  total,
  collected,
  balance,
  qr,
}: {
  contract: Contract;
  studioName: string;
  studioLogo: string | null;
  studioPhone: string | null;
  bank: BankInfo;
  items: Item[];
  products: ProductRow[];
  payments: Payment[];
  plan: PlanRow[];
  milestones: Milestone[];
  itemsTotal: number;
  surcharge: number;
  printing: number;
  total: number;
  collected: number;
  balance: number;
  qr: string;
}) {
  // Có phụ phí / in ấn thì mới tách dòng "giá trị dịch vụ"; hợp đồng thường
  // chỉ cần đúng ba dòng tổng — cộng, đã trả, còn lại.
  const extra = surcharge > 0 || printing > 0;
  const data: ContractPrintData = {
    title: contract.title,
    code: contract.code,
    statusLabel: CONTRACT_STATUS_LABEL[contract.status],
    studio: {
      name: studioName,
      logo: studioLogo,
      phone: studioPhone,
      bankHolder: bank.holder,
      bankAccount: bank.account,
      bankName: bank.name,
    },
    client: { name: contract.client_name, phone: contract.client_phone, email: contract.client_email },
    facts: [
      { label: "Gói dịch vụ", value: SHOOT_TYPE_LABEL[contract.shoot_type] },
      { label: "Ngày chụp", value: [fmtDateLunar(contract.event_date), contract.event_time].filter(Boolean).join(" · ") },
      { label: "Địa điểm", value: contract.location, wide: true },
    ],
    items: items.map((it) => ({
      name: it.name,
      qty: it.qty,
      unitPrice: it.unit_price,
      amount: it.qty * it.unit_price,
    })),
    products: products.map((p) => ({
      name: [p.name, PRODUCT_STATUS_LABEL[p.status as keyof typeof PRODUCT_STATUS_LABEL]].filter(Boolean).join(" · "),
      qty: p.qty || 1,
      unitPrice: p.cost,
      amount: (Number(p.cost) || 0) * (Number(p.qty) || 1),
    })),
    totals: [
      ...(extra ? [{ label: "Giá trị dịch vụ", amount: itemsTotal }] : []),
      ...(surcharge > 0 ? [{ label: "Chi phí phát sinh", amount: surcharge }] : []),
      ...(printing > 0 ? [{ label: "Chi phí in ấn", amount: printing }] : []),
      { label: "Tổng giá trị hợp đồng", amount: total, strong: true },
      { label: "Đã thanh toán / cọc", amount: collected, minus: true },
      { label: "Còn lại", amount: balance, bold: true },
    ],
    amountInWords: total,
    plan: plan.map((p) => ({
      label: p.label,
      due: p.due_date ? fmtDate(p.due_date) : "",
      paid: p.paid,
      amount: p.amount,
    })),
    schedule: milestones.map((m) => ({
      title: m.title,
      when: [fmtDateLunar(m.event_date), m.event_time].filter(Boolean).join(" · "),
    })),
    payments: payments.map((p) => ({
      date: fmtDate(p.paid_at),
      kind: PAYMENT_KIND_LABEL[p.kind],
      amount: p.amount,
    })),
    terms: contract.note,
    signs: [
      {
        label: "Bên A · Studio",
        name: contract.studio_signed_name || studioName,
        image: contract.studio_signature,
        signedAt: contract.studio_signed_at ? fmtDate(contract.studio_signed_at) : "",
      },
      {
        label: "Bên B · Khách hàng",
        name: contract.client_signed_name || contract.client_name,
        image: contract.client_signature,
        signedAt: contract.client_signed_at ? fmtDate(contract.client_signed_at) : "",
      },
    ],
    qr,
    footer: "Quét mã QR ở đầu trang để mở bản hợp đồng điện tử.",
  };

  return (
    <div className="print-doc" style={{ display: "none" }}>
      <style dangerouslySetInnerHTML={{ __html: contractPrintCss(".print-doc") }} />
      <div dangerouslySetInnerHTML={{ __html: contractPrintBody(data) }} />
    </div>
  );
}
