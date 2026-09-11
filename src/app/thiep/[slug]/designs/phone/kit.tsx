import type { CSSProperties, ReactNode } from "react";
import type { WeddingBank, WeddingConfig, WeddingInvitation } from "@/lib/types";
import { mapEmbedSrc, mapOpenHref } from "@/lib/site-map";
import { vietqrUrl, type Wish } from "../../shared";
import PhoneCountdown from "./PhoneCountdown";
import QuickRsvp from "./QuickRsvp";

export { PhoneCountdown, QuickRsvp };
export type { Wish };

// ────────────────────────────────────────────────────────────────────────────
// Bộ dùng chung của 10 mẫu "thiệp điện thoại".
//
// CHỈ gồm phần ĐỌC DỮ LIỆU và vài mảnh hạ tầng (khung ngoài, ô ảnh, bản đồ,
// đếm ngược, nút RSVP). KHÔNG có khối bố cục dùng chung: hai họ, chân dung,
// lưới dặn dò, sổ lưu bút, thẻ mừng cưới… mỗi mẫu tự dựng lấy.
//
// Vì sao: bản trước gom cả những khối đó vào đây, nên cả 10 mẫu dùng đúng một
// bộ component và chỉ khác bảng màu — nhìn vào là thấy cùng một tấm thiệp tô
// lại. Khác biệt về BỐ CỤC phải nằm ở từng mẫu thì mới thật sự khác nhau.
// ────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const two = (n: number) => String(n).padStart(2, "0");

export type DateBits = {
  /** "20" */ day: string;
  /** "12" */ month: string;
  /** "2026" */ year: string;
  /** "Chủ Nhật" */ weekday: string;
  /** "20 · 12 · 2026" */ spaced: string;
  /** "20.12.2026" */ dotted: string;
  /** "20/12" */ slash: string;
  /** "20.12.26" */ short: string;
  valid: boolean;
};

export function dateBits(iso?: string): DateBits {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) {
    return { day: "—", month: "—", year: "", weekday: "", spaced: "", dotted: "", slash: "", short: "", valid: false };
  }
  const day = two(d.getDate());
  const month = two(d.getMonth() + 1);
  const year = String(d.getFullYear());
  return {
    day, month, year,
    weekday: WEEKDAYS[d.getDay()],
    spaced: `${day} · ${month} · ${year}`,
    dotted: `${day}.${month}.${year}`,
    slash: `${day}/${month}`,
    short: `${day}.${month}.${year.slice(2)}`,
    valid: true,
  };
}

export type InfoItem = { label: string; value?: string; swatches?: string[] };
export type PhoneEvent = { label: string; time?: string; date?: string; where?: string };
export type Portrait = { role: string; name: string; photo?: string; sub?: string };
export type Gift = { title: string; qr: string; bank: WeddingBank; fallbackName: string };

export type PhoneData = {
  c: WeddingConfig;
  slug: string;
  groom: string;
  bride: string;
  accent?: string;
  guest?: string;
  guestLabel: string;
  date: DateBits;
  countdownTo?: string;
  lunar?: string;
  location?: string;
  /** "Nhằm 12/11 Âm lịch · Hà Nội" */ dateSub?: string;
  reception?: string;
  quote?: string;
  story?: string;
  hero?: string;
  /** 2 ô ảnh phụ. */ pair: string[];
  /** 3 ô album. */ trio: string[];
  /** Mọi ảnh theo đúng thứ tự cặp đôi xếp. */ photos: string[];
  events: PhoneEvent[];
  venue: { name?: string; address?: string; mapUrl?: string };
  mapEmbed: string | null;
  mapHref: string | null;
  mapImage?: string;
  families: { groom?: string; bride?: string };
  hasFamilies: boolean;
  infos: InfoItem[];
  portraits: Portrait[];
  gifts: Gift[];
  giftNote?: string;
  closing?: string;
  thanks?: string;
  thanksPhoto?: string;
  rsvpOn: boolean;
  wishesOn: boolean;
};

/** Đọc config của thiệp thành dữ liệu render-ready cho các mẫu điện thoại. */
export function phoneData(inv: WeddingInvitation, guest?: string): PhoneData {
  const c = (inv.config ?? {}) as WeddingConfig;
  const groom = c.groom_name?.trim() || "Chú rể";
  const bride = c.bride_name?.trim() || "Cô dâu";

  const photos = (c.gallery ?? []).filter(Boolean);
  const hero = c.cover_url || photos[0];
  const rest = photos.filter((u) => u !== hero);

  const rawEvents = (c.events ?? []).filter((e) => e.label || e.date || e.time || e.venue);
  const events: PhoneEvent[] = rawEvents.map((e) => ({
    label: e.label?.trim() || "Sự kiện",
    time: e.time?.trim() || undefined,
    date: e.date ? dateBits(e.date).slash : undefined,
    where: [e.venue?.trim(), e.address?.trim()].filter(Boolean).join(" — ") || undefined,
  }));

  // Địa điểm chính: ưu tiên field riêng, sau đó sự kiện CÓ địa chỉ cuối cùng
  // (thường là tiệc cưới), cuối cùng là sự kiện đầu tiên.
  const withVenue = [...rawEvents].reverse().find((e) => e.venue || e.address) ?? rawEvents[0];
  const venue = {
    name: c.venue_name?.trim() || withVenue?.venue?.trim() || undefined,
    address: c.venue_address?.trim() || withVenue?.address?.trim() || undefined,
    mapUrl: c.map_url?.trim() || withVenue?.map_url?.trim() || undefined,
  };

  const dress = (c.dress_code ?? []).filter(Boolean);
  const infos: InfoItem[] = [
    { label: "Trang phục", value: c.dress_code_note?.trim() || undefined, swatches: dress.length ? dress : undefined },
    { label: "Hashtag", value: c.hashtag?.trim() || undefined },
    { label: "Gửi xe", value: c.parking_note?.trim() || undefined },
    { label: "Hotline", value: c.hotline?.trim() || undefined },
  ].filter((i) => i.value || i.swatches?.length);

  const portraits: Portrait[] = [
    { role: c.bride_role?.trim() || "Cô dâu", name: bride, photo: c.bride_photo || undefined, sub: c.bride_subtitle?.trim() || undefined },
    { role: c.groom_role?.trim() || "Chú rể", name: groom, photo: c.groom_photo || undefined, sub: c.groom_subtitle?.trim() || undefined },
  ];
  const hasPortraits = !!(c.bride_photo || c.groom_photo || c.bride_role || c.groom_role || c.bride_subtitle || c.groom_subtitle);

  const gifts: Gift[] = c.gift_enabled
    ? ([
        { title: "chú rể", bank: c.groom_bank, fallbackName: groom },
        { title: "cô dâu", bank: c.bride_bank, fallbackName: bride },
      ]
        .map((g) => ({ ...g, qr: vietqrUrl(g.bank) }))
        .filter((g): g is Gift => !!g.qr))
    : [];

  return {
    c,
    slug: inv.slug,
    groom,
    bride,
    accent: c.accent,
    guest: guest?.trim() || undefined,
    guestLabel: c.guest_greeting?.trim() || "Trân trọng kính mời",
    date: dateBits(c.wedding_date),
    countdownTo: c.wedding_date,
    lunar: c.lunar_date?.trim() || undefined,
    location: c.location?.trim() || undefined,
    dateSub: [c.lunar_date?.trim(), c.location?.trim()].filter(Boolean).join(" · ") || undefined,
    reception: c.reception_time?.trim() || undefined,
    quote: c.cover_quote?.trim() || undefined,
    story: c.story?.trim() || undefined,
    hero,
    pair: rest.slice(0, 2),
    trio: rest.slice(2, 5),
    photos,
    events,
    venue,
    mapEmbed: mapEmbedSrc(venue.mapUrl ?? "", venue.address ?? ""),
    mapHref: mapOpenHref(venue.mapUrl ?? "", venue.address ?? ""),
    mapImage: c.map_image?.trim() || undefined,
    families: { groom: c.groom_family?.trim() || undefined, bride: c.bride_family?.trim() || undefined },
    hasFamilies: !!(c.groom_family?.trim() || c.bride_family?.trim()),
    infos,
    portraits: hasPortraits ? portraits : [],
    gifts,
    giftNote: c.gift_note?.trim() || undefined,
    closing: c.closing_line?.trim() || undefined,
    thanks: c.thanks_note?.trim() || undefined,
    thanksPhoto: c.thanks_photo || undefined,
    rsvpOn: c.rsvp_enabled !== false,
    wishesOn: c.guestbook_enabled !== false,
  };
}

// ── Khung ngoài ─────────────────────────────────────────────────────────────

/**
 * Nền trang + khung thiệp giữa màn hình. Trên điện thoại thiệp chiếm trọn bề
 * ngang; trên máy tính nó co lại còn một "tấm thiệp" 430px đứng giữa nền tối.
 *
 * `rail` dựng một cột dọc hẹp chạy SUỐT chiều cao thiệp (mẫu Sơn mài dùng cho
 * dải chữ dọc); để trống thì nội dung chiếm trọn bề ngang như bình thường.
 */
export function PhoneShell({
  card, page, ink, font, accent, children, radius = 0, pattern, rail, railWidth = 44,
}: {
  card: string;
  page: string;
  ink: string;
  font: string;
  accent: string;
  radius?: number;
  pattern?: ReactNode;
  rail?: ReactNode;
  railWidth?: number;
  children: ReactNode;
}) {
  const root: CSSProperties & Record<string, string> = {
    "--wed-accent": accent,
    background: page, minHeight: "100vh", display: "flex", justifyContent: "center", padding: "0",
  };
  return (
    <main style={root}>
      <div
        className="wed-phone-card"
        style={{
          position: "relative", width: "100%", maxWidth: 430, background: card, color: ink,
          fontFamily: font, overflow: "hidden", borderRadius: radius,
          boxShadow: "0 30px 60px -28px rgba(0,0,0,.45)",
        }}
      >
        {pattern}
        {rail ? (
          <div style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
            <div style={{ width: railWidth, flex: "none" }}>{rail}</div>
            <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
          </div>
        ) : (
          <div style={{ position: "relative" }}>{children}</div>
        )}
      </div>
      <style>{`
        .wed-phone-card a { color: inherit; text-decoration: none; }
        .wed-phone-card img { display: block; }
        .wed-swipe { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .wed-swipe::-webkit-scrollbar { display: none; }
        .wed-swipe > * { scroll-snap-align: center; flex: none; }
        @media (prefers-reduced-motion: reduce) {
          .wed-phone-card *, .wed-phone-card *::before, .wed-phone-card *::after {
            animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important;
          }
        }
      `}</style>
    </main>
  );
}

// ── Ảnh ─────────────────────────────────────────────────────────────────────

/**
 * Ô ảnh. Khi chưa có ảnh sẽ hiện một khung rỗng nhã nhặn (đúng tỉ lệ) để bố
 * cục không sụp — cặp đôi nhìn bản xem trước là biết còn thiếu ảnh nào.
 */
export function Slot({
  src, height, width, radius = 0, border, tint = "rgba(128,128,128,.12)", label, style, lazy = true,
}: {
  src?: string; height: number | string; width?: number | string; radius?: number | string; border?: string;
  tint?: string; label?: string; style?: CSSProperties; lazy?: boolean;
}) {
  const box: CSSProperties = {
    height, width, borderRadius: radius, overflow: "hidden", border, background: tint,
    display: "flex", alignItems: "center", justifyContent: "center", ...style,
  };
  if (!src) {
    return (
      <div style={box}>
        {/* label="" = cố ý KHÔNG ghi chữ gì (ô chân dung, ô ảnh nhỏ). */}
        <span style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", opacity: 0.45 }}>{label ?? "Ảnh"}</span>
      </div>
    );
  }
  return (
    <div style={box}>
      <img src={src} alt="" loading={lazy ? "lazy" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

// ── Bản đồ ──────────────────────────────────────────────────────────────────

/**
 * Khung bản đồ: ưu tiên ảnh chụp bản đồ do cặp đôi tải lên, sau đó tới bản đồ
 * Google nhúng theo địa chỉ/link; không có gì thì bỏ hẳn khung (không để ô
 * trống kẻ sọc trên thiệp thật).
 */
export function MapBox({ d, height = 140, radius = 0, style }: { d: PhoneData; height?: number; radius?: number; style?: CSSProperties }) {
  if (d.mapImage) return <Slot src={d.mapImage} height={height} radius={radius} style={style} />;
  if (!d.mapEmbed) return null;
  return (
    <div style={{ height, borderRadius: radius, overflow: "hidden", ...style }}>
      <iframe title="Bản đồ" src={d.mapEmbed} loading="lazy" style={{ width: "100%", height: "100%", border: 0, display: "block" }} />
    </div>
  );
}
