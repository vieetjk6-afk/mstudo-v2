"use client";

import { Check, Copy, ExternalLink, CalendarRange, Share2, Users, type LucideIcon } from "lucide-react";
import ZaloSendButton from "@/components/ZaloSendButton";
import { btn, toneBg, toneFg, type Tone } from "@/components/v2/kit";
import { daysFromToday, fmtDayMonth, fmtDow } from "@/lib/date";
import type { ContractKind } from "@/lib/contract-kind";
import type { ContractStatus } from "@/lib/types";
import type { ContractEditorState, CrewRow } from "./useContractEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh dùng chung của màn chi tiết hợp đồng — giao diện mới (ContractDetailV2
   và các tab ContractV2*.tsx). Không có logic dữ liệu: mọi thao tác đi qua
   useContractEditor, giống hệt bản cũ.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Ed = ContractEditorState;

/** Khoá tab — trùng khoá của bản cũ để link ?tab=pay|crew|send… mở đúng chỗ. */
export type V2Tab = "info" | "items" | "pay" | "crew" | "album" | "rental" | "send";

export type AskOpts = {
  title: string;
  desc?: React.ReactNode;
  /** Chữ trên nút xác nhận. */
  confirm: string;
  danger?: boolean;
  run: () => unknown;
};

/** Những gì một tab cần ngoài state: chuyển tab, hỏi xác nhận, mở các hộp thoại chung. */
export type V2Ctx = {
  ed: Ed;
  /** Chuyển tab; `anchor` = id khối cần cuộn tới sau khi chuyển. */
  go: (t: V2Tab, anchor?: string) => void;
  ask: (o: AskOpts) => void;
  openSend: () => void;
  /** Hộp thoại "Ghi nhận thanh toán" — truyền id đợt để chọn sẵn đợt đó. */
  openCollect: (planId?: string | null) => void;
  /** Hộp thoại thêm đợt thu (form đầy đủ). */
  openAddPlan: (prefill?: { label: string; amount: number }) => void;
  openInfo: () => void;
  openQr: (q: { amount: number; addInfo: string; title: string }) => void;
  /** Ngăn kéo sửa / thêm một người trong ê-kíp; `eventId` = gán sẵn vào buổi đó. */
  openCrew: (idx: number | null, eventId?: string) => void;
};

export const STATUS_TONE: Record<ContractStatus, Tone> = {
  draft: "gray",
  sent: "amber",
  approved: "blue",
  in_progress: "teal",
  post_production: "violet",
  completed: "green",
  cancelled: "red",
};

export const CREW_TONE: Record<string, Tone> = { pending: "amber", accepted: "green", declined: "red" };

/** Màu chữ theo tone (cho số tiền, dòng phụ). */
export const toneText = (t: Tone) =>
  ({ green: "var(--gn)", amber: "var(--am)", red: "var(--rd)", blue: "var(--bl)", brand: "var(--ac)", gray: "var(--tx3)", violet: "var(--pu)", teal: "var(--tl)" })[t];

/** "Hôm nay" / "Ngày mai" / "Còn 5 ngày" / "3 ngày trước". */
export function relDay(iso: string | null | undefined): { text: string; tone: Tone } | null {
  if (!iso) return null;
  const d = daysFromToday(iso);
  if (d === null) return null;
  if (d === 0) return { text: "Hôm nay", tone: "red" };
  if (d === 1) return { text: "Ngày mai", tone: "amber" };
  if (d > 1 && d <= 7) return { text: `Còn ${d} ngày`, tone: "amber" };
  if (d > 7) return { text: `Còn ${d} ngày`, tone: "gray" };
  return { text: `${-d} ngày trước`, tone: "gray" };
}

/** Ô lịch nhỏ: thứ · ngày · tháng. */
export function DateTile({ iso, muted = false, size = 52 }: { iso: string | null; muted?: boolean; size?: number }) {
  const [, m, d] = (iso ?? "").split("-");
  return (
    <span
      className="flex flex-none flex-col items-center justify-center rounded-[12px] leading-none"
      style={{
        width: size,
        height: size,
        background: muted || !iso ? "var(--sf2)" : "var(--acS)",
        color: muted || !iso ? "var(--tx3)" : "var(--ac)",
      }}
      aria-hidden
    >
      {iso ? (
        <>
          <span className="text-[10.5px] font-semibold uppercase">{fmtDow(iso)}</span>
          <span className="mt-0.5 text-[19px] font-bold tracking-[-0.4px]">{Number(d)}</span>
          <span className="mt-0.5 text-[10.5px] font-medium">th{Number(m)}</span>
        </>
      ) : (
        <span className="text-[11px] font-semibold">—</span>
      )}
    </span>
  );
}

/* ── Buổi chụp: buổi chính (ngày của hợp đồng) + từng mốc lịch ───────────── */
export type Session = {
  key: string;
  /** id mốc lịch; null = buổi chính. */
  id: string | null;
  title: string;
  date: string | null;
  time: string | null;
  main: boolean;
  /** Người được gán vào buổi này (kể cả người đã từ chối). */
  crew: { row: CrewRow; idx: number }[];
};

export function mainSessionTitle(kind: ContractKind) {
  return kind === "makeup" ? "Buổi làm chính" : "Buổi chụp chính";
}

export function sessionsOf(ed: Ed): Session[] {
  const msIds = new Set(ed.milestones.map((m) => m.id));
  const withIdx = ed.crew.map((row, idx) => ({ row, idx }));
  const main: Session = {
    key: "main",
    id: null,
    title: mainSessionTitle(ed.kind),
    date: ed.f.event_date || null,
    time: ed.f.event_time || null,
    main: true,
    // Người gán vào mốc đã bị xoá: DB đưa về buổi chính — vẽ đúng như vậy.
    crew: withIdx.filter((c) => !c.row.eventId || !msIds.has(c.row.eventId)),
  };
  return [
    main,
    ...ed.milestones.map((m) => ({
      key: m.id,
      id: m.id,
      title: m.title,
      date: m.event_date,
      time: m.event_time ?? null,
      main: false,
      crew: withIdx.filter((c) => c.row.eventId === m.id),
    })),
  ];
}

/** Buổi sắp tới gần nhất (từ hôm nay); không có thì null. */
export function nextSession(list: Session[], today: string): Session | null {
  return (
    list
      .filter((s) => s.date && s.date >= today)
      .sort((a, b) => (a.date! + (a.time || "99")).localeCompare(b.date! + (b.time || "99")))[0] ?? null
  );
}

export function sessionWhen(s: { date: string | null; time: string | null }) {
  if (!s.date) return "Chưa có ngày";
  return `${fmtDow(s.date)}, ${fmtDayMonth(s.date)}/${s.date.slice(0, 4)}${s.time ? ` · ${s.time}` : ""}`;
}

/* ── Vòng đời 7 bước — cùng nhãn với ContractStepper của bản cũ ───────────── */
export function lifecycleSteps(kind: ContractKind): { key: keyof Ed["lifecycle"]; label: string }[] {
  const dau = [
    { key: "hasItems", label: "Báo giá" },
    { key: "signed", label: "Ký hợp đồng" },
    { key: "hasCrew", label: "Phân công" },
    { key: "hasDeposit", label: "Nhận cọc" },
  ] as const;
  const cuoi =
    kind === "makeup"
      ? ([
          { key: "shot", label: "Ngày làm" },
          { key: "postDone", label: "Trả đồ" },
          { key: "delivered", label: "Hoàn tất" },
        ] as const)
      : ([
          { key: "shot", label: "Chụp" },
          { key: "postDone", label: "Hậu kỳ" },
          { key: "delivered", label: "Giao album" },
        ] as const);
  return [...dau, ...cuoi];
}

/** Thanh tiến độ 7 đoạn + tên bước hiện tại. */
export function LifeBar({ ed }: { ed: Ed }) {
  const steps = lifecycleSteps(ed.kind);
  const cur = steps.findIndex((s) => !ed.lifecycle[s.key]);
  const doneAll = cur === -1;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span style={{ color: "var(--tx3)" }}>Tiến độ hợp đồng</span>
        <span className="truncate font-semibold" style={{ color: doneAll ? "var(--gn)" : "var(--tx)" }}>
          {doneAll ? "Đã xong cả 7 bước" : `Bước ${cur + 1}/7 · ${steps[cur].label}`}
        </span>
      </div>
      <ol className="mt-2 grid grid-cols-7 gap-1" aria-label="Các bước của hợp đồng">
        {steps.map((s, i) => {
          const done = ed.lifecycle[s.key];
          const now = i === cur;
          return (
            <li key={s.key} className="min-w-0" title={`${s.label}${done ? " · xong" : now ? " · đang ở bước này" : ""}`}>
              <span
                className="block h-[5px] rounded-full"
                style={{ background: done ? "var(--gn)" : now ? "var(--ac)" : "var(--bd2)" }}
              />
              <span
                className="mt-1.5 hidden truncate text-[11px] md:block"
                style={{ color: done ? "var(--gn)" : now ? "var(--ac)" : "var(--tx3)", fontWeight: done || now ? 600 : 500 }}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ── Gửi cổng khách: một chỗ duy nhất, dùng ở hộp thoại lẫn tab Ký & gửi ──── */
export function SendOptions({ ed }: { ed: Ed }) {
  const { f, props } = ed;
  const c = props.contract;
  const full = btn("secondary", "md", "w-full !justify-start");
  return (
    <div className="flex flex-col gap-2">
      <ZaloSendButton
        phone={f.client_phone}
        name={f.client_name}
        audience="client"
        contractId={c.id}
        savedName={c.zalo_name}
        kind="contract_share"
        label="Gửi Zalo"
        show="send"
        className={full}
        message={ed.clientPortalMsg}
      />
      <ZaloSendButton
        phone={f.client_phone}
        name={f.client_name}
        audience="client"
        contractId={c.id}
        savedName={c.zalo_name}
        kind="contract_share"
        show="friends"
        friendsLabel="Chọn từ danh sách bạn Zalo"
        className={full}
        message={ed.clientPortalMsg}
      />
      <button type="button" onClick={ed.quickShare} className={full}>
        <Share2 size={16} /> Gửi nhanh qua chia sẻ
      </button>
      <button type="button" onClick={ed.copyShareUrl} className={full}>
        {ed.copied ? <Check size={16} style={{ color: "var(--gn)" }} /> : <Copy size={16} />}
        {ed.copied ? "Đã chép lời nhắn" : "Chép link kèm lời nhắn"}
      </button>
    </div>
  );
}

/** Hai link mở trang khách (xem như khách · trang riêng). */
export function ClientLinks({ ed, className = "" }: { ed: Ed; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={ed.shareUrl} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
        <ExternalLink size={15} /> Xem như khách
      </a>
      <a href={ed.portalUrl} target="_blank" rel="noreferrer" className={btn("ghost", "sm")}>
        <CalendarRange size={15} /> Trang riêng của khách
      </a>
    </div>
  );
}

/** Dòng "Khách xem lần cuối …" — màu xanh khi khách đã mở. */
export function ViewedLine({ ed }: { ed: Ed }) {
  return (
    <p className="text-[12.5px]" style={{ color: ed.clientViewedAt ? "var(--gn)" : "var(--tx3)" }}>
      {ed.clientViewedAt ? `Khách xem lần cuối · ${ed.clientViewedAt}` : "Khách chưa mở link hợp đồng"}
    </p>
  );
}

/** Ảnh chuyển khoản thu nhỏ — bấm để phóng to. */
export function ProofThumb({ url, onOpen, size = 36 }: { url: string; onOpen: (u: string) => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(url)}
      className="flex-none cursor-zoom-in overflow-hidden rounded-[8px]"
      style={{ width: size, height: size, border: "1px solid var(--bd)" }}
      title="Phóng to ảnh chuyển khoản"
      aria-label="Phóng to ảnh chuyển khoản"
    >
      <img src={url} alt="" className="h-full w-full object-cover" />
    </button>
  );
}

/**
 * Thanh "Có thay đổi chưa lưu" cuối một khối. Máy tính: dính đáy màn hình để
 * nút lưu luôn trong tầm tay; điện thoại: nằm ngay dưới danh sách (đáy màn đã
 * có thanh tab và nút + nổi).
 */
export function SaveBar({
  show,
  busy,
  label,
  busyLabel = "Đang lưu…",
  onSave,
  note = "Có thay đổi chưa lưu",
}: {
  show: boolean;
  busy: boolean;
  label: string;
  busyLabel?: string;
  onSave: () => void;
  note?: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="z-10 lg:sticky lg:bottom-4">
      <div
        className="flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3"
        style={{
          background: "var(--sf)",
          border: "1px solid color-mix(in srgb, var(--am) 40%, var(--bd))",
          boxShadow: "0 10px 30px -12px rgba(15, 30, 55, 0.28)",
        }}
        role="status"
      >
        <span className="h-2 w-2 flex-none rounded-full" style={{ background: "var(--am)" }} />
        <p className="min-w-0 flex-1 text-[13.5px] font-medium">{note}</p>
        <button type="button" onClick={onSave} disabled={busy} className={btn("primary")}>
          {busy ? busyLabel : label}
        </button>
      </div>
    </div>
  );
}

/** Cụm avatar chữ cái chồng lên nhau (ê-kíp của một buổi). */
export function CrewFaces({ rows, max = 4 }: { rows: CrewRow[]; max?: number }) {
  if (!rows.length) return null;
  return (
    <span className="flex items-center" title={rows.map((r) => r.name || r.phone).filter(Boolean).join(", ")}>
      {rows.slice(0, max).map((r, i) => (
        <span
          key={r.id ?? `n${i}`}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            marginLeft: i ? -5 : 0,
            boxShadow: "0 0 0 2px var(--sf)",
            background: "var(--acS)",
            color: "var(--ac)",
          }}
        >
          {initialsOf(r.name || r.phone || "?")}
        </span>
      ))}
      {rows.length > max && (
        <span
          className="flex h-7 min-w-7 flex-none items-center justify-center rounded-full px-1 text-[10px] font-semibold"
          style={{ marginLeft: -5, boxShadow: "0 0 0 2px var(--sf)", background: "var(--sf2)", color: "var(--tx2)" }}
        >
          +{rows.length - max}
        </span>
      )}
    </span>
  );
}

export function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(-2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Nhãn "N người" + icon. */
export function PeopleCount({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: "var(--tx3)" }}>
      <Users size={14} /> {n} người
    </span>
  );
}

/* ── Khối quà tặng khách (kế hoạch cưới, thiệp, Love Story, xin đánh giá) ──
   Thẻ con nằm trong khối "Quà tặng khách & xin đánh giá" của tab Sản phẩm:
   icon · tên · nhãn trạng thái · MỘT nút bên phải, thân bên dưới. */
export function GiftBlock({
  icon: Icon,
  tone = "brand",
  title,
  badge,
  desc,
  action,
  children,
  muted = false,
  testId,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: React.ReactNode;
  badge?: React.ReactNode;
  desc?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  muted?: boolean;
  testId?: string;
}) {
  return (
    <div className="rounded-[14px] p-4" style={{ border: "1px solid var(--bd)", background: "var(--sf)", opacity: muted ? 0.8 : 1 }} data-testid={testId}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2.5">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: toneBg(tone), color: toneFg(tone) }}>
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-[1_1_200px]">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[14px] font-semibold">{title}</p>
            {badge}
          </div>
          {desc ? (
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--tx3)" }}>
              {desc}
            </p>
          ) : null}
        </div>
        {action ? <div className="ml-auto flex flex-none flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="mt-3.5 flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}

/** Một link gửi khách (link sửa / link xem): nhãn · đường dẫn · các nút. */
export function LinkRow({
  icon: Icon,
  label,
  url,
  href,
  meta,
  children,
}: {
  icon: LucideIcon;
  label: React.ReactNode;
  url: string;
  /** Có thì đường dẫn bấm được (mở tab mới). */
  href?: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] px-3 py-2.5" style={{ background: "var(--sf2)" }}>
      <Icon size={16} className="flex-none" style={{ color: "var(--tx3)" }} />
      <div className="min-w-0 flex-[1_1_180px]">
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-medium" style={{ color: "var(--tx3)" }}>
          {label}
          {meta}
        </p>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="block truncate text-[13px] underline-offset-2 hover:underline" style={{ color: "var(--tx2)" }}>
            {url}
          </a>
        ) : (
          <p className="truncate text-[13px]" style={{ color: "var(--tx2)" }}>
            {url}
          </p>
        )}
      </div>
      {children ? <div className="flex max-w-full flex-wrap items-center gap-1.5">{children}</div> : null}
    </div>
  );
}
