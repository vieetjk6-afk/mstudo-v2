"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import { Check, Printer, X } from "lucide-react";
import { fmtDate } from "@/lib/date";
import { ICON_HALO } from "@/lib/album-icon";
import type { PrintState } from "@/lib/album-print-rules";

/* ═══════════════════════════════════════════════════════════════════════════
   CHỌN ẢNH IN TẶNG — album giao khách của hợp đồng có tặng ảnh in.

   Khách bấm "Chọn ảnh in" → mỗi ảnh có nút chọn in, thanh dưới đáy đếm x/N.
   Chọn xong bấm "Gửi cho studio" — CHỈ lúc đó mới ghi lên máy chủ, để studio
   thấy đúng danh sách khách đã chốt. Lựa chọn dở dang giữ trong trình duyệt
   (localStorage) để đóng trang mở lại không mất.
   ═══════════════════════════════════════════════════════════════════════════ */

const draftKey = (slug: string) => `mstudo-print-draft:${slug}`;

function readDraft(slug: string): string[] | null {
  try {
    const raw = localStorage.getItem(draftKey(slug));
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null;
  } catch {
    return null;
  }
}

function writeDraft(slug: string, ids: string[] | null) {
  try {
    if (ids) localStorage.setItem(draftKey(slug), JSON.stringify(ids));
    else localStorage.removeItem(draftKey(slug));
  } catch {
    /* chế độ ẩn danh / chặn lưu trữ → chỉ mất bản nháp */
  }
}

const sameSet = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x));

const ERRORS: Record<string, string> = {
  limit_exceeded: "Bạn chọn nhiều hơn số ảnh in được tặng.",
  locked: "Studio đã chuyển ảnh của bạn đi in nên không đổi được nữa. Cần đổi, bạn liên hệ studio nhé.",
  empty: "Bạn chưa chọn ảnh nào.",
  wrong_password: "Phiên xem album đã hết hạn — tải lại trang, nhập lại mật khẩu rồi gửi lại.",
  not_enabled: "Album này không có ảnh in tặng.",
  not_ready: "Studio chưa bật tính năng chọn ảnh in. Bạn liên hệ studio nhé.",
};

export function usePrintPicks(slug: string, print: PrintState | null | undefined, access: string | undefined) {
  const quota = print?.quota ?? 0;
  const [sent, setSent] = useState<Set<string>>(() => new Set(print?.picks ?? []));
  const [sentAt, setSentAt] = useState<string | null>(print?.sentAt ?? null);
  const locked = !!print?.copiedAt;
  const [picks, setPicks] = useState<Set<string>>(() => new Set(print?.picks ?? []));
  const [mode, setMode] = useState(false);
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Bản nháp chưa gửi (mở lại trang không mất). Đọc sau khi mount: localStorage
  // không có ở máy chủ, đọc lúc khởi tạo state là lệch HTML lúc hydrate.
  useEffect(() => {
    if (!quota || locked) return;
    const d = readDraft(slug);
    if (d && d.length) setPicks(new Set(d.slice(0, quota)));
  }, [slug, quota, locked]);

  const dirty = useMemo(() => !sameSet(picks, sent), [picks, sent]);
  // Khách còn việc phải làm: được tặng in mà chưa gửi (hoặc đã sửa sau khi gửi).
  const needsAction = quota > 0 && !locked && !(sentAt && !dirty);

  function toggle(id: string, printable: boolean) {
    if (locked || !printable) return;
    const next = new Set(picks);
    if (next.has(id)) next.delete(id);
    else if (next.size >= quota) {
      setMsg({ ok: false, text: `Đã đủ ${quota} ảnh in — bỏ chọn một ảnh để đổi ảnh khác.` });
      return;
    } else next.add(id);
    setMsg(null);
    setPicks(next);
    writeDraft(slug, [...next]);
  }

  async function send() {
    if (busy || locked || picks.size === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/album/${slug}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: [...picks], access }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: ERRORS[d.error as string] ?? "Chưa gửi được, bạn thử lại sau ít phút." });
        return;
      }
      const saved = new Set<string>(Array.isArray(d.picks) ? d.picks : [...picks]);
      setSent(saved);
      setPicks(saved);
      setSentAt(d.sentAt ?? new Date().toISOString());
      writeDraft(slug, null);
      setMsg({ ok: true, text: `Đã gửi ${saved.size} ảnh in cho studio. Cảm ơn bạn!` });
      setMode(false);
      setOnlyPicked(false);
    } catch {
      setMsg({ ok: false, text: "Mất kết nối — bạn kiểm tra mạng rồi bấm gửi lại." });
    } finally {
      setBusy(false);
    }
  }

  return {
    enabled: quota > 0,
    quota,
    picks,
    sentCount: sent.size,
    sentAt,
    locked,
    dirty,
    needsAction,
    mode,
    onlyPicked,
    busy,
    msg,
    toggle,
    send,
    open: (only = false) => {
      setMode(true);
      setOnlyPicked(only);
      setMsg(null);
    },
    close: () => {
      setMode(false);
      setOnlyPicked(false);
    },
    setOnlyPicked,
  };
}

export type PrintPicks = ReturnType<typeof usePrintPicks>;

/**
 * Thẻ giới thiệu ngay trên lưới ảnh: được tặng bao nhiêu ảnh, đã gửi chưa.
 * `cardRef`: nút "Xem album" ở ảnh bìa cuộn tới ĐÂY (không phải thẳng xuống lưới)
 * khi khách còn chưa gửi ảnh in — cuộn thẳng xuống lưới là khách lướt qua thẻ.
 */
export function PrintCard({ pp, cardRef }: { pp: PrintPicks; cardRef?: RefObject<HTMLDivElement | null> }) {
  if (!pp.enabled) return null;
  let title: string;
  let note: string;
  let cta: string;
  if (pp.locked) {
    title = `Studio đã chuyển ${pp.sentCount} ảnh của bạn đi in`;
    note = "Ảnh in sẽ được giao cùng sản phẩm của hợp đồng.";
    cta = "Xem ảnh đã chọn";
  } else if (pp.sentAt && !pp.dirty) {
    title = `Bạn đã gửi ${pp.sentCount}/${pp.quota} ảnh in cho studio`;
    note = `Gửi ngày ${fmtDate(pp.sentAt)}. Muốn đổi thì chọn lại rồi bấm gửi lại — trước khi studio chuyển đi in.`;
    cta = "Sửa ảnh in";
  } else {
    title = `Bạn được tặng ${pp.quota} ảnh in`;
    note = "Chọn những tấm bạn muốn in rồi bấm “Gửi cho studio”.";
    cta = pp.picks.size > 0 ? `Tiếp tục chọn (${pp.picks.size}/${pp.quota})` : "Chọn ảnh in";
  }
  return (
    <div ref={cardRef} className="mt-5 flex scroll-mt-20 flex-wrap items-center gap-3 rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--gold) 16%, transparent)", color: "var(--gold)" }}>
        <Printer size={19} />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14.5px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text2)" }}>{note}</p>
      </div>
      {!pp.mode && (
        <button type="button" onClick={() => pp.open(pp.locked)} className="btn-primary px-4 py-2 text-[13px]">
          <Printer size={15} /> {cta}
        </button>
      )}
      {pp.msg && !pp.mode && (
        <p className="w-full text-[12.5px]" style={{ color: pp.msg.ok ? "var(--success)" : "var(--danger)" }}>{pp.msg.text}</p>
      )}
    </div>
  );
}

/**
 * Nút nổi "Chọn ảnh in" ở đáy màn hình — khách cuộn tới đâu cũng thấy, cho tới
 * khi gửi xong. Ẩn khi thẻ giới thiệu đang nằm trong màn hình (đỡ hai nút cùng
 * một việc) và khi đang chọn (thanh dưới đáy đã thay chỗ).
 */
export function PrintFab({ pp, cardRef }: { pp: PrintPicks; cardRef: RefObject<HTMLDivElement | null> }) {
  const [cardInView, setCardInView] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCardInView(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [cardRef, pp.enabled]);
  if (!pp.needsAction || pp.mode || cardInView) return null;
  // Căn giữa bằng khung bao, KHÔNG bằng translate trên chính nút: .btn-primary
  // dùng transform cho hiệu ứng bấm (scale), đè mất translate → nút nhảy lệch
  // sang phải đúng lúc khách chạm vào và bấm hụt.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <button
        type="button"
        onClick={() => pp.open()}
        className="btn-primary pointer-events-auto px-5 py-2.5 text-[14px]"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}
      >
        <Printer size={16} />
        {pp.picks.size > 0 ? `Tiếp tục chọn ảnh in (${pp.picks.size}/${pp.quota})` : `Chọn ${pp.quota} ảnh in tặng`}
      </button>
    </div>
  );
}

/** Thanh dưới đáy khi đang chọn ảnh in: đếm x/N, lọc ảnh đã chọn, gửi. */
export function PrintBar({ pp }: { pp: PrintPicks }) {
  if (!pp.enabled || !pp.mode) return null;
  const full = pp.picks.size >= pp.quota;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
      style={{ background: "color-mix(in srgb, var(--bg) 92%, transparent)", backdropFilter: "blur(16px)", borderTop: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold">
          <Printer size={16} style={{ color: "var(--gold)" }} />
          Ảnh in: <span style={{ color: full ? "var(--gold)" : undefined }}>{pp.picks.size}/{pp.quota}</span>
        </span>
        <label className="ml-1 flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--text2)" }}>
          <input type="checkbox" checked={pp.onlyPicked} onChange={(e) => pp.setOnlyPicked(e.target.checked)} />
          Chỉ xem ảnh đã chọn
        </label>
        <div className="ml-auto flex items-center gap-2">
          {!pp.locked && (
            <button type="button" onClick={pp.send} disabled={pp.busy || pp.picks.size === 0 || (!pp.dirty && !!pp.sentAt)} className="btn-primary px-4 py-2 text-[13px] disabled:opacity-50">
              {pp.busy ? "Đang gửi…" : pp.sentAt ? "Gửi lại cho studio" : "Gửi cho studio"}
            </button>
          )}
          <button type="button" onClick={pp.close} aria-label="Đóng chọn ảnh in" className="btn-ghost px-3 py-2 text-[13px]">
            <X size={15} /> {pp.locked ? "Đóng" : "Xong"}
          </button>
        </div>
        {pp.msg && (
          <p className="w-full text-[12.5px]" style={{ color: pp.msg.ok ? "var(--success)" : "var(--danger)" }}>{pp.msg.text}</p>
        )}
      </div>
    </div>
  );
}

/** Nút chọn in trên từng ô ảnh / trong khung xem ảnh lớn. */
export function PrintToggle({ picked, disabled, onToggle, size = "sm" }: { picked: boolean; disabled?: boolean; onToggle: () => void; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const dot = size === "lg" ? 26 : 22;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      aria-pressed={picked}
      aria-label={picked ? "Bỏ chọn in ảnh này" : "Chọn in ảnh này"}
      title={picked ? "Bỏ chọn in ảnh này" : "Chọn in ảnh này"}
      className={`flex ${box} items-center justify-center transition-transform active:scale-90 disabled:opacity-40`}
      style={{ filter: ICON_HALO }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: dot,
          height: dot,
          background: picked ? "var(--gold)" : "rgba(0,0,0,.25)",
          border: picked ? "none" : "2px solid #fff",
          color: "#fff",
        }}
      >
        {picked && <Check size={dot - 8} strokeWidth={3} />}
      </span>
    </button>
  );
}
