import type { CSSProperties, ReactNode } from "react";
import type { WeddingBank, WeddingConfig, WeddingInvitation } from "@/lib/types";
import { mapEmbedSrc, mapOpenHref } from "@/lib/site-map";
import { vietqrUrl, type Wish } from "../../shared";
import PhoneCountdown from "./PhoneCountdown";
import QuickRsvp from "./QuickRsvp";
import Reveal from "../../Reveal";

export { PhoneCountdown, QuickRsvp, Reveal };
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

/** Chữ cái đầu của TÊN (tiếng Việt xếp tên sau): "Phương Nhi" → "N". */
export function initial(name: string): string {
  const w = name.trim().split(/\s+/);
  return (w[w.length - 1] || name).charAt(0).toUpperCase();
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
  /** 2 ô ảnh phụ chèn giữa nội dung. */ pair: string[];
  /** Album: TẤT CẢ ảnh còn lại sau bìa và hai ô phụ (không cắt bớt). */ trio: string[];
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
  /** Đã tải ảnh chân dung chưa (để mẫu chọn bố cục ảnh hay chữ lồng). */ hasPortraitPhotos: boolean;
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
  // Khối chân dung LUÔN hiện: đây là chỗ đứng của cô dâu chú rể trên tấm thiệp.
  // Chưa tải ảnh thì mỗi mẫu vẽ chữ lồng theo kiểu của mình (Slot `fallback`),
  // chứ không bỏ hẳn khối — bỏ đi thì cặp đôi không biết là có chỗ để tải ảnh.

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
    trio: rest.slice(2),
    photos,
    events,
    venue,
    mapEmbed: mapEmbedSrc(venue.mapUrl ?? "", venue.address ?? ""),
    mapHref: mapOpenHref(venue.mapUrl ?? "", venue.address ?? ""),
    mapImage: c.map_image?.trim() || undefined,
    families: { groom: c.groom_family?.trim() || undefined, bride: c.bride_family?.trim() || undefined },
    hasFamilies: !!(c.groom_family?.trim() || c.bride_family?.trim()),
    infos,
    portraits,
    hasPortraitPhotos: !!(c.bride_photo || c.groom_photo),
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
        {/* Tắt JS thì mọi khối có hiệu ứng cuộn vẫn phải đọc được. */}
        <noscript><style>{".wed-reveal{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}"}</style></noscript>
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

        /* ══ HIỆU ỨNG ẢNH ══════════════════════════════════════════════ */
        @keyframes wedKenBurns { from { transform: scale(1) } to { transform: scale(1.14) } }
        .wed-kb img { animation: wedKenBurns 18s ease-out forwards; }
        /* Lia ngược: phóng to rồi thu về, có lia ngang — dùng cho bìa thứ hai */
        @keyframes wedKenR { from { transform: scale(1.16) translateX(2.5%) } to { transform: scale(1.01) translateX(-2.5%) } }
        .wed-kb-r img { animation: wedKenR 24s ease-out forwards; }
        .wed-zoom img { transition: transform .65s cubic-bezier(.2,.7,.3,1); }
        .wed-zoom:hover img, .wed-zoom:focus-within img, .wed-zoom:active img { transform: scale(1.07); }
        /* Nghiêng 3D nhẹ khi chạm/rê — ảnh như một tấm hình cầm trên tay */
        .wed-tilt { transition: transform .55s cubic-bezier(.2,.7,.3,1), box-shadow .55s; }
        .wed-tilt:hover, .wed-tilt:focus-within, .wed-tilt:active { transform: perspective(760px) rotateX(3.5deg) rotateY(-5deg) scale(1.035); }
        /* Phập phồng rất chậm — ảnh chân dung như đang thở */
        @keyframes wedBreathe { 0%,100% { transform: scale(1) } 50% { transform: scale(1.05) } }
        .wed-breathe img { animation: wedBreathe 9s ease-in-out infinite; }
        /* Ngả nâu như ảnh cũ, chạm vào thì về đúng màu */
        .wed-duo img { filter: sepia(.52) contrast(1.06) saturate(.82); transition: filter .9s ease; }
        .wed-duo:hover img, .wed-duo:focus-within img, .wed-duo:active img { filter: none; }
        /* Vệt sáng quét chéo qua mặt ảnh */
        @keyframes wedGloss { 0% { transform: translateX(-130%) skewX(-18deg) } 100% { transform: translateX(240%) skewX(-18deg) } }
        .wed-gloss { position: relative; }
        .wed-gloss::after {
          content: ""; position: absolute; top: -10%; bottom: -10%; left: 0; width: 45%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent);
          animation: wedGloss 6s ease-in-out 1.4s infinite; pointer-events: none;
        }
        /* Nét khung tự vẽ quanh ảnh */
        @keyframes wedFrameH { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        @keyframes wedFrameV { from { transform: scaleY(0) } to { transform: scaleY(1) } }
        .wed-frame { position: relative; }
        .wed-frame::before, .wed-frame::after {
          content: ""; position: absolute; pointer-events: none; background: var(--wed-frame, currentColor);
        }
        .wed-frame::before { left: 0; right: 0; top: 0; height: 1px; animation: wedFrameH 1.1s ease .1s both; }
        .wed-frame::after { left: 0; right: 0; bottom: 0; height: 1px; animation: wedFrameH 1.1s ease .3s both; }

        /* ══ HIỆU ỨNG CHỮ ══════════════════════════════════════════════ */
        /* Tên cô dâu chú rể hiện dần từ MỜ sang NÉT */
        @keyframes wedInkIn { from { opacity: 0; filter: blur(10px); transform: translateY(14px) } to { opacity: 1; filter: blur(0); transform: none } }
        .wed-ink { animation: wedInkIn 1.1s cubic-bezier(.16,.8,.3,1) both; }
        .wed-ink-2 { animation: wedInkIn 1.1s cubic-bezier(.16,.8,.3,1) .22s both; }
        /* Nét gạch chân tự kéo ra dưới tiêu đề mục */
        @keyframes wedRule { from { transform: scaleX(0) } to { transform: scaleX(1) } }
        .wed-rule { transform-origin: center; animation: wedRule 1s cubic-bezier(.16,.8,.3,1) .2s both; }
        /* Từng CHỮ CÁI rơi xuống lệch nhau (component <Letters/>) */
        @keyframes wedLetter { from { opacity: 0; transform: translateY(.42em) rotate(4deg) } to { opacity: 1; transform: none } }
        .wed-letter { display: inline-block; animation: wedLetter .72s cubic-bezier(.2,.8,.3,1) both; }
        /* Máy chữ: dòng chữ tự gõ ra */
        @keyframes wedType { from { width: 0 } to { width: 100% } }
        .wed-type { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; animation: wedType 1.8s steps(28,end) .35s both; }
        /* Bồng bềnh — dùng cho dấu &, hoa văn, mũi tên cuộn */
        @keyframes wedFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        .wed-float { animation: wedFloat 4.2s ease-in-out infinite; }
        @keyframes wedSpinSlow { to { transform: rotate(360deg) } }
        .wed-spin { animation: wedSpinSlow 26s linear infinite; }
        /*
         * Ánh kim quét qua chữ và chữ đổ màu chuyển động.
         * Cả hai đặt trong @supports vì chúng tô chữ bằng background: trình
         * duyệt không hiểu background-clip:text mà vẫn nhận màu trong suốt thì
         * TÊN CÔ DÂU CHÚ RỂ BIẾN MẤT. Ngoài @supports thì hai lớp này vô hại.
         */
        @keyframes wedSheen { 0% { background-position: 210% 0 } 55%,100% { background-position: -110% 0 } }
        @keyframes wedFlow { from { background-position: 0% 50% } to { background-position: 200% 50% } }
        @supports ((-webkit-background-clip: text) or (background-clip: text)) {
          .wed-sheen {
            background-image: linear-gradient(100deg, var(--wed-t1, currentColor) 42%, var(--wed-t2, #fff) 50%, var(--wed-t1, currentColor) 58%);
            background-size: 260% 100%; -webkit-background-clip: text; background-clip: text;
            color: transparent; -webkit-text-fill-color: transparent;
            animation: wedSheen 5.4s ease-in-out 1.6s infinite;
          }
          .wed-flow {
            background-image: linear-gradient(90deg, var(--wed-t1) , var(--wed-t2), var(--wed-t3, var(--wed-t1)), var(--wed-t1));
            background-size: 200% 100%; -webkit-background-clip: text; background-clip: text;
            color: transparent; -webkit-text-fill-color: transparent;
            animation: wedFlow 7s linear infinite;
          }
        }
        /* Đèn nê-ông: quầng sáng thở và chớp nhẹ */
        @keyframes wedNeon {
          0%,100% { text-shadow: 0 0 5px var(--wed-n), 0 0 16px var(--wed-n), 0 0 38px var(--wed-n) }
          43% { text-shadow: 0 0 2px var(--wed-n), 0 0 9px var(--wed-n); opacity: .88 }
          47% { text-shadow: 0 0 6px var(--wed-n), 0 0 20px var(--wed-n), 0 0 46px var(--wed-n); opacity: 1 }
        }
        .wed-neon { animation: wedNeon 3.6s ease-in-out infinite; }

        /* ══ LỚP KHÔNG KHÍ (component <Ambient/>) ══════════════════════ */
        /*
         * Chạy bằng thuộc tính "top" chứ không phải translateY(%): phần trăm
         * trong transform tính theo KÍCH THƯỚC CHÍNH HẠT (chừng chục px) nên hạt
         * chỉ nhúc nhích tại chỗ; "top" mới tính theo chiều cao khối chứa.
         */
        @keyframes wedFall {
          0% { top: -14%; opacity: 0; transform: translateX(0) rotate(0deg) }
          10%, 86% { opacity: var(--o,.6) }
          100% { top: 110%; opacity: 0; transform: translateX(var(--sway,16px)) rotate(var(--spin,200deg)) }
        }
        @keyframes wedRise {
          0% { top: 108%; opacity: 0; transform: translateX(0) scale(.85) }
          14%, 84% { opacity: var(--o,.6) }
          100% { top: -14%; opacity: 0; transform: translateX(var(--sway,-20px)) scale(1.06) }
        }
        @keyframes wedDrift { 0%,100% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(var(--dx,28px),var(--dy,-20px),0) scale(1.14) } }
        @keyframes wedTwinkle { 0%,100% { transform: scale(.35) rotate(0deg); opacity: 0 } 50% { transform: scale(1) rotate(45deg); opacity: var(--o,.9) } }
        @keyframes wedLeak { 0%,100% { opacity: 0; transform: translateX(-26%) } 50% { opacity: .42; transform: translateX(26%) } }
        @keyframes wedPulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
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
  src, height, width, radius = 0, border, tint = "rgba(128,128,128,.12)", label, style, lazy = true, fx, fallback, imgStyle,
}: {
  src?: string; height: number | string; width?: number | string; radius?: number | string; border?: string;
  tint?: string; label?: string; style?: CSSProperties; lazy?: boolean; imgStyle?: CSSProperties;
  /**
   * Hiệu ứng ảnh, ghép được nhiều cái cách nhau bằng dấu cách — mỗi từ thành
   * lớp `wed-<từ>`: kb (phóng chậm Ken Burns) · kb-r (phóng ngược, lia ngang) ·
   * zoom (phóng khi chạm) · gloss (vệt sáng quét qua) · tilt (nghiêng 3D khi
   * chạm) · breathe (phập phồng rất chậm) · duo (ngả nâu, chạm thì về màu thật).
   */
  fx?: string;
  /** Thay chữ "Ảnh" khi chưa có ảnh — ô chân dung dùng để vẽ chữ lồng. */
  fallback?: ReactNode;
}) {
  const box: CSSProperties = {
    height, width, borderRadius: radius, overflow: "hidden", border, background: tint,
    display: "flex", alignItems: "center", justifyContent: "center", ...style,
  };
  if (!src) {
    return (
      <div style={box}>
        {/* label="" = cố ý KHÔNG ghi chữ gì (ô chân dung, ô ảnh nhỏ). */}
        {fallback ?? <span style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", opacity: 0.45 }}>{label ?? "Ảnh"}</span>}
      </div>
    );
  }
  const cls = fx ? fx.trim().split(/\s+/).map((f) => `wed-${f}`).join(" ") : undefined;
  return (
    <div style={box} className={cls}>
      <img src={src} alt="" loading={lazy ? "lazy" : undefined} style={{ width: "100%", height: "100%", objectFit: "cover", ...imgStyle }} />
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

// ── Hiệu ứng chữ: từng chữ cái ──────────────────────────────────────────────

/**
 * Tách một dòng chữ thành từng chữ cái để chúng rơi xuống lệch nhau.
 *
 * Chỉ dùng cho TÊN và tiêu đề ngắn: mỗi chữ cái là một `<span>`, đọc bằng máy
 * đọc màn hình sẽ ra từng chữ rời, nên dòng gốc được gắn `aria-label` và các
 * chữ cái `aria-hidden`.
 */
export function Letters({
  text, delay = 0, step = 0.045, className = "wed-letter", style,
}: { text: string; delay?: number; step?: number; className?: string; style?: CSSProperties }) {
  return (
    <span aria-label={text} style={style}>
      {Array.from(text).map((ch, i) =>
        ch === " " ? (
          <span key={i} aria-hidden> </span>
        ) : (
          <span key={i} aria-hidden className={className} style={{ animationDelay: `${(delay + i * step).toFixed(3)}s` }}>{ch}</span>
        ),
      )}
    </span>
  );
}

// ── Lớp không khí ───────────────────────────────────────────────────────────

export type AmbientKind =
  | "petal"    // cánh hoa rơi
  | "dust"     // bụi vàng bay lên
  | "fleck"    // vụn giấy / kim tuyến rơi
  | "bubble"   // bong bóng nổi lên
  | "blob"     // quầng màu trôi (cực quang)
  | "sparkle"  // ánh lấp lánh
  | "grain"    // hạt phim + vệt sáng lọt
  | "ray"      // tia sáng chéo
  | "heart"    // trái tim bay lên
  | "glow";    // quầng sáng thở

/**
 * Lớp trang trí động phủ lên MỘT KHỐI (không phải cả thiệp): đặt vào trong một
 * khối `position: relative` — thường là bìa — và nó phủ kín đúng khối đó.
 *
 * Cố ý KHÔNG dùng `position: fixed` phủ toàn màn hình: thiệp còn được nhúng
 * trong khung xem trước của trình chỉnh sửa, lớp `fixed` sẽ tràn ra ngoài khung.
 *
 * Vị trí và nhịp của từng hạt tính bằng một hàm giả-ngẫu nhiên theo chỉ số, nên
 * máy chủ và trình duyệt dựng ra y hệt nhau (không lệch hydrate).
 */
export function Ambient({
  kind, color = "rgba(255,255,255,.85)", color2, count = 14, opacity = 1, style,
}: {
  kind: AmbientKind; color?: string; color2?: string; count?: number; opacity?: number; style?: CSSProperties;
}) {
  const layer: CSSProperties = {
    position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1, opacity, ...style,
  };
  const n = Math.max(1, Math.min(40, count));
  const items = Array.from({ length: n }, (_, i) => i);

  if (kind === "grain") {
    return (
      <div style={layer} aria-hidden>
        {/*
          * Ba lớp chấm lệch cỡ và lệch pha nhau: chỉ hai lớp thì mắt bắt ra
          * ngay một tấm lưới đều như cửa lưới, không còn ra hạt phim.
          */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.32, mixBlendMode: "multiply",
          backgroundImage: `radial-gradient(${color} .4px, transparent .5px), radial-gradient(${color} .35px, transparent .45px), radial-gradient(${color} .5px, transparent .6px)`,
          backgroundSize: "3px 3px, 7px 5px, 11px 13px", backgroundPosition: "0 0, 2px 3px, 5px 1px",
        }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, left: "18%", width: "42%",
          background: `linear-gradient(94deg, transparent, ${color2 || "rgba(255,214,150,.55)"}, transparent)`,
          animation: "wedLeak 11s ease-in-out infinite",
        }} />
      </div>
    );
  }

  if (kind === "glow") {
    return (
      <div style={layer} aria-hidden>
        <div style={{
          position: "absolute", inset: "-20%",
          background: `radial-gradient(60% 45% at 50% 42%, ${color}, transparent 70%)`,
          animation: "wedPulse 5.4s ease-in-out infinite",
        }} />
      </div>
    );
  }

  if (kind === "blob" || kind === "ray") {
    const isRay = kind === "ray";
    return (
      <div style={layer} aria-hidden>
        {items.slice(0, isRay ? 3 : 4).map((i) => {
          const a = rnd(i, 3), b = rnd(i, 7);
          const c = i % 2 === 0 ? color : color2 || color;
          return isRay ? (
            <span key={i} style={{
              position: "absolute", top: "-30%", bottom: "-30%", left: `${8 + i * 30 + a * 10}%`, width: `${14 + b * 16}%`,
              background: `linear-gradient(180deg, transparent, ${c}, transparent)`,
              transform: "rotate(14deg)", filter: "blur(14px)",
              "--dx": `${(a - 0.5) * 70}px`, "--dy": `${(b - 0.5) * 40}px`,
              animation: `wedDrift ${16 + a * 12}s ease-in-out ${(-a * 9).toFixed(2)}s infinite`,
            } as CSSProperties & Record<string, string>} />
          ) : (
            <span key={i} style={{
              position: "absolute", left: `${5 + a * 70}%`, top: `${4 + b * 66}%`,
              width: `${34 + a * 40}%`, aspectRatio: "1", borderRadius: "50%",
              background: `radial-gradient(circle, ${c}, transparent 68%)`, filter: "blur(30px)",
              "--dx": `${(a - 0.5) * 120}px`, "--dy": `${(b - 0.5) * 90}px`,
              animation: `wedDrift ${20 + b * 16}s ease-in-out ${(-a * 12).toFixed(2)}s infinite`,
            } as CSSProperties & Record<string, string>} />
          );
        })}
      </div>
    );
  }

  return (
    <div style={layer} aria-hidden>
      {items.map((i) => {
        const a = rnd(i, 1), b = rnd(i, 2), c = rnd(i, 5);
        const rise = kind === "bubble" || kind === "dust" || kind === "heart";
        const dur = (kind === "sparkle" ? 2.4 : rise ? 12 : 11) + a * (kind === "sparkle" ? 2.6 : 9);
        const base: CSSProperties & Record<string, string> = {
          position: "absolute", left: `${(b * 100).toFixed(2)}%`,
          "--o": (0.32 + c * 0.5).toFixed(2),
          "--sway": `${((a - 0.5) * 60).toFixed(0)}px`,
          "--spin": `${((c - 0.5) * 520).toFixed(0)}deg`,
          animation: `${kind === "sparkle" ? "wedTwinkle" : rise ? "wedRise" : "wedFall"} ${dur.toFixed(1)}s linear ${(-a * dur).toFixed(1)}s infinite`,
        };
        if (kind === "sparkle") {
          const sz = 5 + c * 9;
          return <span key={i} style={{ ...base, top: `${(c * 92).toFixed(1)}%`, width: sz, height: sz, background: color, clipPath: "polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%)" }} />;
        }
        if (kind === "heart") {
          return <span key={i} style={{ ...base, top: 0, fontSize: 9 + c * 12, lineHeight: 1, color, fontFamily: "system-ui" }}>♥</span>;
        }
        if (kind === "bubble") {
          const sz = 10 + c * 26;
          return <span key={i} style={{ ...base, top: 0, width: sz, height: sz, borderRadius: "50%", border: `1px solid ${color}`, background: `radial-gradient(circle at 32% 28%, ${color2 || "rgba(255,255,255,.55)"}, transparent 58%)` }} />;
        }
        if (kind === "dust") {
          const sz = 2 + c * 4;
          return <span key={i} style={{ ...base, top: 0, width: sz, height: sz, borderRadius: "50%", background: color, boxShadow: `0 0 ${4 + c * 6}px ${color}` }} />;
        }
        if (kind === "fleck") {
          const sz = 4 + c * 6;
          return <span key={i} style={{ ...base, top: 0, width: sz, height: sz * (0.5 + b * 0.9), background: i % 3 === 0 && color2 ? color2 : color, borderRadius: 1 }} />;
        }
        // petal
        const w = 8 + c * 11;
        return <span key={i} style={{ ...base, top: 0, width: w, height: w * (0.58 + b * 0.32), background: i % 3 === 0 && color2 ? color2 : color, borderRadius: "56% 4% 56% 4%" }} />;
      })}
    </div>
  );
}

/** Giả-ngẫu nhiên theo chỉ số — máy chủ và trình duyệt cho cùng kết quả. */
function rnd(i: number, salt: number): number {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
