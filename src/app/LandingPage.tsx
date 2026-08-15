import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import type { Lang } from "@/lib/i18n";
import { mainUrl } from "@/lib/hosts";
import MstudoVideo from "@/components/MstudoVideo";
import LandingControls from "./landing/LandingControls";
import LandingMobileMenu from "./landing/LandingMobileMenu";
import CyclePricing from "./landing/CyclePricing";
import ContactSection from "./landing/ContactSection";

/**
 * Trang chủ marketing — SERVER COMPONENT. Ngôn ngữ đến từ cookie `vk_lang`
 * (đọc ở page.tsx), nên toàn bộ nội dung tĩnh (hero, tính năng, bảng giá,
 * FAQ, giới thiệu…) render sẵn trên server và KHÔNG ship thành JS. Tương tác
 * được cô lập vào các island nhỏ: LandingControls (đổi ngôn ngữ / giao diện),
 * CyclePricing (toggle giá tháng/năm), ContactSection (form), MstudoVideo.
 * FAQ dùng <details name> gốc của trình duyệt — accordion không cần JS.
 * Giao diện sáng/tối theo html[data-theme] toàn cục (boot script đặt trước
 * khi paint), logo đổi theo theme bằng CSS thay vì state.
 */

/* ── Bilingual content (ported from the mstudo design) ─────────────────── */
type Dict = {
  nav: { features: string; guide: string; pricing: string; faq: string; about: string; contact: string; login: string; start: string; website: string };
  hero: { badge: string; title: string; sub: string; ctaPrimary: string; ctaSecondary: string; ctaWebsite: string; note: string; shot: string };
  feat: { title: string; sub: string; cards: { t: string; d: string }[] };
  guide: { title: string; sub: string; steps: { t: string; d: string }[] };
  pricing: {
    title: string; sub: string; popular: string;
    plans: { name: string; price: string; period: string; desc: string; cta: string; f: string[]; accent?: boolean }[];
    // Gói "Plus" được gộp làm phần nâng cấp NGAY TRONG thẻ Photographer (để bớt
    // 1 cột). name/price hiển thị trong thẻ đó; f = các tính năng thêm so với Photographer.
    plus: { name: string; price: string; tagline: string; cta: string; f: string[] };
  };
  reviews: { title: string; items: { q: string; n: string; role: string; i: string }[] };
  faq: { title: string; items: { q: string; a: string }[] };
  about: { title: string; text: string; company: string; addrLabel: string; address: string; email: string; phone: string };
  footer: { copy: string };
};

/* Admin-configurable pricing (from site_settings). When absent we fall back to
   the static prices baked into the dictionary below. */
export type LandingPricing = {
  basicMonth: number; basicYear: number;
  photographerMonth: number; photographerYear: number;
  photographerPlusMonth: number; photographerPlusYear: number;
  studioMonth: number; studioYear: number;
  basicDiscount: number; photographerDiscount: number;
  photographerPlusDiscountMonth: number; photographerPlusDiscountYear: number;
  studioDiscount: number; studioPromo: number;
};

const fmtVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}₫`;

const D: Record<"vi" | "en", Dict> = {
  vi: {
    nav: { features: "Tính năng", guide: "Hướng dẫn", pricing: "Bảng giá", faq: "Câu hỏi", about: "Giới thiệu", contact: "Liên hệ", login: "Đăng nhập", start: "Bắt đầu miễn phí", website: "Website riêng" },
    hero: {
      badge: "Phần mềm quản lý studio chụp ảnh",
      title: "Giải pháp quản lý studio toàn diện",
      sub: "mstudo giúp studio nhiếp ảnh quản lý lịch hẹn, đơn hàng, tài chính và nhân sự — tất cả trong một nền tảng duy nhất.",
      ctaPrimary: "Bắt đầu miễn phí", ctaSecondary: "Xem hướng dẫn", ctaWebsite: "Website riêng",
      note: "Miễn phí 7 ngày ko cần thẻ", shot: "[ Ảnh chụp màn hình bảng điều khiển ]",
    },
    feat: {
      title: "Mọi thứ studio cần, trong một nơi",
      sub: "Sáu công cụ cốt lõi giúp bạn vận hành studio trơn tru mỗi ngày.",
      cards: [
        { t: "Quản lý lịch hẹn", d: "Đặt và theo dõi lịch chụp, nhắc hẹn tự động, tránh trùng giờ giữa các ekip." },
        { t: "Đơn hàng & hợp đồng", d: "Tạo báo giá, hợp đồng và theo dõi tiến độ từng đơn từ lúc chốt đến khi giao ảnh." },
        { t: "Thu chi & tài chính", d: "Ghi nhận thu chi, công nợ và dòng tiền của studio theo thời gian thực." },
        { t: "Nhân viên & lịch làm", d: "Phân ca cho photographer, make-up, retoucher và tính lương theo công việc." },
        { t: "Báo cáo & thống kê", d: "Bảng điều khiển trực quan về doanh thu, đơn hàng và hiệu suất từng tháng." },
        { t: "Quản lý khách hàng", d: "Lưu hồ sơ, lịch sử chụp và liên hệ của từng khách hàng để chăm sóc tốt hơn." },
      ],
    },
    guide: {
      title: "Bắt đầu chỉ trong vài phút", sub: "Bốn bước đơn giản để đưa studio của bạn lên mstudo.",
      steps: [
        { t: "Đăng ký tài khoản", d: "Tạo tài khoản miễn phí và đăng nhập vào không gian studio của bạn." },
        { t: "Thiết lập studio", d: "Thêm thông tin studio, dịch vụ, bảng giá và đội ngũ nhân sự." },
        { t: "Thêm lịch hẹn & khách", d: "Nhập lịch chụp, tạo đơn hàng và lưu hồ sơ khách hàng." },
        { t: "Theo dõi & tăng trưởng", d: "Xem báo cáo doanh thu và tối ưu vận hành studio mỗi ngày." },
      ],
    },
    pricing: {
      title: "Bảng giá đơn giản, minh bạch", sub: "Chọn gói phù hợp với quy mô studio của bạn.", popular: "Phổ biến nhất",
      plans: [
        { name: "Free", price: "0₫", period: "/tháng", desc: "Cho nhiếp ảnh gia mới bắt đầu", cta: "Bắt đầu miễn phí", f: ["5 album mỗi tháng", "Khách chọn ảnh & gửi lại studio (QR + link)", "Tải ảnh cho khách: tắt", "Ghi chú trên ảnh: tắt", "Lọc ảnh: 10 lần / tháng", "Nén ảnh: 5 lần / tháng", "Nén qua Drive: dùng thử 1 lần", "Watermark: chỉ chữ"] },
        { name: "Basic", price: "50.000₫", period: "/tháng", desc: "Cho nhiếp ảnh gia cá nhân", cta: "Dùng thử Basic", f: ["15 album mỗi tháng", "Album giao khách", "Cho khách tải ảnh bản gốc từ Drive", "Cho khách ghi chú trên ảnh", "Watermark đầy đủ (logo + nén kèm)", "Lọc ảnh: không giới hạn", "Nén ảnh: không giới hạn", "Nén qua Drive: 5 lần / tháng"] },
        { name: "Photographer", price: "100.000₫", period: "/tháng", desc: "Nhiếp ảnh gia chuyên nghiệp", cta: "Dùng thử Photographer", f: ["50 album / tháng", "Đầy đủ tính năng Basic", "Khu quản lý studio", "Đặt lịch online + lịch làm việc & nhắc lịch Zalo", "Danh bạ khách hàng & bảng giá dịch vụ", "Gallery công khai trên trang chủ", "Website portfolio xuất bản được"] },
        { name: "Studio", price: "300.000₫", period: "/tháng", desc: "Studio & đội nhóm chuyên nghiệp", cta: "Dùng thử Studio", accent: true, f: ["Tất cả tính năng Photographer Plus", "Watermark bảo vệ ảnh trong album", "Album & nén qua Drive không giới hạn", "Thu chi, công nợ & báo cáo doanh thu", "Đối soát tiền công · đội ngũ & xếp hạng", "Bảng công việc và tiến độ xử lý ảnh/video/in", "Phòng váy · thiết bị & lịch mượn", "Thiệp cưới · Love Story · Slide · thiết kế album", "Hỗ trợ riêng · nhận mọi tính năng nâng cấp"] },
      ],
      plus: { name: "Photographer Plus", price: "129.000₫", tagline: "Nâng cấp Plus — thêm hợp đồng, báo giá & tên miền riêng", cta: "Dùng thử Plus", f: ["100 album / tháng", "Hợp đồng: khách ký online + báo giá hạng mục", "Website dùng tên miền riêng (studio.com)"] },
    },
    reviews: {
      title: "Được tin dùng bởi các studio",
      items: [
        { q: "Trước đây mình quản lý lịch bằng Excel và tin nhắn, giờ mọi thứ gọn trong mstudo. Không còn cảnh trùng lịch chụp.", n: "Minh Anh", role: "Chủ AnhMinh Photography", i: "MA" },
        { q: "Phần báo cáo doanh thu giúp mình biết tháng nào lời lỗ ra sao chỉ trong vài giây.", n: "Hoàng Long", role: "Founder, LightHouse Studio", i: "HL" },
        { q: "Đội ngũ 8 người của mình chia ca và tính lương dễ hơn hẳn từ khi dùng mstudo.", n: "Thu Hà", role: "Quản lý Bloom Wedding Studio", i: "TH" },
      ],
    },
    faq: {
      title: "Câu hỏi thường gặp",
      items: [
        { q: "mstudo có miễn phí không?", a: "Có. Gói Free miễn phí trọn đời với các tính năng cơ bản. Bạn có thể nâng cấp lên Basic, Photographer hoặc Studio bất cứ lúc nào." },
        { q: "Tôi có cần cài đặt phần mềm không?", a: "Không. mstudo chạy hoàn toàn trên trình duyệt, bạn chỉ cần đăng nhập là dùng được trên máy tính và điện thoại." },
        { q: "Dữ liệu của tôi có an toàn không?", a: "Dữ liệu được mã hoá và sao lưu định kỳ. Chỉ bạn và nhân viên được phân quyền mới truy cập được." },
        { q: "mstudo có hỗ trợ nhiều chi nhánh không?", a: "Có, gói Studio cho phép quản lý nhiều chi nhánh với phân quyền riêng cho từng nơi." },
        { q: "Tôi có thể chuyển dữ liệu từ Excel sang không?", a: "Được. mstudo hỗ trợ nhập dữ liệu khách hàng và lịch hẹn từ file Excel/CSV." },
        { q: "Nếu cần hỗ trợ thì liên hệ thế nào?", a: "Bạn có thể liên hệ qua email, hotline hoặc chat trực tiếp trong phần mềm. Gói Studio có hỗ trợ riêng ưu tiên." },
      ],
    },
    about: {
      title: "Về mstudo",
      text: "mstudo là giải pháp quản lý studio toàn diện được phát triển dành riêng cho các studio nhiếp ảnh tại Việt Nam. Chúng tôi giúp các studio số hoá toàn bộ quy trình vận hành — từ lịch hẹn, đơn hàng đến tài chính và nhân sự.",
      company: "Một sản phẩm của Vieetjk", addrLabel: "Địa chỉ", address: "Quảng Ngãi", email: "vieetjk@gmail.com", phone: "0974.374.744",
    },
    footer: { copy: "© 2026 mstudo. Một sản phẩm của Vieetjk." },
  },
  en: {
    nav: { features: "Features", guide: "Guide", pricing: "Pricing", faq: "FAQ", about: "About", contact: "Contact", login: "Log in", start: "Start free", website: "Build your website" },
    hero: {
      badge: "Studio management software for photographers",
      title: "All-in-one studio management",
      sub: "mstudo helps photography studios manage bookings, orders, finances and staff — all in one platform.",
      ctaPrimary: "Start for free", ctaSecondary: "See how it works", ctaWebsite: "Build your website",
      note: "7-day free trial · No credit card required", shot: "[ Dashboard screenshot ]",
    },
    feat: {
      title: "Everything your studio needs, in one place",
      sub: "Six core tools to run your studio smoothly every day.",
      cards: [
        { t: "Booking management", d: "Schedule and track shoots, send automatic reminders and avoid double-booking your crews." },
        { t: "Orders & contracts", d: "Create quotes and contracts and track each order from booking to photo delivery." },
        { t: "Finance & cash flow", d: "Record income, expenses and receivables with real-time cash flow." },
        { t: "Staff & scheduling", d: "Assign shifts to photographers, make-up and retouchers and calculate pay by job." },
        { t: "Reports & analytics", d: "A clear dashboard of revenue, orders and monthly performance." },
        { t: "Client management", d: "Store profiles, shoot history and contacts for every client so you can care for them better." },
      ],
    },
    guide: {
      title: "Get started in minutes", sub: "Four simple steps to bring your studio onto mstudo.",
      steps: [
        { t: "Create an account", d: "Sign up for free and log into your studio workspace." },
        { t: "Set up your studio", d: "Add studio details, services, pricing and your team." },
        { t: "Add bookings & clients", d: "Enter shoots, create orders and store client profiles." },
        { t: "Track & grow", d: "Review revenue reports and optimize operations every day." },
      ],
    },
    pricing: {
      title: "Simple, transparent pricing", sub: "Pick the plan that fits your studio.", popular: "Most popular",
      plans: [
        { name: "Free", price: "0₫", period: "/mo", desc: "For new photographers", cta: "Start free", f: ["5 albums / month", "Client photo selection via QR + link", "Client download: disabled", "Photo notes: disabled", "Filter photos: 10×/mo", "Compress photos: 5×/mo", "Drive compress: 1 trial", "Watermark: text only"] },
        { name: "Basic", price: "50,000₫", period: "/mo", desc: "For individual photographers", cta: "Try Basic", f: ["15 albums / month", "Client delivery albums", "Original-quality downloads from Drive", "Client photo notes", "Full watermark (logo + compress)", "Filter photos: unlimited", "Compress photos: unlimited", "Drive compress: 5×/mo"] },
        { name: "Photographer", price: "100,000₫", period: "/mo", desc: "For professional photographers", cta: "Try Photographer", f: ["50 albums / month", "All Basic features", "Studio workspace", "Online booking + schedule & Zalo reminders", "Client directory & service pricing", "Public gallery on the mstudo homepage", "Publishable portfolio website"] },
        { name: "Studio", price: "300,000₫", period: "/mo", desc: "For studios & professional teams", cta: "Try Studio", accent: true, f: ["All Photographer Plus features", "Watermark protection inside client albums", "Unlimited albums & Drive compress", "Income, debt & revenue reporting", "Crew payout reconciliation · team & ranking", "Job board and photo/video/print progress", "Dress rental · equipment & loan schedule", "Wedding invites · Love Story · slideshows · album design", "Priority support · all future features"] },
      ],
      plus: { name: "Photographer Plus", price: "129,000₫", tagline: "Plus upgrade — adds contracts, quotes & a custom domain", cta: "Try Plus", f: ["100 albums / month", "Contracts: online signing + line-item quotes", "Website on your own domain (studio.com)"] },
    },
    reviews: {
      title: "Trusted by studios",
      items: [
        { q: "I used to manage schedules with Excel and chat apps. Now everything lives in mstudo — no more double-booked shoots.", n: "Minh Anh", role: "Owner, AnhMinh Photography", i: "MA" },
        { q: "The revenue reports tell me how each month performed in just seconds.", n: "Hoàng Long", role: "Founder, LightHouse Studio", i: "HL" },
        { q: "Splitting shifts and paying my team of 8 is so much easier with mstudo.", n: "Thu Hà", role: "Manager, Bloom Wedding Studio", i: "TH" },
      ],
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        { q: "Is mstudo free?", a: "Yes. The Free plan is free forever with core features. You can upgrade to Basic, Photographer or Studio anytime." },
        { q: "Do I need to install anything?", a: "No. mstudo runs entirely in your browser — just log in and use it on desktop or mobile." },
        { q: "Is my data safe?", a: "Your data is encrypted and backed up regularly. Only you and authorized staff can access it." },
        { q: "Does mstudo support multiple branches?", a: "Yes, the Studio plan lets you manage multiple branches with separate permissions." },
        { q: "Can I import data from Excel?", a: "Yes. mstudo supports importing clients and bookings from Excel/CSV files." },
        { q: "How do I get support?", a: "Reach us by email, hotline or in-app chat. Studio plan gets dedicated priority support." },
      ],
    },
    about: {
      title: "About mstudo",
      text: "mstudo is an all-in-one studio management solution built for photography studios in Vietnam. We help studios digitize their entire workflow — from bookings and orders to finances and staff.",
      company: "A product of Vieetjk", addrLabel: "Address", address: "Quang Ngai", email: "vieetjk@gmail.com", phone: "0974.374.744",
    },
    footer: { copy: "© 2026 mstudo. A product of Vieetjk" },
  },
};

/* ── Feature icons (match the design) ──────────────────────────────────── */
const stroke = { fill: "none", stroke: "var(--accent)", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const FEATURE_ICONS: ReactNode[] = [
  <svg key="0" width="22" height="22" viewBox="0 0 24 24" {...stroke}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v3.2M16 3v3.2" /></svg>,
  <svg key="1" width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M6 3.5h8l4 4v13H6Z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></svg>,
  <svg key="2" width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v9M9.7 9.8c0-1.2 1-1.9 2.3-1.9s2.3.7 2.3 1.7c0 2.5-4.6 1.3-4.6 3.8 0 1 1 1.8 2.3 1.8s2.3-.7 2.3-1.9" /></svg>,
  <svg key="3" width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><circle cx="17.5" cy="9" r="2.4" /><path d="M16 14.4c2.6.2 4.5 2 4.5 4.6" /></svg>,
  <svg key="4" width="22" height="22" viewBox="0 0 24 24" {...stroke}><path d="M4 20V4M4 20h16" /><rect x="7.5" y="11" width="3" height="6" /><rect x="13" y="7" width="3" height="10" /></svg>,
  <svg key="5" width="22" height="22" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20c0-3.4 2.9-6 6.5-6s6.5 2.6 6.5 6" /></svg>,
];

const Check = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 1 }}><path d="M20 6 9 17l-5-5" /></svg>
);

/* ── Reusable style fragments ──────────────────────────────────────────── */
const wrap: CSSProperties = { maxWidth: 1160, margin: "0 auto", padding: "0 24px" };
const h2: CSSProperties = { fontSize: "clamp(28px,3.6vw,40px)", letterSpacing: "-.03em", fontWeight: 800, margin: 0, textWrap: "balance" as never };
const sectionSub: CSSProperties = { color: "var(--muted)", fontSize: 17, lineHeight: 1.6, margin: "14px 0 0" };
const cardBase: CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 16, padding: 26 };
const navLink: CSSProperties = { color: "var(--muted)", textDecoration: "none", fontSize: 14.5, fontWeight: 500 };

/** Logo đổi theo giao diện bằng CSS (html[data-theme]) — không cần JS/state. */
function ThemedWordmark({ height }: { height: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-wordmark.svg" alt="mstudo" className="ms-logo-light" style={{ height, width: "auto" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-wordmark-dark.svg" alt="mstudo" className="ms-logo-dark" style={{ height, width: "auto" }} />
    </>
  );
}

/** Giá hiển thị của một gói cho một chu kỳ (đã áp giảm giá admin cấu hình). */
function planPricing(
  pricing: LandingPricing | undefined,
  name: string,
  cycle: "month" | "year",
  lang: "vi" | "en"
): { price: string; period: string; full?: string; off?: number } | null {
  if (!pricing) return null;
  const per = (m: number, y: number) => (cycle === "month" ? m : y);
  let base: number, disc: number;
  if (name === "Basic") { base = per(pricing.basicMonth, pricing.basicYear); disc = pricing.basicDiscount; }
  else if (name === "Photographer") { base = per(pricing.photographerMonth, pricing.photographerYear); disc = pricing.photographerDiscount; }
  else if (name === "Studio") {
    base = per(pricing.studioMonth, pricing.studioYear);
    disc = Math.max(pricing.studioDiscount, cycle === "year" ? pricing.studioPromo : 0);
  } else return null; // Free (and anything else) keeps its static price
  return fmtPrice(base, disc, cycle, lang);
}

/** Giá gói Photographer Plus (gộp trong thẻ Photographer) theo chu kỳ. */
function plusPricing(
  pricing: LandingPricing | undefined,
  cycle: "month" | "year",
  lang: "vi" | "en"
): { price: string; period: string; full?: string; off?: number } | null {
  if (!pricing) return null;
  const base = cycle === "month" ? pricing.photographerPlusMonth : pricing.photographerPlusYear;
  const disc = cycle === "month" ? pricing.photographerPlusDiscountMonth : pricing.photographerPlusDiscountYear;
  return fmtPrice(base, disc, cycle, lang);
}

function fmtPrice(base: number, disc: number, cycle: "month" | "year", lang: "vi" | "en") {
  const off = Math.max(0, Math.min(100, disc));
  const now = Math.round(base * (1 - off / 100));
  const period = cycle === "month" ? (lang === "en" ? "/mo" : "/tháng") : (lang === "en" ? "/yr" : "/năm");
  return { price: fmtVnd(now), period, full: off > 0 ? fmtVnd(base) : undefined, off: off > 0 ? off : undefined };
}

function PriceRow({ dyn, fallbackPrice, fallbackPeriod, className }: {
  dyn: { price: string; period: string; full?: string; off?: number } | null;
  fallbackPrice: string;
  fallbackPeriod: string;
  className?: string;
}) {
  // Dòng giá GIẢM: chỉ giá + chu kỳ (giá gốc gạch ngang & nhãn -x% nằm ở dòng
  // tên) — giữ dòng này ngắn để giá năm lớn ("2.000.000₫") không tràn khung.
  // nowrap + chiều cao cố định để nút "Dùng thử" các gói thẳng hàng.
  return (
    <div className={className} style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "10px 0 4px", flexWrap: "nowrap", height: 40, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>{dyn?.price ?? fallbackPrice}</span>
      <span style={{ color: "var(--muted)", fontSize: 14 }}>{dyn?.period ?? fallbackPeriod}</span>
    </div>
  );
}

export default function LandingPage({ lang, pricing }: { lang: Lang; pricing?: LandingPricing }) {
  const L = D[lang === "en" ? "en" : "vi"];
  const loginUrl = mainUrl("/login");

  const primaryBtn: CSSProperties = { height: 36, padding: "0 16px", border: "none", background: "var(--accent)", color: "var(--accentFg)", borderRadius: 9, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" };
  const ghostBtn: CSSProperties = { height: 36, padding: "0 14px", border: "1px solid var(--border)", background: "transparent", color: "var(--fg)", borderRadius: 9, fontFamily: "inherit", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none" };

  return (
    <div className="mstudo-landing" style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "color-mix(in srgb,var(--bg) 86%,transparent)", backdropFilter: "saturate(180%) blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ ...wrap, height: 68, display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <ThemedWordmark height={38} />
          </a>
          <nav style={{ display: "flex", gap: 26, marginLeft: 8 }} className="ms-nav">
            <a href="#features" style={navLink}>{L.nav.features}</a>
            <a href="#guide" style={navLink}>{L.nav.guide}</a>
            <a href="#pricing" style={navLink}>{L.nav.pricing}</a>
            <a href="#faq" style={navLink}>{L.nav.faq}</a>
            <a href="#about" style={navLink}>{L.nav.about}</a>
            <a href="#contact" style={navLink}>{L.nav.contact}</a>
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <LandingControls lang={lang} />
            <Link href={`${loginUrl}?next=/dashboard/site`} style={{ ...ghostBtn, gap: 6 }} className="ms-website-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z" /></svg>
              {L.nav.website}
            </Link>
            <Link href={loginUrl} style={primaryBtn} className="ms-start-btn">{L.nav.start}</Link>
            <LandingMobileMenu
              items={[
                { href: "#features", label: L.nav.features },
                { href: "#guide", label: L.nav.guide },
                { href: "#pricing", label: L.nav.pricing },
                { href: "#faq", label: L.nav.faq },
                { href: "#about", label: L.nav.about },
                { href: "#contact", label: L.nav.contact },
              ]}
              loginUrl={loginUrl}
              websiteHref={`${loginUrl}?next=/dashboard/site`}
              websiteLabel={L.nav.website}
              startLabel={L.nav.start}
            />
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section style={{ ...wrap, padding: "84px 24px 72px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 999, fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 26 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />{L.hero.badge}
          </div>
          <h1 style={{ fontSize: "clamp(38px,5.4vw,64px)", lineHeight: 1.05, letterSpacing: "-.035em", fontWeight: 800, margin: "0 auto", maxWidth: 880, textWrap: "balance" as never }}>{L.hero.title}</h1>
          <p style={{ fontSize: "clamp(17px,1.9vw,20px)", lineHeight: 1.6, color: "var(--muted)", maxWidth: 620, margin: "22px auto 0", textWrap: "pretty" as never }}>{L.hero.sub}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 34 }}>
            <Link href={loginUrl} style={{ ...primaryBtn, height: 50, padding: "0 26px", borderRadius: 11, fontSize: 16, boxShadow: "var(--shadow)" }}>{L.hero.ctaPrimary}</Link>
            <Link href={`${loginUrl}?next=/dashboard/site`} style={{ ...ghostBtn, height: 50, padding: "0 26px", background: "var(--surface)", borderRadius: 11, fontSize: 16, fontWeight: 700, gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z" /></svg>
              {L.hero.ctaWebsite}
            </Link>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 18 }}>{L.hero.note}</p>

          {/* product showcase video (looping animation) */}
          <div style={{ marginTop: 56, borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
            <MstudoVideo />
            <span style={{ display: "none" }}>{L.hero.shot}</span>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" style={{ ...wrap, padding: "64px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
            <h2 style={h2}>{L.feat.title}</h2>
            <p style={sectionSub}>{L.feat.sub}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
            {L.feat.cards.map((c, i) => (
              <div key={c.t} style={cardBase}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: "var(--accentSoft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>{FEATURE_ICONS[i]}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{c.t}</h3>
                <p style={{ color: "var(--muted)", fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{c.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* GUIDE */}
        <section id="guide" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ ...wrap, padding: "72px 24px" }}>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
              <h2 style={h2}>{L.guide.title}</h2>
              <p style={sectionSub}>{L.guide.sub}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18 }}>
              {L.guide.steps.map((s, i) => (
                <div key={s.t} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 26 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, background: "var(--accent)", color: "var(--accentFg)", fontWeight: 800, marginBottom: 16 }}>{i + 1}</span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px" }}>{s.t}</h3>
                  <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING — thẻ giá render trên server với CẢ HAI biến thể tháng/năm;
            island CyclePricing chỉ giữ state toggle và CSS ẩn/hiện theo data-cycle. */}
        <section id="pricing" style={{ ...wrap, padding: "72px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 28px" }}>
            <h2 style={h2}>{L.pricing.title}</h2>
            <p style={sectionSub}>{L.pricing.sub}</p>
            <p style={{ marginTop: 10, display: "inline-block", background: "var(--accentSoft)", color: "var(--accent-strong)", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 999 }}>
              {lang === "en" ? "🎁 Buy yearly, get 30 bonus days — all plans" : "🎁 Mua gói theo năm — tặng thêm 30 ngày cho tất cả các gói"}
            </p>
          </div>
          <CyclePricing
            monthLabel={lang === "en" ? "Monthly" : "Theo tháng"}
            yearLabel={lang === "en" ? "Yearly" : "Theo năm"}
          >
            <div className="ms-pricing-grid">
              {(() => {
                const lng = lang === "en" ? "en" : "vi";
                // Có gói nào đang giảm giá không? Nếu có, mọi thẻ dành riêng 1 dòng
                // (giá gốc + -x%) để nút "Dùng thử" vẫn thẳng hàng.
                const hasAnyDiscount = !!pricing && L.pricing.plans.some((pp) => {
                  const m = planPricing(pricing, pp.name, "month", lng);
                  const y = planPricing(pricing, pp.name, "year", lng);
                  return m?.off || y?.off;
                });
                return L.pricing.plans.map((p) => {
                const dynMonth = planPricing(pricing, p.name, "month", lng);
                const dynYear = planPricing(pricing, p.name, "year", lng);
                // Gộp gói Plus vào thẻ Photographer (bớt 1 cột).
                const showPlus = p.name === "Photographer";
                const plusMonth = showPlus ? plusPricing(pricing, "month", lng) : null;
                const plusYear = showPlus ? plusPricing(pricing, "year", lng) : null;
                return (
                  <div key={p.name} style={{ border: p.accent ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: "var(--surface)", borderRadius: 18, padding: 30, position: "relative", boxShadow: p.accent ? "var(--shadow)" : undefined, display: "flex", flexDirection: "column", height: "100%" }}>
                    {p.accent && <span style={{ position: "absolute", top: -12, left: 30, background: "var(--accent)", color: "var(--accentFg)", fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 999 }}>{L.pricing.popular}</span>}
                    {/* Dòng tên gói. */}
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: p.accent ? "var(--accent-strong)" : "var(--muted)" }}>{p.name}</h3>
                    {/* Dòng giá gốc (gạch ngang) + nhãn -x% — dòng ngắn riêng nên giá
                        năm lớn không tràn khung; chiều cao cố định để nút thẳng hàng. */}
                    {hasAnyDiscount && (
                      <div style={{ height: 18, marginTop: 8, display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
                        {dynMonth && (dynMonth.full || dynMonth.off) && (
                          <span className="ms-cy-month" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                            {dynMonth.full && <span style={{ color: "var(--muted)", fontSize: 14, textDecoration: "line-through" }}>{dynMonth.full}</span>}
                            {dynMonth.off && <span style={{ background: "var(--accentSoft)", color: "var(--accent-strong)", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{`-${dynMonth.off}%`}</span>}
                          </span>
                        )}
                        {dynYear && (dynYear.full || dynYear.off) && (
                          <span className="ms-cy-year" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                            {dynYear.full && <span style={{ color: "var(--muted)", fontSize: 14, textDecoration: "line-through" }}>{dynYear.full}</span>}
                            {dynYear.off && <span style={{ background: "var(--accentSoft)", color: "var(--accent-strong)", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{`-${dynYear.off}%`}</span>}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Dòng giá đã giảm + chu kỳ. */}
                    <PriceRow className="ms-cy-month" dyn={dynMonth} fallbackPrice={p.price} fallbackPeriod={p.period} />
                    <PriceRow className="ms-cy-year" dyn={dynYear} fallbackPrice={p.price} fallbackPeriod={p.period} />
                    {/* Cố định chiều cao mô tả (2 dòng) để nút "Dùng thử" của mọi
                        gói thẳng hàng nhau. */}
                    <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: "20px", margin: "0 0 20px", height: 40, overflow: "hidden" }}>{p.desc}</p>
                    <Link href={loginUrl} style={{ width: "100%", height: 44, border: p.accent ? "none" : "1px solid var(--border)", background: p.accent ? "var(--accent)" : "var(--bg)", color: p.accent ? "var(--accentFg)" : "var(--fg)", borderRadius: 10, fontFamily: "inherit", fontWeight: 700, fontSize: 14.5, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>{p.cta}</Link>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {p.f.map((line) => (
                        <div key={line} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14, color: "var(--fg)", padding: "6px 0" }}><Check />{line}</div>
                      ))}
                    </div>

                    {/* Nâng cấp Plus — gộp trong thẻ Photographer để bớt 1 cột. */}
                    {showPlus && (
                      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{L.pricing.plus.name}</span>
                          <span className="ms-cy-month" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                            {plusMonth?.full && <span style={{ color: "var(--muted)", fontSize: 13, textDecoration: "line-through" }}>{plusMonth.full}</span>}
                            <span style={{ fontSize: 20, fontWeight: 800 }}>{plusMonth?.price ?? L.pricing.plus.price}</span>
                            <span style={{ color: "var(--muted)", fontSize: 13 }}>{plusMonth?.period ?? (lng === "en" ? "/mo" : "/tháng")}</span>
                            {plusMonth?.off && <span style={{ background: "var(--accentSoft)", color: "var(--accent-strong)", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{`-${plusMonth.off}%`}</span>}
                          </span>
                          <span className="ms-cy-year" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                            {plusYear?.full && <span style={{ color: "var(--muted)", fontSize: 13, textDecoration: "line-through" }}>{plusYear.full}</span>}
                            <span style={{ fontSize: 20, fontWeight: 800 }}>{plusYear?.price ?? L.pricing.plus.price}</span>
                            <span style={{ color: "var(--muted)", fontSize: 13 }}>{plusYear?.period ?? (lng === "en" ? "/yr" : "/năm")}</span>
                            {plusYear?.off && <span style={{ background: "var(--accentSoft)", color: "var(--accent-strong)", fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 999 }}>{`-${plusYear.off}%`}</span>}
                          </span>
                        </div>
                        <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 12px", lineHeight: 1.5 }}>{L.pricing.plus.tagline}</p>
                        <div style={{ display: "flex", flexDirection: "column", marginBottom: 14 }}>
                          {L.pricing.plus.f.map((line) => (
                            <div key={line} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 13.5, color: "var(--fg)", padding: "5px 0" }}><Check />{line}</div>
                          ))}
                        </div>
                        <Link href={loginUrl} style={{ width: "100%", height: 40, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", borderRadius: 10, fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>{L.pricing.plus.cta}</Link>
                      </div>
                    )}
                  </div>
                );
                });
              })()}
            </div>
          </CyclePricing>
        </section>

        {/* REVIEWS */}
        <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ ...wrap, padding: "72px 24px" }}>
            <h2 style={{ ...h2, margin: "0 0 44px", textAlign: "center" }}>{L.reviews.title}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
              {L.reviews.items.map((r) => (
                <figure key={r.n} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, margin: 0 }}>
                  <blockquote style={{ margin: "0 0 22px", fontSize: 16, lineHeight: 1.65 }}>“{r.q}”</blockquote>
                  <figcaption style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accentSoft)", color: "var(--accent-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{r.i}</span>
                    <span><strong style={{ display: "block", fontSize: 14.5 }}>{r.n}</strong><span style={{ color: "var(--muted)", fontSize: 13 }}>{r.role}</span></span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ — <details name> gốc của trình duyệt: accordion không cần JS
            (name giữ tối đa một mục mở trên trình duyệt mới; trình duyệt cũ
            degrade thành cho phép mở nhiều mục — vẫn dùng tốt). */}
        <section id="faq" style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px" }}>
          <h2 style={{ ...h2, margin: "0 0 36px", textAlign: "center" }}>{L.faq.title}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {L.faq.items.map((f, i) => (
              <details
                key={f.q}
                className="ms-faq"
                open={i === 0}
                {...({ name: "landing-faq" } as Record<string, string>)}
                style={{ border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 13, overflow: "hidden" }}
              >
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", color: "var(--fg)", fontFamily: "inherit", fontSize: 15.5, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>
                  {f.q}
                  <span className="ms-faq-icon" aria-hidden style={{ flex: "none", fontSize: 22, lineHeight: 1, color: "var(--accent)", fontWeight: 400 }} />
                </summary>
                <p style={{ margin: 0, padding: "0 20px 20px", color: "var(--muted)", fontSize: 14.5, lineHeight: 1.65 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CONTACT / FEEDBACK */}
        <ContactSection lang={lang} />

        {/* ABOUT */}
        <section id="about" style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
          <div style={{ ...wrap, padding: "72px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 44, alignItems: "center" }}>
            <div>
              <h2 style={{ ...h2, fontSize: "clamp(26px,3.4vw,36px)", margin: "0 0 18px" }}>{L.about.title}</h2>
              <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.7, margin: 0, textWrap: "pretty" as never }}>{L.about.text}</p>
            </div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 28 }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 16px" }}>{L.about.company}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14.5, color: "var(--muted)" }}>
                <span><strong style={{ color: "var(--fg)", fontWeight: 600 }}>{L.about.addrLabel}:</strong> {L.about.address}</span>
                <span><strong style={{ color: "var(--fg)", fontWeight: 600 }}>Email:</strong> {L.about.email}</span>
                <span><strong style={{ color: "var(--fg)", fontWeight: 600 }}>Hotline:</strong> {L.about.phone}</span>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ background: "var(--bg)" }}>
          <div style={{ ...wrap, padding: "48px 24px", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ThemedWordmark height={32} />
              <span style={{ color: "var(--muted)", fontSize: 13.5 }}>{L.hero.badge}</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>{L.footer.copy}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
