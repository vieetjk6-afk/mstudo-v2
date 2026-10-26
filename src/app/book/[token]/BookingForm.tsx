"use client";

import DateInput from "@/components/DateInput";
import { CalendarCheck, Check } from "lucide-react";
import { vnd } from "@/lib/types";
import Turnstile from "@/components/Turnstile";
import { VietQR } from "@/components/VietQR";
import { useBookingForm, type BookingFormProps } from "./useBookingForm";

// Kiểu dữ liệu + toàn bộ logic (ngôn ngữ, nguồn khách, gửi, captcha, bước cọc)
// nằm ở ./useBookingForm — dùng chung với bản giao diện mới (BookingFormV2).
export type { PkgOption, DepositInfo, BookingVoucher } from "./useBookingForm";

export default function BookingForm(props: BookingFormProps) {
  const { studioName, packages = [], referralDiscount = 0, bank = null, voucher = null } = props;
  const {
    tr, f, set, pkg, setPkg, customPkg, setCustomPkg, busy, sent, err, setCaptchaToken, captchaToken,
    voucherPhone, setVoucherPhone, deposit, proofBusy, proofDone, setProofDone, proofErr, sendProof, submit,
  } = useBookingForm(props);

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

      {voucher && (
        <div
          className="mt-5 rounded-[14px] px-4 py-3 text-[13.5px]"
          style={voucher.ok
            ? { background: "#fbf3e4", border: "1px solid #b8863b77", color: "#2b2118" }
            : { background: "#fdecec", border: "1px solid #e5a3a3", color: "#8a2b2b" }}
          data-testid="booking-voucher"
        >
          {voucher.ok ? (
            <>
              🎁 Đang dùng voucher <b className="font-mono">{voucher.code}</b> · <b>{voucher.label}</b>
              <span className="mt-0.5 block text-[12px] opacity-80">Studio sẽ trừ ưu đãi này thẳng vào hợp đồng của bạn.</span>
              {voucher.terms && voucher.terms.length > 0 && (
                <span className="mt-1 block text-[11.5px] opacity-70">{voucher.terms.join(" · ")}</span>
              )}
              {voucher.needsPhone && (
                <label className="mt-2.5 block">
                  <span className="block text-[12px] font-semibold">SĐT của hợp đồng được tặng voucher</span>
                  <input
                    className="input mt-1"
                    inputMode="tel"
                    placeholder="Bỏ trống nếu là chính bạn"
                    value={voucherPhone}
                    onChange={(e) => setVoucherPhone(e.target.value)}
                  />
                </label>
              )}
            </>
          ) : (
            <>Mã <b className="font-mono">{voucher.code}</b>: {voucher.message} Bạn vẫn đặt lịch bình thường được.</>
          )}
        </div>
      )}

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
