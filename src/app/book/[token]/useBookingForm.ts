"use client";

import { useEffect, useState } from "react";
import type { BankInfo } from "@/components/VietQR";
import { digitsOnly } from "@/lib/referral";
import { inferSource, readUtm, type Utm } from "@/lib/lead-source";

/* ═══════════════════════════════════════════════════════════════════════════
   LOGIC DÙNG CHUNG của form đặt lịch /book/<token> — bản cũ (BookingForm) và
   bản giao diện mới (BookingFormV2) gọi CÙNG hook này: ngôn ngữ, nguồn khách
   (utm), gói chọn sẵn từ ?pkg=, người giới thiệu từ ?ref=, voucher, mã chống
   robot (Turnstile), gửi /api/book/<token>, rồi bước cọc giữ ngày (QR + ảnh
   biên lai /api/book/deposit/<mã>). Chỉ phần vẽ là khác.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Lang = "vi" | "en";
const TR = {
  vi: {
    eyebrow: "Đặt lịch chụp",
    subtitle: "Để lại thông tin, studio sẽ liên hệ xác nhận.",
    fullName: "Họ và tên *",
    phone: "Số điện thoại *",
    package: "Chọn gói",
    packageDefault: "— Chưa chọn / tư vấn thêm —",
    packageCustom: "— Gói khác (tự ghi) —",
    packageCustomPh: "Ghi gói bạn muốn (vd: chụp kỷ yếu nhóm 10 người…)",
    service: "Loại dịch vụ",
    servicePh: "VD: chụp cưới, sự kiện…",
    facebook: "Link Facebook (để studio liên hệ)",
    facebookPh: "facebook.com/… (không bắt buộc)",
    date: "Ngày mong muốn",
    note: "Ghi chú",
    submit: "Gửi yêu cầu đặt lịch",
    submitting: "Đang gửi…",
    errRequired: "Vui lòng nhập tên và số điện thoại.",
    errCaptcha: "Vui lòng xác minh bạn không phải robot.",
    errGeneric: "Có lỗi xảy ra, vui lòng thử lại.",
    sentTitle: "Đã gửi yêu cầu!",
    sentBody: "sẽ liên hệ với bạn sớm để xác nhận lịch.",
    referrer: "SĐT người giới thiệu",
    referrerPh: "Nhập SĐT người đã giới thiệu bạn (không bắt buộc)",
    referrerHint: "Nhập SĐT khách cũ đã giới thiệu bạn để nhận ưu đãi",
    depositTitle: "Giữ ngày cho bạn",
    depositBody: "Chuyển cọc để studio giữ ngày này. Chưa chuyển cọc thì ngày vẫn có thể được đặt bởi khách khác.",
    depositContent: "Nội dung chuyển khoản",
    depositProof: "Tôi đã chuyển — gửi ảnh biên lai",
    depositSkip: "Để sau, studio liên hệ rồi tính",
    depositSending: "Đang gửi…",
    depositDoneTitle: "Đã nhận thông tin!",
    depositDoneBody: "sẽ đối chiếu và xác nhận cọc sớm.",
    depositErr: "Không gửi được ảnh, thử lại giúp mình nhé.",
  },
  en: {
    eyebrow: "Book a shoot",
    subtitle: "Leave your details and the studio will confirm your booking.",
    fullName: "Full name *",
    phone: "Phone number *",
    package: "Choose a package",
    packageDefault: "— Not selected / need advice —",
    packageCustom: "— Other (write your own) —",
    packageCustomPh: "Describe the package you want…",
    service: "Service type",
    servicePh: "e.g. wedding, event…",
    facebook: "Facebook link (for studio to contact you)",
    facebookPh: "facebook.com/… (optional)",
    date: "Preferred date",
    note: "Notes",
    submit: "Send booking request",
    submitting: "Sending…",
    errRequired: "Please enter your name and phone number.",
    errCaptcha: "Please verify you are not a robot.",
    errGeneric: "Something went wrong, please try again.",
    sentTitle: "Request sent!",
    sentBody: "will contact you soon to confirm your booking.",
    referrer: "Referrer's phone",
    referrerPh: "Phone of the person who referred you (optional)",
    referrerHint: "Enter the phone of the past client who referred you to get a discount",
    depositTitle: "Hold this date",
    depositBody: "Transfer a deposit so the studio holds this date for you. Until then it may be booked by someone else.",
    depositContent: "Transfer note",
    depositProof: "I've transferred — send receipt photo",
    depositSkip: "Later, let the studio contact me first",
    depositSending: "Sending…",
    depositDoneTitle: "Got it!",
    depositDoneBody: "will verify and confirm your deposit shortly.",
    depositErr: "Could not send the photo, please try again.",
  },
} as const;

export type PkgOption = { name: string; price: number };

export type DepositInfo = { amount: number; code: string; token: string };

/** Voucher ưu đãi khách mang tới (từ QR, ?voucher=…), đã kiểm ở máy chủ. */
export type BookingVoucher = { code: string; label: string; ok: boolean; message?: string; terms?: string[]; needsPhone?: boolean };

export type BookingFormProps = {
  token: string;
  studioName: string;
  packages?: PkgOption[];
  presetPackage?: string;
  /** SĐT người giới thiệu điền sẵn từ link ?ref=… */
  presetReferrer?: string;
  /** Ưu đãi cho khách được giới thiệu (VND) — 0 = studio không có chương trình. */
  referralDiscount?: number;
  /** Tài khoản nhận cọc; null = chưa cấu hình → không hiện bước cọc. */
  bank?: BankInfo | null;
  voucher?: BookingVoucher | null;
};

export function useBookingForm({
  token,
  packages = [],
  presetPackage = "",
  presetReferrer = "",
  bank = null,
  voucher = null,
}: BookingFormProps) {
  const [lang, setLang] = useState<Lang>("vi");
  useEffect(() => {
    const stored = localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "en") setLang("en");
  }, []);
  const tr = TR[lang];

  const [f, setF] = useState({
    name: "", phone: "", service: "", preferred_date: "", note: "", facebook: "",
    referrer_phone: digitsOnly(presetReferrer),
  });
  const [pkg, setPkg] = useState(() => (packages.some((p) => p.name === presetPackage) ? presetPackage : ""));
  const [customPkg, setCustomPkg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  /** SĐT của hợp đồng được tặng voucher — chỉ cần khi người đặt là người khác. */
  const [voucherPhone, setVoucherPhone] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  /* Khách này từ đâu tới. ĐỌC MỘT LẦN lúc trang vừa mở, không đọc lúc bấm gửi:
     khách hay bấm quanh vài trang rồi mới điền, và bước cọc còn thay URL — đọc
     muộn thì utm của link quảng cáo đã trôi mất. Chỉ nhãn kênh + tham số quảng
     cáo, không cookie, không id theo dõi. */
  const [attribution, setAttribution] = useState<{ source: string | null; utm: Utm; landing_path: string }>(
    { source: null, utm: {}, landing_path: "" },
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utm = readUtm(params);
    setAttribution({
      source: inferSource({
        utm,
        referrer: document.referrer,
        ref: params.get("ref"),
        selfHost: window.location.hostname,
      }),
      utm,
      landing_path: window.location.pathname,
    });
  }, []);

  // Bước cọc giữ ngày — chỉ hiện khi máy chủ trả về thông tin cọc.
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofDone, setProofDone] = useState(false);
  const [proofErr, setProofErr] = useState<string | null>(null);

  /** Khách gửi ảnh biên lai (hoặc bỏ qua ảnh, chỉ báo đã chuyển). */
  async function sendProof(file: File | null) {
    if (!deposit) return;
    setProofBusy(true);
    setProofErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      const res = await fetch(`/api/book/deposit/${deposit.token}`, { method: "POST", body: fd });
      if (res.ok) setProofDone(true);
      else setProofErr(tr.depositErr);
    } catch {
      setProofErr(tr.depositErr);
    } finally {
      setProofBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!f.name.trim() || !f.phone.trim()) { setErr(tr.errRequired); return; }
    if (!captchaToken) { setErr(tr.errCaptcha); return; }
    const chosen = packages.find((p) => p.name === pkg);
    const packageName = pkg === "__custom__" ? customPkg.trim() || null : chosen?.name || null;
    const packagePrice = pkg === "__custom__" ? null : chosen?.price ?? null;
    setBusy(true);
    try {
      const res = await fetch(`/api/book/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          package_name: packageName,
          package_price: packagePrice,
          voucher_code: voucher?.ok ? voucher.code : null,
          voucher_phone: voucher?.ok ? voucherPhone : null,
          captcha: captchaToken,
          ...attribution,
        }),
      });
      if (res.status === 400) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (j.error === "voucher_phone") {
          setErr("Số điện thoại xác nhận voucher chưa đúng — nhập SĐT của hợp đồng đã được tặng voucher.");
          return;
        }
      }
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { deposit?: DepositInfo | null };
        // Có cọc VÀ studio đã khai tài khoản nhận tiền thì mới sang bước QR —
        // hiện QR không có số tài khoản chỉ làm khách bối rối rồi bỏ đi.
        if (data.deposit && bank?.bin && bank?.account) setDeposit(data.deposit);
        setSent(true);
      } else setErr(tr.errGeneric);
    } catch {
      // Mạng chập chờn/timeout: hiện lỗi thay vì kẹt nút "Đang gửi…" vĩnh viễn.
      setErr(tr.errGeneric);
    } finally {
      setBusy(false);
    }
  }

  return {
    lang, tr, f, set, pkg, setPkg, customPkg, setCustomPkg, busy, sent, setSent, err, setErr,
    captchaToken, setCaptchaToken, voucherPhone, setVoucherPhone,
    deposit, proofBusy, proofDone, setProofDone, proofErr, sendProof, submit,
  };
}
