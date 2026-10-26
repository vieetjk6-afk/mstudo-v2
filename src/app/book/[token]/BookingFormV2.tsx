"use client";

import { useState } from "react";
import {
  ArrowLeft, ArrowRight, CalendarCheck, CalendarDays, Check, CheckCircle2, Gift, Loader2, Package, Pencil, Receipt, Upload, UserRound,
  type LucideIcon,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import Turnstile from "@/components/Turnstile";
import { VietQR } from "@/components/VietQR";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Card, Field, Stack, btn, inputCls } from "@/components/v2/kit";
import { fmtDateLunar } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { vnd } from "@/lib/types";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { useBookingForm, type BookingFormProps, type DepositInfo, type Lang } from "./useBookingForm";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐẶT LỊCH — giao diện mới (/book/<token> khi customerUiV2 bật).

   Cùng dữ liệu và cùng luồng với BookingForm (logic ở ./useBookingForm): gói
   chọn sẵn từ ?pkg=, người giới thiệu ?ref=, voucher ?voucher=, nguồn khách,
   Turnstile, gửi /api/book/<token>, rồi bước cọc giữ ngày (QR + ảnh biên lai).

   Khác ở cách sắp xếp: bốn bước ngắn Gói → Ngày → Thông tin → Xác nhận, mỗi
   bước một việc; thẻ tóm tắt bên phải (máy tính) hoặc ở bước cuối (điện
   thoại); MỘT nút chính, dính đáy màn hình trên điện thoại.
   ═══════════════════════════════════════════════════════════════════════════ */

const V2T: Record<Lang, {
  steps: [string, string, string, string];
  stepOf: (n: number) => string;
  next: string;
  back: string;
  summary: string;
  none: string;
  pkgHint: string;
  dateTitle: string;
  dateHint: string;
  infoTitle: string;
  confirmTitle: string;
  confirmHint: string;
  edit: string;
  depositAfter: string;
  voucherPhone: string;
  voucherPhonePh: string;
  referralLine: string;
  contact: string;
}> = {
  vi: {
    steps: ["Gói", "Ngày", "Thông tin", "Xác nhận"],
    stepOf: (n) => `Bước ${n}/4`,
    next: "Tiếp tục",
    back: "Quay lại",
    summary: "Tóm tắt đặt lịch",
    none: "Chưa chọn",
    pkgHint: "Chưa chắc chọn gói nào? Chọn “tư vấn thêm”, studio sẽ gợi ý gói hợp với bạn.",
    dateTitle: "Bạn muốn chụp ngày nào?",
    dateHint: "Không bắt buộc — studio sẽ xác nhận ngày còn trống với bạn.",
    infoTitle: "Thông tin liên hệ",
    confirmTitle: "Kiểm tra lại và gửi",
    confirmHint: "Gửi yêu cầu chưa phải đặt cọc — studio sẽ liên hệ xác nhận lịch với bạn.",
    edit: "Sửa",
    depositAfter: "Sau khi gửi, bạn có thể chuyển cọc ngay để studio giữ ngày cho bạn.",
    voucherPhone: "SĐT của hợp đồng được tặng voucher",
    voucherPhonePh: "Bỏ trống nếu là chính bạn",
    referralLine: "Ưu đãi người giới thiệu",
    contact: "Liên hệ",
  },
  en: {
    steps: ["Package", "Date", "Details", "Confirm"],
    stepOf: (n) => `Step ${n}/4`,
    next: "Continue",
    back: "Back",
    summary: "Booking summary",
    none: "Not chosen",
    pkgHint: "Not sure yet? Pick “need advice” and the studio will suggest a package.",
    dateTitle: "When would you like to shoot?",
    dateHint: "Optional — the studio will confirm availability with you.",
    infoTitle: "Your contact details",
    confirmTitle: "Review and send",
    confirmHint: "Sending a request is not a deposit — the studio will contact you to confirm.",
    edit: "Edit",
    depositAfter: "After sending, you can transfer a deposit right away so the studio holds the date.",
    voucherPhone: "Phone on the contract that received the voucher",
    voucherPhonePh: "Leave blank if it's you",
    referralLine: "Referral discount",
    contact: "Contact",
  },
};

const STEP_ICON: LucideIcon[] = [Package, CalendarDays, UserRound, CheckCircle2];

/** Nhãn ô chọn của bản cũ ("— Gói khác (tự ghi) —") → chữ trơn cho thẻ lựa chọn. */
const plain = (s: string) => s.replace(/^—\s?|\s?—$/g, "").trim();

export default function BookingFormV2(
  props: BookingFormProps & {
    brand: StudioBrandInfo;
    /** Chỉ màn xem trước (/uipreview): mở sẵn bước, hoặc màn đã gửi / bước cọc. */
    preview?: { step?: number; sent?: DepositInfo | true };
  },
) {
  const { studioName, packages = [], referralDiscount = 0, bank = null, voucher = null, brand, preview } = props;
  const form = useBookingForm(props);
  const { lang, tr, f, set, pkg, setPkg, customPkg, setCustomPkg, busy, err, setErr, captchaToken, setCaptchaToken, voucherPhone, setVoucherPhone } = form;
  const t = V2T[lang];
  const { theme } = useTheme();
  const [step, setStep] = useState(() => Math.min(3, Math.max(0, preview?.step ?? 0)));

  const sent = form.sent || !!preview?.sent;
  const deposit = form.deposit ?? (preview?.sent && preview.sent !== true ? preview.sent : null);
  const proofDone = form.proofDone;

  const chosen = packages.find((p) => p.name === pkg);
  const pkgLabel = pkg === "__custom__" ? customPkg.trim() || plain(tr.packageCustom) : chosen?.name ?? null;
  const showReferrer = referralDiscount > 0 || !!f.referrer_phone;
  const canDeposit = !!bank?.bin && !!bank?.account;

  /* ── Bước cọc giữ ngày (đã gửi + có cọc) ── */
  if (sent && deposit && !proofDone) {
    return (
      <Shell brand={brand} theme={theme} sub={tr.eyebrow}>
        <Card className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
            <Check size={24} />
          </span>
          <h1 className="mt-3 text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>{tr.sentTitle}</h1>
          <p className="mx-auto mt-1 max-w-[340px] text-[14px]" style={{ color: "var(--tx2)" }}>{studioName} {tr.sentBody}</p>
        </Card>
        <Card>
          <h2 className="text-[16px] font-semibold">{tr.depositTitle}</h2>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{tr.depositBody}</p>
          <div className="mt-4 rounded-[14px] px-3 py-4" style={{ background: "var(--sf2)" }}>
            <VietQR bank={bank!} amount={deposit.amount} addInfo={deposit.code} />
          </div>
          <p className="mt-3 text-center text-[13px]" style={{ color: "var(--tx3)" }}>
            {tr.depositContent}: <b className="tnum" style={{ color: "var(--tx)" }}>{deposit.code}</b>
          </p>
          {form.proofErr && <div className="mt-3"><Callout tone="red">{form.proofErr}</Callout></div>}
          <label className={btn("primary", "lg", `mt-4 w-full cursor-pointer ${form.proofBusy ? "pointer-events-none opacity-60" : ""}`)}>
            <input type="file" accept="image/*" className="hidden" disabled={form.proofBusy} onChange={(e) => form.sendProof(e.target.files?.[0] ?? null)} />
            {form.proofBusy ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
            {form.proofBusy ? tr.depositSending : tr.depositProof}
          </label>
          <button type="button" onClick={() => form.setProofDone(true)} className={btn("ghost", "md", "mt-2 w-full")}>
            {tr.depositSkip}
          </button>
        </Card>
      </Shell>
    );
  }

  /* ── Đã gửi ── */
  if (sent) {
    return (
      <Shell brand={brand} theme={theme} sub={tr.eyebrow}>
        <Card className="py-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}>
            <Check size={28} />
          </span>
          <h1 className="mt-4 text-[22px] font-bold" style={{ letterSpacing: "-.4px" }}>{deposit ? tr.depositDoneTitle : tr.sentTitle}</h1>
          <p className="mx-auto mt-1.5 max-w-[340px] text-[14px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>
            {studioName} {deposit ? tr.depositDoneBody : tr.sentBody}
          </p>
        </Card>
      </Shell>
    );
  }

  /* ── Bốn bước ── */
  const last = step === 3;
  function goNext(e: React.FormEvent) {
    e.preventDefault();
    if (step === 2 && (!f.name.trim() || !f.phone.trim())) {
      setErr(tr.errRequired);
      return;
    }
    setErr(null);
    if (!last) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0 });
      return;
    }
    void form.submit(e);
  }
  const back = () => {
    setErr(null);
    setStep((s) => Math.max(0, s - 1));
    window.scrollTo({ top: 0 });
  };

  const summary = (
    <Summary
      t={t}
      tr={tr}
      pkgLabel={pkgLabel}
      price={pkg === "__custom__" ? null : chosen?.price ?? null}
      service={f.service}
      date={f.preferred_date}
      name={f.name}
      phone={f.phone}
      voucher={voucher?.ok ? `${voucher.code} · ${voucher.label}` : null}
      referral={showReferrer && f.referrer_phone && referralDiscount > 0 ? referralDiscount : 0}
      depositHint={canDeposit ? t.depositAfter : null}
      onEdit={last ? (i) => setStep(i) : undefined}
    />
  );

  return (
    <Shell brand={brand} theme={theme} sub={tr.eyebrow} wide>
      <div>
        <h1 className="flex items-center gap-2 text-[22px] font-bold sm:text-[26px]" style={{ letterSpacing: "-.5px" }}>
          <CalendarCheck size={24} style={{ color: "var(--ac)" }} /> {tr.eyebrow}
        </h1>
        <p className="mt-1 text-[14px]" style={{ color: "var(--tx2)" }}>{tr.subtitle}</p>
      </div>

      {voucher && (
        <div data-testid="booking-voucher">
          {voucher.ok ? (
            <Callout tone="green" icon={Gift} title={<>Đang dùng voucher <span className="font-mono">{voucher.code}</span> · {voucher.label}</>}>
              <p>Studio sẽ trừ ưu đãi này thẳng vào hợp đồng của bạn.</p>
              {voucher.terms && voucher.terms.length > 0 && <p className="mt-0.5 text-[12px]" style={{ color: "var(--tx3)" }}>{voucher.terms.join(" · ")}</p>}
            </Callout>
          ) : (
            <Callout tone="amber" icon={Gift} title={<>Mã <span className="font-mono">{voucher.code}</span>: {voucher.message}</>}>
              Bạn vẫn đặt lịch bình thường được.
            </Callout>
          )}
        </div>
      )}

      <Stepper t={t} step={step} onPick={(i) => i < step && setStep(i)} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={goNext} className="min-w-0">
          <Card>
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-[16px] font-semibold">{tr.package}</h2>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>{t.pkgHint}</p>
                </div>
                <div className="flex flex-col gap-2" role="radiogroup" aria-label={tr.package}>
                  {packages.map((p) => (
                    <Choice key={p.name} on={pkg === p.name} onPick={() => setPkg(p.name)} title={p.name} right={vnd(p.price)} />
                  ))}
                  <Choice on={pkg === ""} onPick={() => setPkg("")} title={plain(tr.packageDefault)} muted />
                  <Choice on={pkg === "__custom__"} onPick={() => setPkg("__custom__")} title={plain(tr.packageCustom)} muted />
                </div>
                {pkg === "__custom__" && (
                  <input className={inputCls} placeholder={tr.packageCustomPh} value={customPkg} onChange={(e) => setCustomPkg(e.target.value)} autoFocus />
                )}
                <Field label={tr.service}>
                  <input className={inputCls} placeholder={tr.servicePh} value={f.service} onChange={(e) => set("service", e.target.value)} />
                </Field>
              </div>
            )}

            {step === 1 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-[16px] font-semibold">{t.dateTitle}</h2>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>{t.dateHint}</p>
                </div>
                <Field label={tr.date} className="max-w-[320px]">
                  <DateInput value={f.preferred_date} onChange={(v) => set("preferred_date", v)} className={inputCls} />
                </Field>
                <Field label={tr.note}>
                  <textarea className={inputCls} rows={4} value={f.note} onChange={(e) => set("note", e.target.value)} />
                </Field>
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <h2 className="text-[16px] font-semibold sm:col-span-2">{t.infoTitle}</h2>
                <Field label={tr.fullName}>
                  <input className={inputCls} required aria-required="true" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label={tr.phone}>
                  <input className={inputCls} inputMode="tel" autoComplete="tel" required aria-required="true" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
                </Field>
                <Field label={tr.facebook} className="sm:col-span-2">
                  <input className={inputCls} placeholder={tr.facebookPh} value={f.facebook} onChange={(e) => set("facebook", e.target.value)} />
                </Field>
                {/* Ô giới thiệu chỉ hiện khi studio BẬT chương trình hoặc khách vào bằng link có sẵn mã (như bản cũ). */}
                {showReferrer && (
                  <Field
                    label={tr.referrer}
                    hint={referralDiscount > 0 ? `${tr.referrerHint} ${vnd(referralDiscount)}.` : tr.referrerHint}
                    className="sm:col-span-2"
                  >
                    <input className={inputCls} inputMode="tel" placeholder={tr.referrerPh} value={f.referrer_phone} onChange={(e) => set("referrer_phone", e.target.value)} />
                  </Field>
                )}
                {voucher?.ok && voucher.needsPhone && (
                  <Field label={t.voucherPhone} className="sm:col-span-2">
                    <input className={inputCls} inputMode="tel" placeholder={t.voucherPhonePh} value={voucherPhone} onChange={(e) => setVoucherPhone(e.target.value)} />
                  </Field>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-[16px] font-semibold">{t.confirmTitle}</h2>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--tx3)" }}>{t.confirmHint}</p>
                </div>
                {/* Điện thoại: tóm tắt nằm ngay trong bước xác nhận. */}
                <div className="lg:hidden">{summary}</div>
                <Turnstile onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => setCaptchaToken(null)} />
              </div>
            )}

            {err && <div className="mt-4"><Callout tone="red">{err}</Callout></div>}

            {/* Nút: máy tính nằm cuối thẻ; điện thoại dính đáy màn hình. */}
            <div
              className="mt-6 flex gap-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:mt-0 max-sm:border-t max-sm:px-4 max-sm:pt-3 max-sm:backdrop-blur-[14px] max-sm:[background:var(--topbar)] max-sm:[padding-bottom:max(12px,env(safe-area-inset-bottom,0px))]"
              style={{ borderColor: "var(--bd)" }}
            >
              {step > 0 && (
                <button type="button" onClick={back} className={btn("secondary", "lg", "flex-none")} aria-label={t.back}>
                  <ArrowLeft size={17} /> <span className="hidden sm:inline">{t.back}</span>
                </button>
              )}
              <button type="submit" disabled={busy || (last && !captchaToken)} className={btn("primary", "lg", "flex-1 sm:flex-none")}>
                {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                {last ? (busy ? tr.submitting : tr.submit) : t.next}
                {!last && <ArrowRight size={17} />}
              </button>
            </div>
          </Card>
        </form>

        <aside className="hidden lg:sticky lg:top-[76px] lg:block">{summary}</aside>
      </div>
      {/* Chừa chỗ cho thanh nút dính đáy trên điện thoại. */}
      <div className="h-16 sm:hidden" aria-hidden />
    </Shell>
  );
}

function Shell({ brand, theme, sub, wide, children }: { brand: StudioBrandInfo; theme: "light" | "dark"; sub: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2 brand={brand} sub={sub} />
      <CustomerMainV2 width={wide ? 1080 : 520}>
        <Stack>{children}</Stack>
      </CustomerMainV2>
    </CustomerRootV2>
  );
}

function Stepper({ t, step, onPick }: { t: (typeof V2T)["vi"]; step: number; onPick: (i: number) => void }) {
  return (
    <div>
      {/* Điện thoại: một dòng chữ + bốn vạch. */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between text-[13px]">
          <span style={{ color: "var(--tx3)" }}>{t.stepOf(step + 1)}</span>
          <span className="font-semibold" style={{ color: "var(--ac)" }}>{t.steps[step]}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden>
          {t.steps.map((_, i) => <span key={i} className="h-1.5 rounded-full" style={{ background: i <= step ? "var(--ac)" : "var(--bd2)" }} />)}
        </div>
      </div>
      {/* Máy tính: bốn bước có tên, bấm lại bước đã qua. */}
      <ol className="hidden grid-cols-4 gap-2 sm:grid">
        {t.steps.map((label, i) => {
          const Icon = STEP_ICON[i];
          const done = i < step;
          const on = i === step;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onPick(i)}
                disabled={!done}
                className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-left disabled:cursor-default"
                style={{ background: on ? "var(--acS)" : "transparent", border: `1px solid ${on ? "var(--acM)" : "var(--bd)"}` }}
              >
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12.5px] font-bold"
                  style={done ? { background: "var(--ac)", color: "#fff" } : on ? { background: "var(--sf)", color: "var(--ac)" } : { background: "var(--sf2)", color: "var(--tx3)" }}
                >
                  {done ? <Check size={15} /> : <Icon size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11.5px]" style={{ color: "var(--tx3)" }}>{t.stepOf(i + 1)}</span>
                  <span className="block truncate text-[13.5px] font-semibold" style={{ color: on || done ? "var(--tx)" : "var(--tx3)" }}>{label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Một lựa chọn gói (radio dạng thẻ). */
function Choice({ on, onPick, title, right, muted }: { on: boolean; onPick: () => void; title: string; right?: string; muted?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left transition-colors"
      style={{ border: `1px solid ${on ? "var(--ac)" : "var(--bd)"}`, background: on ? "var(--acS)" : "var(--sf)", boxShadow: on ? "0 0 0 2px var(--acM)" : undefined }}
    >
      <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full" style={{ border: `1.5px solid ${on ? "var(--ac)" : "var(--bdS)"}` }}>
        {on && <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ac)" }} />}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-snug" style={{ fontWeight: muted ? 500 : 600, color: muted && !on ? "var(--tx2)" : "var(--tx)" }}>{title}</span>
      {right && <span className="tnum flex-none text-[14px] font-semibold" style={{ color: on ? "var(--ac)" : "var(--tx)" }}>{right}</span>}
    </button>
  );
}

function SumRow({
  t, onEdit, icon: Icon, label, value, step,
}: { t: (typeof V2T)["vi"]; onEdit?: (step: number) => void; icon: LucideIcon; label: string; value: React.ReactNode; step: number }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderTop: "1px solid var(--bd2)" }}>
      <Icon size={16} style={{ color: "var(--tx3)", flex: "none", marginTop: 2 }} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px]" style={{ color: "var(--tx3)" }}>{label}</p>
        <div className="text-[14px] font-medium" style={{ overflowWrap: "anywhere" }}>{value}</div>
      </div>
      {onEdit && (
        <button type="button" onClick={() => onEdit(step)} className={btn("ghost", "sm", "-mr-2")} aria-label={`${t.edit}: ${label}`}>
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}

function Summary({
  t, tr, pkgLabel, price, service, date, name, phone, voucher, referral, depositHint, onEdit,
}: {
  t: (typeof V2T)["vi"];
  tr: ReturnType<typeof useBookingForm>["tr"];
  pkgLabel: string | null;
  price: number | null;
  service: string;
  date: string;
  name: string;
  phone: string;
  voucher: string | null;
  referral: number;
  depositHint: string | null;
  onEdit?: (step: number) => void;
}) {
  const dim = (s: string) => <span style={{ color: "var(--tx3)", fontWeight: 400 }}>{s}</span>;
  return (
    <div className="v2-card v2-card-pad">
      <p className="flex items-center gap-2 text-[15px] font-semibold"><Receipt size={17} style={{ color: "var(--ac)" }} /> {t.summary}</p>
      <div className="mt-3">
        <SumRow t={t} onEdit={onEdit} icon={Package} label={tr.package} step={0} value={pkgLabel ? <>{pkgLabel}{price ? <span className="tnum block font-semibold" style={{ color: "var(--ac)" }}>{vnd(price)}</span> : null}</> : dim(t.none)} />
        {service.trim() && <SumRow t={t} onEdit={onEdit} icon={Package} label={tr.service} step={0} value={service} />}
        <SumRow t={t} onEdit={onEdit} icon={CalendarDays} label={tr.date} step={1} value={date ? fmtDateLunar(date) : dim(t.none)} />
        <SumRow t={t} onEdit={onEdit} icon={UserRound} label={t.contact} step={2} value={name.trim() || phone.trim() ? <>{name}{phone ? <span className="tnum block font-normal" style={{ color: "var(--tx2)" }}>{phone}</span> : null}</> : dim(t.none)} />
        {voucher && <SumRow t={t} onEdit={onEdit} icon={Gift} label="Voucher" step={2} value={voucher} />}
        {referral > 0 && <SumRow t={t} onEdit={onEdit} icon={Gift} label={t.referralLine} step={2} value={<span className="tnum">−{vnd(referral)}</span>} />}
      </div>
      {depositHint && <p className="mt-2 rounded-[10px] px-3 py-2 text-[12.5px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>{depositHint}</p>}
    </div>
  );
}
