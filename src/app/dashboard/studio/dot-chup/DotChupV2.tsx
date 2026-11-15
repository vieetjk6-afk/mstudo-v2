"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarClock, CalendarPlus, Check, ChevronDown, Clock, Copy, ExternalLink, Landmark, MapPin, Pencil,
  Phone, Plus, QrCode, Save, Trash2, UserPlus, X,
} from "lucide-react";
import DateInput from "@/components/DateInput";
import MoneyInput from "@/components/MoneyInput";
import { studioUrl } from "@/lib/hosts";
import { fmtDate, fmtDowDayMonth } from "@/lib/date";
import { vnd } from "@/lib/types";
import { DEPOSIT_STATUS_LABEL } from "@/lib/booking-deposit";
import {
  HOLD_MINUTES, SLOT_STATE_LABEL, hhmm, holdMinutesLeft, miniSessionPath, parseHhmm, sessionPast, sessionTimeLabel,
  slotCounts, slotDeposit, slotGrid, slotStarts, type MiniSession, type MiniSlotLock, type SlotState,
} from "@/lib/mini-session";
import { Badge, Callout, Empty, Field, InfoList, PageHead, Progress, Stack, btn, iconBtn, inputCls, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { Modal, Switch } from "@/components/v2/kit-client";
import type { DotChupProps, LockDeposit } from "./types";

/* ═══════════════════════════════════════════════════════════════════════════
   ĐỢT CHỤP THEO KHUNG GIỜ — giao diện mới (bản duy nhất).
     • Danh sách: đợt sắp tới trước, đợt đã qua gập lại.
     • Bấm một đợt → chi tiết: link + QR, lưới khung (trống / giữ chờ cọc / đã
       đặt), bấm khung trống để đặt tay, bấm khung có khách để huỷ / nhận cọc.
   Mọi lệnh ghi đi qua /api/studio/dot-chup rồi router.refresh() — màn không
   giữ bản sao dữ liệu nào, nên không thể lệch với database.
   ═══════════════════════════════════════════════════════════════════════════ */

const STATE_TONE: Record<SlotState, Tone> = { free: "gray", held: "amber", booked: "green" };

type Draft = {
  id: string | null;
  title: string;
  session_date: string;
  start: string;
  end: string;
  slot_minutes: number;
  gap_minutes: number;
  price: number;
  deposit: number;
  location: string;
  note: string;
  is_open: boolean;
};

const draftOf = (s: MiniSession): Draft => ({
  id: s.id, title: s.title, session_date: s.session_date, start: hhmm(s.start_min), end: hhmm(s.end_min),
  slot_minutes: s.slot_minutes, gap_minutes: s.gap_minutes, price: s.price, deposit: s.deposit,
  location: s.location ?? "", note: s.note ?? "", is_open: s.is_open,
});

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const r = await fetch("/api/studio/dot-chup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string };
    return r.ok && j.ok ? { ok: true } : { ok: false, message: j.message || (j.error === "forbidden" ? "Bạn không có quyền làm việc này." : "Chưa lưu được, thử lại nhé.") };
  } catch {
    return { ok: false, message: "Mất kết nối, thử lại nhé." };
  }
}

export default function DotChupV2({ sessions, locks, deposits, migrated, studioHost, today, openId, defaults, preview }: DotChupProps) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  // Hạn giữ chỗ trôi theo phút — cập nhật để khung hết hạn tự về "Trống".
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [activeId, setActiveId] = useState<string | null>(openId);
  const [draft, setDraft] = useState<Draft | null>(() =>
    preview?.create
      ? { id: null, title: "Chụp áo dài Tết 2027", session_date: "2027-01-16", start: "09:00", end: "12:00", slot_minutes: 20, gap_minutes: 5, price: 350_000, deposit: 100_000, location: "", note: "", is_open: true }
      : null,
  );
  const [showPast, setShowPast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locksBy = useMemo(() => {
    const m = new Map<string, MiniSlotLock[]>();
    for (const l of locks) m.set(l.session_id, [...(m.get(l.session_id) ?? []), l]);
    return m;
  }, [locks]);

  const upcoming = sessions.filter((s) => !sessionPast(s.session_date, today));
  const past = sessions.filter((s) => sessionPast(s.session_date, today)).reverse();
  const active = activeId ? sessions.find((s) => s.id === activeId) ?? null : null;

  const newDraft = (): Draft => ({
    id: null, title: "", session_date: "", start: "09:00", end: "17:00", slot_minutes: 20, gap_minutes: 0,
    price: 0, deposit: defaults.deposit, location: defaults.location ?? "", note: "", is_open: true,
  });

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr(null);
    const r = await call(body);
    setBusy(false);
    if (!r.ok) return setErr(r.message ?? "Chưa lưu được.");
    after?.();
    router.refresh();
  }

  async function saveDraft() {
    if (!draft) return;
    const session = {
      title: draft.title, session_date: draft.session_date, start_min: parseHhmm(draft.start), end_min: parseHhmm(draft.end),
      slot_minutes: draft.slot_minutes, gap_minutes: draft.gap_minutes, price: draft.price, deposit: draft.deposit,
      location: draft.location, note: draft.note, is_open: draft.is_open,
    };
    await run(draft.id ? { action: "update", id: draft.id, session } : { action: "create", session }, () => setDraft(null));
  }

  const row = (s: MiniSession) => {
    const c = slotCounts(s, locksBy.get(s.id) ?? [], now);
    const isPast = sessionPast(s.session_date, today);
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => { setErr(null); setActiveId(s.id); }}
        className="flex w-full min-w-0 flex-col gap-2 px-4 py-3.5 text-left sm:flex-row sm:items-center sm:gap-4"
        style={{ borderBottom: "1px solid var(--bd2)" }}
      >
        <span className="flex h-11 w-11 flex-none flex-col items-center justify-center rounded-[12px]" style={{ background: toneBg("brand"), color: toneFg("brand") }}>
          <span className="text-[15px] font-bold leading-none">{s.session_date.slice(8, 10)}</span>
          <span className="mt-0.5 text-[10px] font-semibold leading-none">Th{Number(s.session_date.slice(5, 7))}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold">{s.title}</span>
            {isPast ? <Badge tone="gray">Đã qua</Badge> : s.is_open ? <Badge tone="green" dot>Đang mở</Badge> : <Badge tone="gray" dot>Đã đóng</Badge>}
          </span>
          <span className="mt-0.5 block text-[12.5px]" style={{ color: "var(--tx2)" }}>
            {fmtDowDayMonth(s.session_date)} · {hhmm(s.start_min)} – {hhmm(s.end_min)}
            {s.location ? ` · ${s.location}` : ""}
          </span>
        </span>
        <span className="w-full flex-none sm:w-[150px]">
          <span className="mb-1 flex items-baseline justify-between text-[12.5px]">
            <span style={{ color: "var(--tx3)" }}>Đã đặt</span>
            <b className="v2-num">{c.taken}/{c.total}</b>
          </span>
          <Progress value={c.total ? (c.taken / c.total) * 100 : 0} tone={c.taken === c.total && c.total ? "green" : "brand"} />
        </span>
      </button>
    );
  };

  return (
    <Stack>
      {active ? (
        <Detail
          s={active}
          locks={locksBy.get(active.id) ?? []}
          deposits={deposits}
          now={now}
          today={today}
          studioHost={studioHost}
          busy={busy}
          err={err}
          onBack={() => { setErr(null); setActiveId(null); }}
          onEdit={() => { setErr(null); setDraft(draftOf(active)); }}
          run={run}
          clearErr={() => setErr(null)}
        />
      ) : (
        <>
          <PageHead
            desc="Mở một đợt chụp nhanh (Tết, Trung thu, kỷ yếu…): khách mở link, chọn khung giờ còn trống và cọc. Mỗi khung đã đặt tự hiện trên Lịch làm việc."
            actions={
              <button type="button" disabled={!migrated} onClick={() => { setErr(null); setDraft(newDraft()); }} className={btn("primary")}>
                <Plus size={17} /> Tạo đợt chụp
              </button>
            }
          />
          {!migrated ? (
            <Callout tone="amber" title="Cần cập nhật cơ sở dữ liệu">
              Chạy <code className="break-all">supabase/migrations/chup_theo_khung_gio.sql</code> trong Supabase SQL Editor để dùng tính năng này.
            </Callout>
          ) : null}
          {migrated && !defaults.hasBank ? (
            <Callout tone="blue" icon={Landmark} title="Chưa khai tài khoản nhận cọc">
              Khách vẫn đặt khung được nhưng sẽ không có bước chuyển cọc. Khai tài khoản ngân hàng ở Gói &amp; bảng giá để thu cọc qua mã QR.
            </Callout>
          ) : null}

          {sessions.length === 0 ? (
            <div className="v2-card">
              <Empty
                icon={CalendarClock}
                title="Chưa có đợt chụp nào"
                hint="Tạo một đợt: chọn ngày, giờ bắt đầu – kết thúc và độ dài mỗi khung. Hệ thống tự chia khung và tạo link cho khách."
                action={migrated ? <button type="button" onClick={() => setDraft(newDraft())} className={btn("primary")}><Plus size={16} /> Tạo đợt chụp</button> : undefined}
              />
            </div>
          ) : (
            <>
              <div className="v2-card overflow-hidden">
                {upcoming.length ? upcoming.map(row) : <Empty compact icon={CalendarClock} title="Không có đợt nào sắp tới" hint="Các đợt đã qua nằm ở bên dưới." />}
              </div>
              {past.length ? (
                <div className="v2-card overflow-hidden">
                  <button type="button" onClick={() => setShowPast((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-semibold" aria-expanded={showPast}>
                    <ChevronDown size={16} style={{ transform: showPast ? "rotate(180deg)" : undefined, color: "var(--tx3)" }} />
                    Đợt đã qua
                    <span className="font-normal" style={{ color: "var(--tx3)" }}>({past.length})</span>
                  </button>
                  {showPast ? <div style={{ borderTop: "1px solid var(--bd2)" }}>{past.map(row)}</div> : null}
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <SessionForm draft={draft} setDraft={setDraft} busy={busy} err={draft ? err : null} onSave={saveDraft} hasBank={defaults.hasBank} />
    </Stack>
  );
}

/* ── Chi tiết một đợt ────────────────────────────────────────────────────── */
function Detail({
  s, locks, deposits, now, today, studioHost, busy, err, onBack, onEdit, run, clearErr,
}: {
  s: MiniSession;
  locks: MiniSlotLock[];
  deposits: Record<string, LockDeposit>;
  now: number;
  today: string;
  studioHost: string | null;
  busy: boolean;
  err: string | null;
  onBack: () => void;
  onEdit: () => void;
  run: (body: Record<string, unknown>, after?: () => void) => Promise<void>;
  clearErr: () => void;
}) {
  const grid = useMemo(() => slotGrid(s, locks, now), [s, locks, now]);
  const taken = grid.filter((g) => g.state !== "free").length;
  const held = grid.filter((g) => g.state === "held").length;
  const isPast = sessionPast(s.session_date, today);

  const [url, setUrl] = useState(() => studioUrl(studioHost, miniSessionPath(s.token)));
  useEffect(() => {
    setUrl(studioHost ? studioUrl(studioHost, miniSessionPath(s.token)) : `${window.location.origin}${miniSessionPath(s.token)}`);
  }, [studioHost, s.token]);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  useEffect(() => {
    if (!showQr) return;
    // Nạp qrcode lúc cần — phần lớn lượt mở màn không bấm xem QR.
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { margin: 1, width: 480 }))
      .then(setQr)
      .catch(() => setQr(null));
  }, [showQr, url]);

  const [pick, setPick] = useState<number | null>(null);
  const picked = pick != null ? grid.find((g) => g.start === pick) ?? null : null;
  const [form, setForm] = useState({ name: "", phone: "", note: "" });
  const close = () => { setPick(null); setForm({ name: "", phone: "", note: "" }); clearErr(); };
  const dep = picked?.lock?.booking_id ? deposits[picked.lock.booking_id] ?? null : null;
  const hasDep = !!dep && dep.deposit_status !== "none";

  return (
    <>
      <PageHead
        title={
          <span className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={onBack} className={iconBtn()} aria-label="Về danh sách đợt chụp"><ArrowLeft size={18} /></button>
            <span className="min-w-0 truncate">{s.title}</span>
          </span>
        }
        desc={`${fmtDowDayMonth(s.session_date)} (${fmtDate(s.session_date)}) · ${sessionTimeLabel(s)}`}
        actions={
          <>
            <button type="button" onClick={onEdit} className={btn("secondary")}><Pencil size={16} /> Sửa đợt</button>
            <button
              type="button"
              disabled={busy}
              className={btn("ghost")}
              style={{ color: "var(--rd)" }}
              onClick={() => {
                if (!confirm(taken ? `Xoá đợt "${s.title}"? ${taken} khách đã đặt sẽ bị huỷ chỗ và các dòng trên Lịch làm việc bị gỡ.` : `Xoá đợt "${s.title}"?`)) return;
                void run({ action: "delete", id: s.id, force: true }, onBack);
              }}
            >
              <Trash2 size={16} /> Xoá
            </button>
          </>
        }
      />

      {err && pick == null ? <Callout tone="red">{err}</Callout> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="v2-card v2-card-pad min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-[14.5px] font-semibold">Khung giờ</p>
            <p className="text-[12.5px]" style={{ color: "var(--tx3)" }}>
              <b className="v2-num" style={{ color: "var(--tx)" }}>{taken}/{grid.length}</b> đã có khách{held ? ` · ${held} đang giữ chờ cọc` : ""}
            </p>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {(["free", "held", "booked"] as const).map((k) => <Badge key={k} tone={STATE_TONE[k]} dot>{SLOT_STATE_LABEL[k]}</Badge>)}
            </div>
          </div>
          {/* Lưới tự xuống dòng: mỗi ô tối thiểu 132px, điện thoại 375px vừa 2 cột. */}
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))" }}>
            {grid.map((g) => (
              <button
                key={g.start}
                type="button"
                onClick={() => { clearErr(); setPick(g.start); }}
                className="min-w-0 rounded-[12px] px-3 py-2.5 text-left"
                style={{
                  border: `1px solid ${g.state === "free" ? "var(--bd)" : `color-mix(in srgb, ${toneFg(STATE_TONE[g.state])} 30%, transparent)`}`,
                  background: g.state === "free" ? "var(--sf)" : toneBg(STATE_TONE[g.state]),
                }}
                aria-label={`${g.range} — ${SLOT_STATE_LABEL[g.state]}${g.lock ? ` — ${g.lock.customer_name}` : ""}`}
              >
                <span className="v2-num block text-[13.5px] font-bold">{g.range}</span>
                {g.lock ? (
                  <>
                    <span className="mt-0.5 block truncate text-[12.5px] font-semibold">{g.lock.customer_name || "Khách"}</span>
                    <span className="block truncate text-[12px]" style={{ color: "var(--tx2)" }}>{g.lock.customer_phone}</span>
                    <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: toneFg(STATE_TONE[g.state]) }}>
                      {g.state === "held" ? `Chờ cọc · còn ${holdMinutesLeft(g.lock.hold_expires_at, now)}′` : "Đã đặt"}
                    </span>
                  </>
                ) : (
                  <span className="mt-0.5 flex items-center gap-1 text-[12px]" style={{ color: "var(--tx3)" }}><UserPlus size={12} /> Trống — đặt tay</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="v2-card v2-card-pad">
            <p className="text-[14.5px] font-semibold">Link cho khách</p>
            <p className="mt-1 break-all text-[12.5px]" style={{ color: "var(--tx2)" }}>{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={btn("primary", "sm")}
                onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Đã chép" : "Chép link"}
              </button>
              <button type="button" className={btn("secondary", "sm")} onClick={() => setShowQr(true)}><QrCode size={14} /> Mã QR</button>
              <a href={url} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}><ExternalLink size={14} /> Xem trang</a>
            </div>
            <div className="mt-3" style={{ borderTop: "1px solid var(--bd2)", paddingTop: 10 }}>
              <Switch
                checked={s.is_open}
                disabled={busy || isPast}
                onChange={(v) => void run({ action: "set_open", id: s.id, open: v })}
                label="Nhận khách đặt online"
                desc={isPast ? "Đợt đã qua ngày." : s.is_open ? "Khách mở link là chọn khung được." : "Đã đóng — bạn vẫn đặt tay được."}
              />
            </div>
          </div>
          <div className="v2-card v2-card-pad">
            <InfoList
              items={[
                { label: "Giá mỗi khung", value: s.price ? vnd(s.price) : "Chưa đặt giá" },
                { label: "Cọc mỗi khung", value: s.deposit ? `${vnd(slotDeposit(s.price, s.deposit))} · giữ chỗ ${HOLD_MINUTES} phút` : "Không cọc" },
                ...(s.location ? [{ label: "Địa điểm", value: <span className="inline-flex items-start gap-1"><MapPin size={13} className="mt-0.5 flex-none" />{s.location}</span> }] : []),
                ...(s.note ? [{ label: "Ghi chú cho khách", value: <span className="whitespace-pre-wrap">{s.note}</span> }] : []),
              ]}
            />
          </div>
        </div>
      </div>

      {/* ── Khung trống: đặt tay ── */}
      <Modal
        open={!!picked && picked.state === "free"}
        onClose={close}
        icon={CalendarPlus}
        title={`Đặt khung ${picked?.range ?? ""}`}
        desc="Cho khách gọi điện hoặc đến trực tiếp. Khung được giữ chắc ngay, không chờ cọc."
        footer={
          <>
            <button type="button" onClick={close} className={btn("ghost")}>Huỷ</button>
            <button
              type="button"
              disabled={busy || !form.name.trim() || !form.phone.trim()}
              className={btn("primary")}
              onClick={() => picked && void run({ action: "book", id: s.id, start: picked.start, ...form }, close)}
            >
              <Save size={16} /> {busy ? "Đang lưu…" : "Đặt khung"}
            </button>
          </>
        }
      >
        <div className="grid gap-3">
          {err ? <Callout tone="red">{err}</Callout> : null}
          <Field label="Họ tên *"><input className={inputCls} value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Điện thoại *"><input className={inputCls} inputMode="tel" value={form.phone} maxLength={30} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Ghi chú"><input className={inputCls} value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* ── Khung có khách: xem, nhận cọc, huỷ ── */}
      <Modal
        open={!!picked && picked.state !== "free"}
        onClose={close}
        icon={Clock}
        title={`Khung ${picked?.range ?? ""}`}
        desc={picked ? SLOT_STATE_LABEL[picked.state] + (picked.lock?.source === "manual" ? " · studio đặt tay" : " · khách đặt online") : undefined}
        footer={
          <>
            <button
              type="button"
              disabled={busy}
              className={btn("ghost")}
              style={{ color: "var(--rd)" }}
              onClick={() => {
                if (!picked?.lock) return;
                const paid = dep && (dep.deposit_status === "paid" || dep.deposit_status === "confirmed");
                if (!confirm(`Huỷ chỗ của ${picked.lock.customer_name || "khách"} lúc ${picked.range}? Khung sẽ trống lại cho khách khác.${paid ? `\n\nKhách đã chuyển cọc ${vnd(dep.deposit_amount)} — nhớ hoàn hoặc giữ cọc theo thoả thuận.` : ""}`)) return;
                void run({ action: "cancel", id: s.id, slotId: picked.lock.id }, close);
              }}
            >
              <X size={16} /> Huỷ chỗ
            </button>
            {hasDep && dep.deposit_status !== "confirmed" ? (
              <button type="button" disabled={busy} className={btn("primary")} onClick={() => picked?.lock && void run({ action: "confirm_deposit", id: s.id, slotId: picked.lock.id }, close)}>
                <Check size={16} /> Đã nhận cọc
              </button>
            ) : (
              <button type="button" onClick={close} className={btn("secondary")}>Đóng</button>
            )}
          </>
        }
      >
        {picked?.lock ? (
          <div className="grid gap-3">
            {err ? <Callout tone="red">{err}</Callout> : null}
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{picked.lock.customer_name || "Khách"}</p>
                <p className="v2-num text-[13px]" style={{ color: "var(--tx2)" }}>{picked.lock.customer_phone}</p>
              </div>
              {picked.lock.customer_phone ? <a href={`tel:${picked.lock.customer_phone}`} className={btn("secondary", "sm")}><Phone size={14} /> Gọi</a> : null}
            </div>
            {picked.lock.note ? <p className="whitespace-pre-wrap rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "var(--sf2)", color: "var(--tx2)" }}>{picked.lock.note}</p> : null}
            {hasDep ? (
              <div className="rounded-[12px] px-3 py-2.5" style={{ border: "1px solid var(--bd)" }}>
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-semibold">
                  <Landmark size={15} style={{ color: "var(--tx3)" }} /> Cọc {vnd(dep.deposit_amount)}
                  <Badge tone={dep.deposit_status === "confirmed" ? "green" : dep.deposit_status === "paid" ? "blue" : "amber"} dot>{DEPOSIT_STATUS_LABEL[dep.deposit_status]}</Badge>
                </p>
                {dep.deposit_code ? <p className="mt-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>Nội dung chuyển khoản: <b style={{ color: "var(--tx2)" }}>{dep.deposit_code}</b></p> : null}
                {picked.state === "held" ? (
                  <p className="mt-1 text-[12.5px]" style={{ color: toneFg("amber") }}>
                    Giữ chỗ thêm {holdMinutesLeft(picked.lock.hold_expires_at, now)} phút. Hết hạn mà khách chưa báo chuyển, khung tự trống lại.
                  </p>
                ) : null}
                {dep.deposit_proof_url ? <a href={dep.deposit_proof_url} target="_blank" rel="noreferrer" className={btn("ghost", "sm", "mt-2")}><ExternalLink size={14} /> Xem biên lai</a> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={showQr} onClose={() => setShowQr(false)} icon={QrCode} title="Mã QR của đợt chụp" desc="Khách quét là mở trang chọn khung giờ." width={380}>
        <div className="flex flex-col items-center gap-3">
          {qr ? (
            <img src={qr} alt="Mã QR link đợt chụp" width={240} height={240} className="rounded-[12px]" style={{ border: "1px solid var(--bd)" }} />
          ) : (
            <div className="h-[240px] w-[240px] rounded-[12px]" style={{ background: "var(--sf2)" }} />
          )}
          {qr ? <a href={qr} download={`dot-chup-${s.session_date}.png`} className={btn("secondary", "sm")}>Tải ảnh QR</a> : null}
        </div>
      </Modal>
    </>
  );
}

/* ── Tạo / sửa đợt ───────────────────────────────────────────────────────── */
function SessionForm({
  draft, setDraft, busy, err, onSave, hasBank,
}: {
  draft: Draft | null;
  setDraft: (d: Draft | null) => void;
  busy: boolean;
  err: string | null;
  onSave: () => void;
  hasBank: boolean;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => draft && setDraft({ ...draft, [k]: v });
  const start = parseHhmm(draft?.start);
  const end = parseHhmm(draft?.end);
  const n =
    draft && start != null && end != null && draft.slot_minutes >= 5
      ? slotStarts({ start_min: start, end_min: end, slot_minutes: draft.slot_minutes, gap_minutes: Math.max(0, draft.gap_minutes) }).length
      : 0;
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  return (
    <Modal
      open={!!draft}
      onClose={() => setDraft(null)}
      icon={CalendarClock}
      title={draft?.id ? "Sửa đợt chụp" : "Tạo đợt chụp"}
      width={560}
      footer={
        <>
          <button type="button" onClick={() => setDraft(null)} className={btn("ghost")}>Huỷ</button>
          <button type="button" onClick={onSave} disabled={busy || !draft?.title.trim() || !draft?.session_date || n === 0} className={btn("primary")}>
            <Save size={16} /> {busy ? "Đang lưu…" : draft?.id ? "Lưu" : "Tạo đợt"}
          </button>
        </>
      }
    >
      {draft ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {err ? <div className="sm:col-span-2"><Callout tone="red">{err}</Callout></div> : null}
          <Field label="Tên đợt *" className="sm:col-span-2">
            <input className={inputCls} value={draft.title} maxLength={120} placeholder="VD: Chụp áo dài Tết 2027" onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Ngày chụp *" className="sm:col-span-2">
            <DateInput className={inputCls} value={draft.session_date} onChange={(v) => set("session_date", v)} />
          </Field>
          <Field label="Giờ bắt đầu *"><input type="time" className={inputCls} value={draft.start} onChange={(e) => set("start", e.target.value)} /></Field>
          <Field label="Giờ kết thúc *"><input type="time" className={inputCls} value={draft.end} onChange={(e) => set("end", e.target.value)} /></Field>
          <Field label="Mỗi khung (phút) *"><input type="number" inputMode="numeric" min={5} max={480} className={inputCls} value={draft.slot_minutes || ""} onChange={(e) => set("slot_minutes", num(e.target.value))} /></Field>
          <Field label="Nghỉ giữa hai khung (phút)"><input type="number" inputMode="numeric" min={0} max={240} className={inputCls} value={draft.gap_minutes || ""} placeholder="0" onChange={(e) => set("gap_minutes", num(e.target.value))} /></Field>
          <p className="text-[12.5px] sm:col-span-2" style={{ color: n ? "var(--tx2)" : "var(--rd)" }}>
            {n ? <>Chia được <b>{n} khung</b>{start != null ? <> — khung đầu {hhmm(start)}, khung cuối {hhmm(start + (n - 1) * (draft.slot_minutes + Math.max(0, draft.gap_minutes)))}.</> : null}</> : "Khoảng giờ chưa đủ một khung nào."}
          </p>
          <Field label="Giá mỗi khung (đ)"><MoneyInput className={inputCls} value={draft.price} onChange={(v) => set("price", v)} ariaLabel="Giá mỗi khung" /></Field>
          <Field label="Cọc mỗi khung (đ)" hint={hasBank ? `0 = không cọc. Có cọc thì khung được giữ ${HOLD_MINUTES} phút chờ chuyển khoản.` : "Chưa khai tài khoản nhận tiền nên khách sẽ không thấy bước cọc."}>
            <MoneyInput className={inputCls} value={draft.deposit} onChange={(v) => set("deposit", v)} ariaLabel="Cọc mỗi khung" />
          </Field>
          <Field label="Địa điểm" className="sm:col-span-2">
            <input className={inputCls} value={draft.location} maxLength={200} placeholder="VD: Studio tầng 2, 12 Lê Lợi" onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Ghi chú cho khách" className="sm:col-span-2">
            <textarea className={`${inputCls} resize-none`} style={{ height: "auto", padding: "8px 12px" }} rows={3} maxLength={1000} value={draft.note} placeholder="VD: Đến trước 10 phút, mang theo áo dài." onChange={(e) => set("note", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={draft.is_open} onChange={(v) => set("is_open", v)} label="Nhận khách đặt online" desc="Tắt để tạm đóng link; bạn vẫn đặt tay được." />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
