"use client";

import { useEffect, useState } from "react";
import DateInput from "@/components/DateInput";
import { CalendarCheck, Check } from "lucide-react";
import { vnd } from "@/lib/types";
import Turnstile from "@/components/Turnstile";
import { VietQR, type BankInfo } from "@/components/VietQR";
import { digitsOnly } from "@/lib/referral";
import { inferSource, readUtm, type Utm } from "@/lib/lead-source";

type Lang = "vi" | "en";
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

export default function BookingForm({
  token,
  studioName,
  packages = [],
  presetPackage = "",
  presetReferrer = "",
  referralDiscount = 0,
  bank = null,
}: {
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
}) {
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
        body: JSON.stringify({ ...f, package_name: packageName, package_price: packagePrice, captcha: captchaToken, ...attribution }),
      });
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

  // Đã gửi yêu cầu VÀ có cọc giữ ngày → hiện QR để khách chuyển ngay. Đây là
  // lúc khách còn đang quyết; để studio gọi lại rồi mới nói tới cọc là đã mất
  // khách cho studio khác trong mùa cưới.
  if (sent && deposit && !proofDone) {
    return (
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="card p-6 text-center">
          <Check size={26} className="mx-auto" style={{ color: "#7bb38a" }} />
          <h1 className="mt-2 font-serif text-2xl font-medium">{tr.sentTitle}</h1>
          <h2 className="mt-4 text-base font-semibold">{tr.depositTitle}</h2>
          <p className="mx-auto mt-1 max-w-xs text-[13px]" style={{ color: "var(--text2)" }}>{tr.depositBody}</p>

          <div className="mt-4">
            <VietQR bank={bank!} amount={deposit.amount} addInfo={deposit.code} />
          </div>

          <p className="mt-3 text-[12px]" style={{ color: "var(--text3)" }}>
            {tr.depositContent}: <b style={{ color: "var(--text)" }}>{deposit.code}</b>
          </p>

          {proofErr && <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>{proofErr}</p>}

          <label className="btn-primary mt-4 w-full cursor-pointer justify-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={proofBusy}
              onChange={(e) => sendProof(e.target.files?.[0] ?? null)}
            />
            {proofBusy ? tr.depositSending : tr.depositProof}
          </label>
          <button
            type="button"
            onClick={() => setProofDone(true)}
            className="btn-ghost mt-2 w-full justify-center text-xs"
          >
            {tr.depositSkip}
          </button>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="card max-w-sm p-8 text-center">
          <Check size={28} className="mx-auto" style={{ color: "#7bb38a" }} />
          <h1 className="mt-3 font-serif text-2xl font-medium">
            {deposit ? tr.depositDoneTitle : tr.sentTitle}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text2)" }}>
            {studioName} {deposit ? tr.depositDoneBody : tr.sentBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <p className="eyebrow mb-1.5">{studioName}</p>
      <h1 className="flex items-center gap-2 font-serif text-3xl font-medium">
        <CalendarCheck size={24} /> {tr.eyebrow}
      </h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text2)" }}>{tr.subtitle}</p>

      <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
        <label className="block">
          <span className="label">{tr.fullName}</span>
          <input className="input" required aria-required="true" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{tr.phone}</span>
          <input className="input" inputMode="tel" required aria-required="true" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{tr.package}</span>
          <select className="input" value={pkg} onChange={(e) => setPkg(e.target.value)}>
            <option value="">{tr.packageDefault}</option>
            {packages.map((p) => (
              <option key={p.name} value={p.name}>{p.name} — {vnd(p.price)}</option>
            ))}
            <option value="__custom__">{tr.packageCustom}</option>
          </select>
          {pkg === "__custom__" && (
            <input className="input mt-2" placeholder={tr.packageCustomPh} value={customPkg} onChange={(e) => setCustomPkg(e.target.value)} />
          )}
        </label>
        <label className="block">
          <span className="label">{tr.service}</span>
          <input className="input" placeholder={tr.servicePh} value={f.service} onChange={(e) => set("service", e.target.value)} />
        </label>
        <label className="block">
          <span className="label">{tr.facebook}</span>
          <input className="input" placeholder={tr.facebookPh} value={f.facebook} onChange={(e) => set("facebook", e.target.value)} />
        </label>
        {/* Ô giới thiệu chỉ hiện khi studio BẬT chương trình (referralDiscount > 0)
            hoặc khách vào bằng link có sẵn mã — hỏi khi không có ưu đãi gì thì chỉ
            làm form dài thêm. */}
        {(referralDiscount > 0 || !!f.referrer_phone) && (
          <label className="block">
            <span className="label">{tr.referrer}</span>
            <input
              className="input"
              inputMode="tel"
              placeholder={tr.referrerPh}
              value={f.referrer_phone}
              onChange={(e) => set("referrer_phone", e.target.value)}
            />
            <span className="mt-1 block text-[11px]" style={{ color: "var(--text3)" }}>
              {referralDiscount > 0
                ? `${tr.referrerHint} ${vnd(referralDiscount)}.`
                : tr.referrerHint}
            </span>
          </label>
        )}
        <div>
          <span className="label">{tr.date}</span>
          <DateInput value={f.preferred_date} onChange={(v) => set("preferred_date", v)} />
        </div>
        <label className="block">
          <span className="label">{tr.note}</span>
          <textarea className="input min-h-[80px]" value={f.note} onChange={(e) => set("note", e.target.value)} />
        </label>
        <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => setCaptchaToken(null)} />
        {err && <p className="text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
        <button type="submit" disabled={busy || !captchaToken} className="btn-primary w-full">
          {busy ? tr.submitting : tr.submit}
        </button>
      </form>
    </div>
  );
}
