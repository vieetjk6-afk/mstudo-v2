"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock, Loader2, MapPin, RefreshCw, Upload } from "lucide-react";
import Turnstile from "@/components/Turnstile";
import { VietQR } from "@/components/VietQR";
import { CustomerHeaderV2, CustomerMainV2, CustomerRootV2 } from "@/components/v2/customer";
import { Callout, Card, Field, Stack, btn, inputCls } from "@/components/v2/kit";
import { fmtDate, fmtDowDayMonth } from "@/lib/date";
import { useTheme } from "@/lib/theme";
import { vnd } from "@/lib/types";
import type { BankInfo } from "@/lib/vietqr";
import type { StudioBrandInfo } from "@/lib/studio-brand";
import { HOLD_MINUTES, holdMinutesLeft, slotBookable, slotRange, slotStarts, type MiniSession } from "@/lib/mini-session";

/* ═══════════════════════════════════════════════════════════════════════════
   KHÁCH CHỌN KHUNG GIỜ — /book/dot/<token> (một bản, ngôn ngữ thiết kế mới).
   Ba màn: chọn khung + điền tên → (có cọc) quét QR, báo đã chuyển → xong.
   Tiếng Việt mặc định; "en" khi khách đã chọn tiếng Anh (localStorage vk_lang,
   cùng khoá với form đặt lịch).
   ═══════════════════════════════════════════════════════════════════════════ */

type Lang = "vi" | "en";
const TR = {
  vi: {
    eyebrow: "Chọn khung giờ chụp",
    pick: "Chọn khung giờ",
    free: (n: number) => (n ? `Còn ${n} khung trống` : "Đã kín lịch"),
    taken: "Đã có người",
    passed: "Đã qua",
    reload: "Tải lại",
    perSlot: "mỗi khung",
    depositLine: (a: string) => `Cọc ${a} để giữ chỗ`,
    noDeposit: "Không cần cọc",
    closed: "Đợt chụp này đã ngừng nhận đặt online. Liên hệ studio nếu bạn cần đặt.",
    past: "Đợt chụp này đã qua.",
    your: "Thông tin của bạn",
    name: "Họ và tên *",
    phone: "Số điện thoại *",
    note: "Ghi chú",
    notePh: "VD: đi 2 người lớn, 1 bé",
    submit: (r: string) => `Đặt khung ${r}`,
    choose: "Chọn một khung giờ ở trên",
    sending: "Đang đặt…",
    errMissing: "Vui lòng nhập họ tên và số điện thoại.",
    errPhone: "Số điện thoại chưa đúng.",
    errTaken: "Khung này vừa có người đặt. Bạn chọn khung khác nhé.",
    errClosed: "Đợt chụp vừa ngừng nhận đặt.",
    errCaptcha: "Vui lòng xác minh bạn không phải robot.",
    errRate: "Bạn thao tác hơi nhanh — chờ một phút rồi thử lại.",
    err: "Chưa đặt được, vui lòng thử lại.",
    held: "Đã giữ chỗ cho bạn",
    heldBody: (m: number) => `Chuyển cọc trong ${m} phút để chắc chỗ. Quá thời gian mà chưa báo chuyển, khung sẽ mở lại cho khách khác.`,
    content: "Nội dung chuyển khoản",
    proof: "Tôi đã chuyển — gửi ảnh biên lai",
    paidNoProof: "Tôi đã chuyển (không gửi ảnh)",
    proofSending: "Đang gửi…",
    proofErr: "Chưa gửi được, thử lại nhé.",
    done: "Đặt khung giờ thành công",
    doneBody: (s: string) => `${s} đã nhận lịch của bạn. Hẹn gặp bạn đúng giờ nhé!`,
    doneDeposit: (s: string) => `${s} sẽ đối chiếu khoản cọc và xác nhận với bạn.`,
  },
  en: {
    eyebrow: "Pick a time slot",
    pick: "Choose a time",
    free: (n: number) => (n ? `${n} slots left` : "Fully booked"),
    taken: "Taken",
    passed: "Passed",
    reload: "Refresh",
    perSlot: "per slot",
    depositLine: (a: string) => `${a} deposit to hold your slot`,
    noDeposit: "No deposit needed",
    closed: "Online booking for this session is closed. Please contact the studio.",
    past: "This session has ended.",
    your: "Your details",
    name: "Full name *",
    phone: "Phone number *",
    note: "Note",
    notePh: "e.g. 2 adults, 1 child",
    submit: (r: string) => `Book ${r}`,
    choose: "Pick a time slot above",
    sending: "Booking…",
    errMissing: "Please enter your name and phone number.",
    errPhone: "That phone number doesn't look right.",
    errTaken: "That slot was just taken. Please pick another.",
    errClosed: "Booking for this session has just closed.",
    errCaptcha: "Please verify you are not a robot.",
    errRate: "Too many attempts — wait a minute and try again.",
    err: "Could not book, please try again.",
    held: "Your slot is on hold",
    heldBody: (m: number) => `Transfer the deposit within ${m} minutes to secure it. After that the slot reopens for others.`,
    content: "Transfer note",
    proof: "I've paid — upload receipt",
    paidNoProof: "I've paid (no receipt)",
    proofSending: "Sending…",
    proofErr: "Could not send, please try again.",
    done: "Your slot is booked",
    doneBody: (s: string) => `${s} has your booking. See you on time!`,
    doneDeposit: (s: string) => `${s} will check the deposit and confirm with you.`,
  },
} as const;

type PublicSession = Pick<
  MiniSession,
  "title" | "session_date" | "start_min" | "end_min" | "slot_minutes" | "gap_minutes" | "price" | "deposit" | "location" | "note" | "is_open"
>;
export type SlotDeposit = { amount: number; code: string; token: string; holdUntil: string | null };

export default function SlotBooking({
  token, brand, session: s, taken: taken0, today, nowMin, bank, preview,
}: {
  token: string;
  brand: StudioBrandInfo;
  session: PublicSession;
  /** Giờ bắt đầu (phút) của các khung đã có người. */
  taken: number[];
  today: string;
  nowMin: number;
  bank: BankInfo | null;
  /** Chỉ màn xem trước (/uipreview). */
  preview?: { pick?: number; deposit?: SlotDeposit; done?: boolean };
}) {
  const { theme } = useTheme();
  const [lang, setLang] = useState<Lang>("vi");
  useEffect(() => {
    try { if (localStorage.getItem("vk_lang") === "en") setLang("en"); } catch { /* bỏ qua */ }
  }, []);
  const t = TR[lang];

  const [taken, setTaken] = useState<number[]>(taken0);
  const [open, setOpen] = useState(s.is_open);
  const [pick, setPick] = useState<number | null>(preview?.pick ?? null);
  const [f, setF] = useState({ name: "", phone: "", note: "" });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<string | null>(preview?.pick != null ? slotRange(preview.pick, s.slot_minutes) : null);
  const [deposit, setDeposit] = useState<SlotDeposit | null>(preview?.deposit ?? null);
  const [done, setDone] = useState(!!preview?.done);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofErr, setProofErr] = useState<string | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!deposit || done) return;
    const i = setInterval(() => setTick(Date.now()), 15_000);
    return () => clearInterval(i);
  }, [deposit, done]);

  const starts = slotStarts(s);
  const isPast = s.session_date < today;
  const usable = (st: number) => !taken.includes(st) && slotBookable({ session_date: s.session_date, is_open: open }, st, today, nowMin);
  const freeN = starts.filter(usable).length;

  async function reload() {
    try {
      const r = await fetch(`/api/book/dot/${token}`, { cache: "no-store" });
      const j = (await r.json()) as { taken?: number[]; open?: boolean };
      if (Array.isArray(j.taken)) setTaken(j.taken);
      if (typeof j.open === "boolean") setOpen(j.open);
    } catch { /* giữ lưới cũ */ }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pick == null) return;
    if (!f.name.trim() || !f.phone.trim()) return setErr(t.errMissing);
    if (!captcha) return setErr(t.errCaptcha);
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/book/dot/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: pick, name: f.name, phone: f.phone, note: f.note, captcha }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; taken?: number[]; range?: string; deposit?: SlotDeposit | null };
      if (r.ok && j.ok) {
        setRange(j.range ?? slotRange(pick, s.slot_minutes));
        if (j.deposit) setDeposit(j.deposit);
        else setDone(true);
        return;
      }
      if (Array.isArray(j.taken)) setTaken(j.taken);
      if (j.error === "taken") setPick(null);
      if (j.error === "closed") setOpen(false);
      setErr(
        j.error === "taken" ? t.errTaken
          : j.error === "closed" || j.error === "past" ? t.errClosed
          : j.error === "phone" ? t.errPhone
          : j.error === "missing" ? t.errMissing
          : r.status === 429 ? t.errRate
          : t.err,
      );
    } catch {
      setErr(t.err);
    } finally {
      setBusy(false);
    }
  }

  /** Báo đã chuyển (kèm ảnh hoặc không) → cọc sang 'paid' → hết đếm giờ giữ chỗ. */
  async function sendProof(file: File | null) {
    if (!deposit) return;
    setProofBusy(true);
    setProofErr(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      const r = await fetch(`/api/book/deposit/${deposit.token}`, { method: "POST", body: fd });
      if (r.ok || r.status === 409) setDone(true);
      else setProofErr(t.proofErr);
    } catch {
      setProofErr(t.proofErr);
    } finally {
      setProofBusy(false);
    }
  }

  const info = (
    <Card>
      <h1 className="text-[20px] font-bold" style={{ letterSpacing: "-.3px", textWrap: "balance" }}>{s.title}</h1>
      <div className="mt-2 grid gap-1.5 text-[13.5px]" style={{ color: "var(--tx2)" }}>
        <p className="flex items-start gap-2"><CalendarDays size={15} className="mt-0.5 flex-none" /> <span>{fmtDowDayMonth(s.session_date)} · {fmtDate(s.session_date)}</span></p>
        <p className="flex items-start gap-2"><Clock size={15} className="mt-0.5 flex-none" /> <span>{range ?? `${s.slot_minutes}′ ${t.perSlot}`}</span></p>
        {s.location ? <p className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 flex-none" /> <span className="min-w-0 break-words">{s.location}</span></p> : null}
      </div>
      {s.price || s.deposit ? (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {s.price ? <><b className="tnum text-[17px]">{vnd(s.price)}</b><span className="text-[12.5px]" style={{ color: "var(--tx3)" }}>/ {t.perSlot}</span></> : null}
          <span className="text-[12.5px]" style={{ color: "var(--tx2)" }}>{s.deposit ? `· ${t.depositLine(vnd(s.deposit))}` : s.price ? `· ${t.noDeposit}` : ""}</span>
        </p>
      ) : null}
      {s.note ? <p className="mt-3 whitespace-pre-wrap rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>{s.note}</p> : null}
    </Card>
  );

  const shell = (children: React.ReactNode) => (
    <CustomerRootV2 theme={theme}>
      <CustomerHeaderV2 brand={brand} sub={t.eyebrow} />
      <CustomerMainV2 width={560}><Stack>{children}</Stack></CustomerMainV2>
    </CustomerRootV2>
  );

  if (done) {
    return shell(
      <>
        <Card className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--gnS)", color: "var(--gn)" }}><Check size={24} /></span>
          <h1 className="mt-3 text-[21px] font-bold" style={{ letterSpacing: "-.4px" }}>{t.done}</h1>
          <p className="mx-auto mt-1 max-w-[360px] text-[14px]" style={{ color: "var(--tx2)" }}>{deposit ? t.doneDeposit(brand.name) : t.doneBody(brand.name)}</p>
        </Card>
        {info}
      </>,
    );
  }

  if (deposit && bank) {
    const left = deposit.holdUntil ? holdMinutesLeft(deposit.holdUntil, tick) : HOLD_MINUTES;
    return shell(
      <>
        {info}
        <Card>
          <h2 className="text-[16px] font-semibold">{t.held}</h2>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--tx2)", textWrap: "pretty" }}>{t.heldBody(left)}</p>
          <div className="mt-4 rounded-[14px] px-3 py-4" style={{ background: "var(--sf2)" }}>
            <VietQR bank={bank} amount={deposit.amount} addInfo={deposit.code} />
          </div>
          <p className="mt-3 text-center text-[13px]" style={{ color: "var(--tx3)" }}>
            {t.content}: <b className="tnum" style={{ color: "var(--tx)" }}>{deposit.code}</b>
          </p>
          {proofErr ? <div className="mt-3"><Callout tone="red">{proofErr}</Callout></div> : null}
          <label className={btn("primary", "lg", `mt-4 w-full cursor-pointer ${proofBusy ? "pointer-events-none opacity-60" : ""}`)}>
            <input type="file" accept="image/*" className="hidden" disabled={proofBusy} onChange={(e) => void sendProof(e.target.files?.[0] ?? null)} />
            {proofBusy ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
            {proofBusy ? t.proofSending : t.proof}
          </label>
          <button type="button" disabled={proofBusy} onClick={() => void sendProof(null)} className={btn("ghost", "md", "mt-2 w-full")}>{t.paidNoProof}</button>
        </Card>
      </>,
    );
  }

  return shell(
    <>
      {info}
      {isPast ? <Callout tone="amber">{t.past}</Callout> : !open ? <Callout tone="amber">{t.closed}</Callout> : null}
      <Card>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-[16px] font-semibold">{t.pick}</h2>
          <span className="text-[12.5px]" style={{ color: freeN ? "var(--gn)" : "var(--tx3)" }}>{t.free(freeN)}</span>
          <button type="button" onClick={() => void reload()} className={btn("ghost", "sm", "ml-auto")}><RefreshCw size={13} /> {t.reload}</button>
        </div>
        {/* Lưới tự xuống dòng: ô tối thiểu 96px → điện thoại 375px vừa 3 cột. */}
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }} role="radiogroup" aria-label={t.pick}>
          {starts.map((st) => {
            const isTaken = taken.includes(st);
            const ok = usable(st);
            const on = pick === st;
            return (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!ok}
                onClick={() => { setErr(null); setPick(st); }}
                className="min-w-0 rounded-[12px] px-2 py-2.5 text-center"
                style={{
                  border: `1.5px solid ${on ? "var(--ac)" : "var(--bd)"}`,
                  background: on ? "var(--acS)" : ok ? "var(--sf)" : "var(--sf2)",
                  color: on ? "var(--ac)" : ok ? "var(--tx)" : "var(--tx3)",
                  cursor: ok ? "pointer" : "not-allowed",
                }}
              >
                <span className="tnum block text-[14.5px] font-bold" style={{ textDecoration: ok ? undefined : "line-through" }}>
                  {slotRange(st, s.slot_minutes).split("–")[0]}
                </span>
                <span className="block text-[11px]">{ok ? `→ ${slotRange(st, s.slot_minutes).split("–")[1]}` : isTaken ? t.taken : t.passed}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {freeN > 0 ? (
        <Card>
          <form onSubmit={submit} className="grid gap-3">
            <h2 className="text-[16px] font-semibold">{t.your}</h2>
            <Field label={t.name}><input className={inputCls} value={f.name} maxLength={120} autoComplete="name" onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label={t.phone}><input className={inputCls} inputMode="tel" value={f.phone} maxLength={30} autoComplete="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label={t.note}><input className={inputCls} value={f.note} maxLength={300} placeholder={t.notePh} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
            <Turnstile onVerify={setCaptcha} onExpire={() => setCaptcha(null)} onError={() => setCaptcha(null)} />
            {err ? <Callout tone="red">{err}</Callout> : null}
            <button type="submit" disabled={busy || pick == null || !captcha} className={btn("primary", "lg", "w-full")}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              {busy ? t.sending : pick == null ? t.choose : t.submit(slotRange(pick, s.slot_minutes))}
            </button>
          </form>
        </Card>
      ) : err ? <Callout tone="red">{err}</Callout> : null}
    </>,
  );
}
