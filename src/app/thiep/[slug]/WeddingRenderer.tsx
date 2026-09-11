import type { WeddingConfig, WeddingInvitation } from "@/lib/types";
import type { Wish } from "./shared";
import EnvelopeIntro from "./EnvelopeIntro";
import ClassicTemplate from "./designs/ClassicTemplate";
import ElegantTemplate from "./designs/ElegantTemplate";
import FloralTemplate from "./designs/FloralTemplate";
import ModernTemplate from "./designs/ModernTemplate";
import CinematicTemplate from "./designs/CinematicTemplate";
import StorySlideTemplate from "./designs/StorySlideTemplate";
import EditorialTemplate from "./designs/EditorialTemplate";
import RoyalTemplate from "./designs/RoyalTemplate";
import SweetTemplate from "./designs/SweetTemplate";
import SenTemplate from "./designs/phone/SenTemplate";
import SonMaiTemplate from "./designs/phone/SonMaiTemplate";
import GiayDoTemplate from "./designs/phone/GiayDoTemplate";
import Y2kTemplate from "./designs/phone/Y2kTemplate";
import AuroraTemplate from "./designs/phone/AuroraTemplate";
import SongHyTemplate from "./designs/phone/SongHyTemplate";
import VintageTemplate from "./designs/phone/VintageTemplate";
import GlassTemplate from "./designs/phone/GlassTemplate";
import NeonTemplate from "./designs/phone/NeonTemplate";
import ScrapbookTemplate from "./designs/phone/ScrapbookTemplate";
import { isPhoneTemplate } from "./templates";
import { PreviewProvider } from "./preview-mode";

export type { Wish };

const TEMPLATES = {
  classic: ClassicTemplate,
  elegant: ElegantTemplate,
  floral: FloralTemplate,
  modern: ModernTemplate,
  cinematic: CinematicTemplate,
  story: StorySlideTemplate,
  editorial: EditorialTemplate,
  royal: RoyalTemplate,
  sweet: SweetTemplate,
  // Bộ "thiệp điện thoại" — khổ dọc 390–430px, cuộn một mạch.
  sen: SenTemplate,
  sonmai: SonMaiTemplate,
  giaydo: GiayDoTemplate,
  y2k: Y2kTemplate,
  aurora: AuroraTemplate,
  songhy: SongHyTemplate,
  vintage: VintageTemplate,
  glass: GlassTemplate,
  neon: NeonTemplate,
  scrapbook: ScrapbookTemplate,
} as const;

/**
 * Dispatches to the chosen template — each is its own distinct design.
 *
 * `preview` được bật khi thiệp render bên trong trình chỉnh sửa: bỏ hiệu ứng bì
 * thư (che mất nội dung đang sửa) và cho các khối cố định biết là đang ở trong
 * khung xem trước chứ không phải cả màn hình.
 */
export default function WeddingRenderer({ inv, wishes = [], guest = "", storyUrl = "", preview = false }: { inv: WeddingInvitation; wishes?: Wish[]; guest?: string; storyUrl?: string; preview?: boolean }) {
  const Template = TEMPLATES[inv.template as keyof typeof TEMPLATES] ?? ClassicTemplate;
  const cfg = inv.config as WeddingConfig;
  const accent = cfg?.accent || "#b08968";
  const label = cfg?.guest_greeting?.trim() || "Trân trọng kính mời";
  const couple = [cfg?.groom_name, cfg?.bride_name].filter(Boolean).join(" & ");
  const phone = isPhoneTemplate(inv.template);

  const body = (
    <>
      {guest && !preview && <EnvelopeIntro name={guest} label={label} couple={couple} accent={accent} />}
      {/* Tên khách mời được đưa VÀO nội dung mỗi mẫu (sau phần "Ngày trọng đại"),
          không còn cố định ở đầu trang. */}
      <Template inv={inv} wishes={wishes} guest={guest} />
      {storyUrl && <StoryCta url={guest ? `${storyUrl}${storyUrl.includes("?") ? "&" : "?"}guest=${encodeURIComponent(guest)}` : storyUrl} accent={accent} phone={phone} />}
    </>
  );

  return preview ? <PreviewProvider preview>{body}</PreviewProvider> : body;
}

/** Màu chữ dễ đọc (đen/trắng) trên một màu nền bất kỳ — chọn theo tương phản
 *  WCAG cao hơn, để nút không bị chữ trắng mờ trên accent sáng studio chọn. */
function readableInk(hex: string): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec((hex || "").trim());
  if (!m) return "#fff";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const chan = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
  const contrastWhite = 1.05 / (L + 0.05);
  const contrastDark = (L + 0.05) / 0.05;
  return contrastDark >= contrastWhite ? "#1a1205" : "#fff";
}

/** Nút "Xem Love Story" ở CUỐI thiệp (cạnh phần xác nhận tham dự). */
function StoryCta({ url, accent, phone }: { url: string; accent: string; phone?: boolean }) {
  return (
    // Mẫu khổ điện thoại chỉ rộng 430px → bó khối này lại cho thẳng hàng với thiệp.
    <section style={{ padding: "48px 24px 60px", textAlign: "center", borderTop: `1px solid ${accent}33`, ...(phone ? { maxWidth: 430, margin: "0 auto" } : null) }}>
      <p style={{ fontFamily: "var(--font-cormorant), serif", fontSize: 12.5, letterSpacing: ".24em", textTransform: "uppercase", color: accent }}>Chuyện tình yêu</p>
      <p style={{ fontFamily: "var(--font-hand), cursive", fontSize: 40, lineHeight: 1.1, color: accent, margin: "4px 0 18px" }}>Love Story</p>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: accent, color: readableInk(accent), borderRadius: 999, padding: "12px 30px", fontSize: 15, fontWeight: 600, textDecoration: "none", boxShadow: "0 8px 22px rgba(0,0,0,.16)" }}>💌 Xem Love Story của chúng mình</a>
    </section>
  );
}
