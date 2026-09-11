import type { CSSProperties, ReactNode } from "react";
import type { WeddingBank, WeddingConfig, WeddingInvitation } from "@/lib/types";
import { mapEmbedSrc, mapOpenHref } from "@/lib/site-map";
import { vietqrUrl, type Wish } from "../../shared";
import PhoneCountdown from "./PhoneCountdown";
import QuickRsvp from "./QuickRsvp";

export { PhoneCountdown, QuickRsvp };
export type { Wish };

// ────────────────────────────────────────────────────────────────────────────
// Bộ khung dùng chung cho 10 mẫu "thiệp điện thoại": khổ dọc ~390px, cuộn một
// mạch như cầm một tấm thiệp trên tay. Mỗi mẫu chỉ lo phần NHÌN (màu, phông,
// bo góc, hoạ tiết); toàn bộ phần ĐỌC DỮ LIỆU nằm ở đây để 10 mẫu luôn hiện
// cùng một nội dung mà cặp đôi nhập trong trình chỉnh sửa.
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

export type PhoneEvent = {
  label: string;
  time?: string;
  /** "05/12" */ date?: string;
  where?: string;
};

export type PhoneData = {
  c: WeddingConfig;
  slug: string;
  groom: string;
  bride: string;
  accent?: string;
  guest?: string;
  guestLabel: string;
  date: DateBits;
  /** ISO ngày cưới (cho đếm ngược) — undefined nếu chưa nhập. */
  countdownTo?: string;
  lunar?: string;
  location?: string;
  /** "Nhằm 12/11 Âm lịch · Hà Nội" — dòng phụ dưới ngày cưới. */
  dateSub?: string;
  reception?: string;
  quote?: string;
  story?: string;
  /** Ảnh bìa (hoặc ảnh đầu album nếu chưa có bìa). */
  hero?: string;
  /** 2 ô ảnh phụ. */ pair: string[];
  /** 3 ô album. */ trio: string[];
  events: PhoneEvent[];
  venue: { name?: string; address?: string; mapUrl?: string };
  mapEmbed: string | null;
  mapHref: string | null;
  mapImage?: string;
  families: { groom?: string; bride?: string };
  infos: InfoItem[];
  gifts: { title: string; qr: string; bank: WeddingBank; fallbackName: string }[];
  giftNote?: string;
  portraits: { role: string; name: string; photo?: string; sub?: string }[];
  closing?: string;
  thanks?: string;
  rsvpOn: boolean;
  wishesOn: boolean;
};

/** Đọc config của thiệp thành dữ liệu render-ready cho các mẫu điện thoại. */
export function phoneData(inv: WeddingInvitation, guest?: string): PhoneData {
  const c = (inv.config ?? {}) as WeddingConfig;
  const groom = c.groom_name?.trim() || "Chú rể";
  const bride = c.bride_name?.trim() || "Cô dâu";

  const gallery = (c.gallery ?? []).filter(Boolean);
  const hero = c.cover_url || gallery[0];
  const rest = gallery.filter((u) => u !== hero);

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

  // Chân dung cô dâu / chú rể — chỉ dựng khi cặp đôi có nhập thứ gì đó.
  const portraits = [
    { role: c.bride_role?.trim() || "Cô dâu", name: bride, photo: c.bride_photo || undefined, sub: c.bride_subtitle?.trim() || undefined },
    { role: c.groom_role?.trim() || "Chú rể", name: groom, photo: c.groom_photo || undefined, sub: c.groom_subtitle?.trim() || undefined },
  ];
  const hasPortraits = !!(c.bride_photo || c.groom_photo || c.bride_role || c.groom_role || c.bride_subtitle || c.groom_subtitle);

  const gifts = c.gift_enabled
    ? ([
        { title: "chú rể", bank: c.groom_bank, fallbackName: groom },
        { title: "cô dâu", bank: c.bride_bank, fallbackName: bride },
      ]
        .map((g) => ({ ...g, qr: vietqrUrl(g.bank) }))
        .filter((g): g is { title: string; bank: WeddingBank; fallbackName: string; qr: string } => !!g.qr))
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
    events,
    venue,
    mapEmbed: mapEmbedSrc(venue.mapUrl ?? "", venue.address ?? ""),
    mapHref: mapOpenHref(venue.mapUrl ?? "", venue.address ?? ""),
    mapImage: c.map_image?.trim() || undefined,
    families: { groom: c.groom_family?.trim() || undefined, bride: c.bride_family?.trim() || undefined },
    infos,
    gifts,
    giftNote: c.gift_note?.trim() || undefined,
    portraits: hasPortraits ? portraits : [],
    closing: c.closing_line?.trim() || undefined,
    thanks: c.thanks_note?.trim() || undefined,
    rsvpOn: c.rsvp_enabled !== false,
    wishesOn: c.guestbook_enabled !== false,
  };
}

// ── Khung ngoài ─────────────────────────────────────────────────────────────

/**
 * Nền trang + khung thiệp giữa màn hình. Trên điện thoại thiệp chiếm trọn bề
 * ngang; trên máy tính nó co lại còn một "tấm thiệp" 430px đứng giữa nền tối.
 */
export function PhoneShell({
  card, page, ink, font, accent, children, radius = 0, pattern,
}: {
  card: string;            // nền tấm thiệp
  page: string;            // nền trang phía sau (desktop)
  ink: string;             // màu chữ mặc định
  font: string;            // font-family mặc định
  accent: string;          // màu nhấn → biến --wed-accent cho nút nhạc, form RSVP
  radius?: number;         // bo góc tấm thiệp (chỉ thấy trên desktop)
  pattern?: ReactNode;     // hoạ tiết phủ toàn tấm (position:absolute)
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
        <div style={{ position: "relative" }}>{children}</div>
      </div>
      <style>{`
        .wed-phone-card a { color: inherit; text-decoration: none; }
        .wed-phone-card img { display: block; }
        @media (prefers-reduced-motion: reduce) {
          .wed-phone-card *, .wed-phone-card *::before, .wed-phone-card *::after {
            animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important;
          }
        }
      `}</style>
    </main>
  );
}

/** Nhãn nhỏ in hoa, giãn chữ — mô-típ lặp ở cả 10 mẫu. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 10, letterSpacing: ".3em", textTransform: "uppercase", ...style }}>{children}</div>;
}

// ── Ảnh ─────────────────────────────────────────────────────────────────────

/**
 * Ô ảnh. Khi chưa có ảnh sẽ hiện một khung rỗng nhã nhặn (đúng tỉ lệ) để bố
 * cục không sụp — cặp đôi nhìn bản xem trước là biết còn thiếu ảnh nào.
 */
export function Slot({
  src, height, radius = 0, border, tint = "rgba(128,128,128,.12)", label, style, lazy = true,
}: {
  src?: string; height: number | string; radius?: number | string; border?: string;
  tint?: string; label?: string; style?: CSSProperties; lazy?: boolean;
}) {
  const box: CSSProperties = {
    height, borderRadius: radius, overflow: "hidden", border, background: tint,
    display: "flex", alignItems: "center", justifyContent: "center", ...style,
  };
  if (!src) {
    return (
      <div style={box}>
        <span style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", opacity: 0.45 }}>{label || "Ảnh"}</span>
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

// ── Sổ lưu bút ──────────────────────────────────────────────────────────────

/** Danh sách lời chúc của khách (lấy từ RSVP đã lưu), theo kiểu của từng mẫu. */
export function WishList({ wishes, item, by, limit = 8 }: { wishes: Wish[]; item: CSSProperties; by: CSSProperties; limit?: number }) {
  if (!wishes.length) return null;
  return (
    <div>
      {wishes.slice(0, limit).map((w, i) => (
        <div key={i} style={item}>
          {w.wish}
          <div style={by}>— {w.guest_name}</div>
        </div>
      ))}
    </div>
  );
}

// ── Mừng cưới ───────────────────────────────────────────────────────────────

/** Thẻ QR mừng cưới nằm ngang (ảnh QR + tên ngân hàng, số tài khoản). */
export function GiftRow({
  gift, box, qrRadius = 8, muted, title = "Mừng cưới",
}: {
  gift: PhoneData["gifts"][number]; box: CSSProperties; qrRadius?: number; muted: CSSProperties; title?: string;
}) {
  const { bank, qr, fallbackName } = gift;
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", ...box }}>
      <div style={{ width: 74, height: 74, borderRadius: qrRadius, overflow: "hidden", flex: "none", background: "#fff" }}>
        <img src={qr} alt="" width={74} height={74} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>
        {title} · {gift.title}
        <div style={muted}>{bank.name}{bank.account ? ` · ${bank.account.replace(/\s/g, "")}` : ""}</div>
        <div style={muted}>{bank.holder || fallbackName}</div>
      </div>
    </div>
  );
}

/** Chân dung cô dâu & chú rể: ảnh tròn + vai vế + tên + dòng cha mẹ. */
export function Portraits({
  d, ring, role, name, sub, size = 116,
}: { d: PhoneData; ring: string; role: CSSProperties; name: CSSProperties; sub: CSSProperties; size?: number }) {
  if (!d.portraits.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, textAlign: "center" }}>
      {d.portraits.map((p) => (
        <div key={p.role + p.name}>
          <div style={{ margin: "0 auto 10px", width: size, height: size, borderRadius: "50%", overflow: "hidden", border: `2px solid ${ring}`, background: "rgba(128,128,128,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {p.photo
              ? <img src={p.photo} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 30, opacity: 0.5, fontFamily: "var(--font-hand), cursive" }}>{p.name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase() || "♥"}</span>}
          </div>
          <div style={role}>{p.role}</div>
          <div style={name}>{p.name}</div>
          {p.sub && <div style={sub}>{p.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Khối mừng cưới: lời nhắn (nếu có) + một thẻ QR cho mỗi tài khoản. */
export function Gifts({
  d, box, qrRadius, muted, note, title,
}: { d: PhoneData; box: CSSProperties; qrRadius?: number; muted: CSSProperties; note?: CSSProperties; title?: string }) {
  if (!d.gifts.length) return null;
  return (
    <>
      {d.giftNote && <div style={{ fontSize: 13, lineHeight: 1.6, textAlign: "center", ...note }}>{d.giftNote}</div>}
      {d.gifts.map((g) => (
        <GiftRow key={g.title} gift={g} box={box} qrRadius={qrRadius} muted={muted} title={title} />
      ))}
    </>
  );
}

// ── Lời mời khách ───────────────────────────────────────────────────────────

/** Khối "Trân trọng kính mời <tên khách>" — chỉ hiện với link khách mời riêng. */
export function GuestLine({ d, label, name }: { d: PhoneData; label: CSSProperties; name: CSSProperties }) {
  if (!d.guest) return null;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={label}>{d.guestLabel}</div>
      <div style={{ fontFamily: "var(--font-hand), cursive", ...name }}>{d.guest}</div>
    </div>
  );
}

/** Hai họ (nhà trai / nhà gái) — bỏ qua khi cặp đôi chưa nhập. */
export function Families({
  d, wrap, col, head, divider,
}: { d: PhoneData; wrap?: CSSProperties; col?: CSSProperties; head: CSSProperties; divider: string }) {
  const { groom, bride } = d.families;
  if (!groom && !bride) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 16, textAlign: "center", fontSize: 13, lineHeight: 1.6, ...wrap }}>
      <div style={col}>
        <div style={head}>Nhà trai</div>
        <span style={{ whiteSpace: "pre-line" }}>{groom || "—"}</span>
      </div>
      <div style={{ background: divider }} />
      <div style={col}>
        <div style={head}>Nhà gái</div>
        <span style={{ whiteSpace: "pre-line" }}>{bride || "—"}</span>
      </div>
    </div>
  );
}

/** Lưới 2×2: trang phục · hashtag · gửi xe · hotline. */
export function InfoGrid({ d, cell, label, value, columns = 2 }: { d: PhoneData; cell: CSSProperties; label: CSSProperties; value: CSSProperties; columns?: number }) {
  if (!d.infos.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns},1fr)`, gap: 10 }}>
      {d.infos.map((i) => (
        <div key={i.label} style={cell}>
          <div style={label}>{i.label}</div>
          {i.value && <div style={value}>{i.value}</div>}
          {i.swatches && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {i.swatches.map((s, k) => (
                <span key={k} style={{ width: 20, height: 20, borderRadius: "50%", background: s, border: "1px solid rgba(255,255,255,.6)" }} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
