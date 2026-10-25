"use client";

import {
  AtSign, Award, BarChart3, Briefcase, Check, Code2, HelpCircle, Image as ImageIcon, ImagePlus, Images, Info,
  MapPin, MessageSquareQuote, MousePointerClick, Phone, Quote, RefreshCw, Tag, Users, Video, X, type LucideIcon,
} from "lucide-react";
import { Badge, Field, btn, iconBtn, inputCls, type Tone } from "@/components/v2/kit";
import type { createClient } from "@/lib/supabase/client";
import type { Site, SiteBlockType } from "@/lib/types";
import { DOMAIN_STATE_LABEL, useSiteSeo, type DomainState, type useSitePublishing } from "./useSiteSettings";

/* ═══════════════════════════════════════════════════════════════════════════
   Mảnh giao diện mới DÙNG CHUNG giữa màn tổng quan Website (WebsiteHubV2) và
   trình dựng (CanvasBuilderV2): ô tên miền phụ, khối SEO, nhãn tình trạng tên
   miền, icon từng loại khối, toast. Logic lưu nằm ở ./useSiteSettings — ở đây
   chỉ có cách vẽ.
   ═══════════════════════════════════════════════════════════════════════════ */

type Publishing = ReturnType<typeof useSitePublishing>;

/** Icon cho từng loại khối — để danh sách khối nhìn lướt là nhận ra. */
export const BLOCK_ICON: Record<SiteBlockType, LucideIcon> = {
  hero: ImageIcon,
  gallery: Images,
  about: Info,
  services: Briefcase,
  stats: BarChart3,
  pricing: Tag,
  testimonials: MessageSquareQuote,
  quote: Quote,
  cta: MousePointerClick,
  team: Users,
  logos: Award,
  video: Video,
  social: AtSign,
  faq: HelpCircle,
  map: MapPin,
  contact: Phone,
  html: Code2,
};
export const blockIcon = (t: string): LucideIcon => BLOCK_ICON[t as SiteBlockType] ?? ImageIcon;

const DOMAIN_BADGE: Record<DomainState, [Tone, string]> = {
  ready: ["green", "Đang chạy"],
  pending: ["amber", "Chờ DNS"],
  conflict: ["red", "Bị trùng"],
  manual: ["amber", "Cần thêm thủ công"],
};

/** Nhãn tình trạng tên miền phụ (rê chuột xem câu đầy đủ). */
export function DomainStateBadge({ state, saved }: { state: DomainState | null; saved: boolean }) {
  if (!saved) return <Badge tone="gray" dot>Chưa đặt</Badge>;
  if (!state) return null;
  const [tone, label] = DOMAIN_BADGE[state];
  return (
    <Badge tone={tone} dot title={DOMAIN_STATE_LABEL[state]}>
      {label}
    </Badge>
  );
}

/** Ô tên miền phụ `<ten>.mstudo.com` — Enter hoặc "Lưu" để lưu, nút tròn để kiểm tra đã chạy chưa. */
export function SubdomainField({ pub, mainHost, stacked = false }: { pub: Publishing; mainHost: string; /** Cột hẹp: nút xuống dòng dưới ô. */ stacked?: boolean }) {
  const unchanged = pub.subdomain.trim().toLowerCase() === pub.savedSub;
  return (
    <Field
      label="Tên miền phụ"
      hint={
        pub.domainState && pub.savedSub ? (
          <span style={{ color: pub.domainState === "ready" ? "var(--tx3)" : pub.domainState === "conflict" ? "var(--rd)" : "var(--am)" }}>
            {DOMAIN_STATE_LABEL[pub.domainState]}
          </span>
        ) : (
          "Chỉ chữ thường, số và dấu gạch ngang. Để trống rồi lưu là bỏ tên miền phụ."
        )
      }
    >
      <div className={stacked ? "flex flex-col gap-2" : "flex items-center gap-2"}>
        <label className="v2-search min-w-0 flex-1" style={{ boxShadow: "none" }}>
          <input
            value={pub.subdomain}
            onChange={(e) => pub.setSubdomain(e.target.value.toLowerCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") pub.saveDomain();
            }}
            placeholder="ten-cua-ban"
            spellCheck={false}
            aria-label="Tên miền phụ"
            className="font-semibold"
          />
          <span className="flex-none text-[13px]" style={{ color: "var(--tx3)" }}>
            .{mainHost || "mstudo.com"}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pub.saveDomain}
            disabled={pub.savingDomain || unchanged}
            className={btn(unchanged ? "secondary" : "soft", stacked ? "sm" : "md")}
          >
            <Check size={15} /> Lưu
          </button>
          {pub.savedSub ? (
            stacked ? (
              <button type="button" onClick={pub.checkDomain} disabled={pub.savingDomain} className={btn("ghost", "sm")}>
                <RefreshCw size={14} className={pub.savingDomain ? "animate-spin" : undefined} /> Kiểm tra
              </button>
            ) : (
              <button
                type="button"
                onClick={pub.checkDomain}
                disabled={pub.savingDomain}
                className={iconBtn()}
                aria-label="Kiểm tra tên miền đã chạy chưa"
                title="Kiểm tra tên miền đã chạy chưa"
              >
                <RefreshCw size={16} className={pub.savingDomain ? "animate-spin" : undefined} />
              </button>
            )
          ) : null}
        </div>
      </div>
    </Field>
  );
}

/** Khối SEO & ảnh chia sẻ — tiêu đề, mô tả, ảnh 1200×630, kèm bản xem trước kiểu Google. */
export function SeoFields({
  site,
  supabase,
  onFlash,
  host,
  compact = false,
}: {
  site: Site;
  supabase: ReturnType<typeof createClient>;
  onFlash: (m: string) => void;
  /** Địa chỉ trang (để vẽ bản xem trước). */
  host?: string;
  /** true = bỏ bản xem trước Google (cột hẹp của trình dựng). */
  compact?: boolean;
}) {
  const { seo, setSeo, busy, save, pickOg, titleLen, descLen } = useSiteSeo({ site, supabase, onFlash });
  const over = (n: number, max: number) => n > max;

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="Tiêu đề trang"
        hint={
          <span style={{ color: over(titleLen, 60) ? "var(--am)" : undefined }}>
            {titleLen}/60 ký tự{over(titleLen, 60) ? " — Google sẽ cắt bớt" : ""}
          </span>
        }
      >
        <input
          className={inputCls}
          placeholder="vd: Mộc Studio — Ảnh cưới Đà Nẵng"
          value={seo.title ?? ""}
          onChange={(e) => setSeo({ ...seo, title: e.target.value })}
          onBlur={(e) => save({ ...seo, title: e.target.value.trim() })}
        />
      </Field>
      <Field
        label="Mô tả ngắn"
        hint={
          <span style={{ color: over(descLen, 160) ? "var(--am)" : undefined }}>
            {descLen}/160 ký tự{over(descLen, 160) ? " — Google sẽ cắt bớt" : ""}
          </span>
        }
      >
        <textarea
          className={inputCls}
          rows={3}
          style={{ minHeight: 76 }}
          placeholder="Studio làm gì, ở đâu, thế mạnh gì."
          value={seo.description ?? ""}
          onChange={(e) => setSeo({ ...seo, description: e.target.value })}
          onBlur={(e) => save({ ...seo, description: e.target.value.trim() })}
        />
      </Field>

      <Field label="Ảnh khi chia sẻ link" hint="Để trống thì hệ thống dùng tên studio và ảnh bìa sẵn có.">
        {seo.og_image ? (
          <div className="relative overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--bd)" }}>
            <img src={seo.og_image} alt="Ảnh chia sẻ" className="block w-full object-cover" style={{ aspectRatio: "1200/630" }} />
            <button
              type="button"
              onClick={() => save({ ...seo, og_image: "" })}
              aria-label="Gỡ ảnh chia sẻ"
              title="Gỡ ảnh"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "rgba(10,18,30,.66)", color: "#fff" }}
            >
              <X size={15} />
            </button>
          </div>
        ) : null}
        <label className={btn("secondary", "md", `w-full ${busy ? "cursor-wait" : "cursor-pointer"}`)}>
          <ImagePlus size={16} /> {busy ? "Đang tải…" : seo.og_image ? "Đổi ảnh chia sẻ" : "Tải ảnh chia sẻ (1200×630)"}
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pickOg(f);
            }}
          />
        </label>
      </Field>

      {!compact && (
        <div className="rounded-[12px] px-3.5 py-3" style={{ background: "var(--sf2)" }}>
          <p className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--tx3)" }}>
            Xem trước trên Google
          </p>
          <p className="truncate text-[12.5px]" style={{ color: "var(--tx3)" }}>{host || "ten-cua-ban.mstudo.com"}</p>
          <p className="truncate text-[15px] font-medium" style={{ color: "var(--bl)" }}>
            {seo.title?.trim() || "Tên studio của bạn"}
          </p>
          <p className="line-clamp-2 text-[12.5px]" style={{ color: "var(--tx2)" }}>
            {seo.description?.trim() || "Mô tả ngắn về studio sẽ hiện ở đây."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Thông báo ngắn dính đáy màn (nằm trên thanh tab của điện thoại). */
export function ToastV2({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="fixed left-1/2 z-[90] max-w-[min(560px,calc(100vw-32px))] -translate-x-1/2 rounded-[14px] px-4 py-2.5 text-[13px] font-semibold bottom-[96px] lg:bottom-6"
      style={{ background: "var(--tx)", color: "var(--sf)", boxShadow: "var(--sh-pop)" }}
    >
      {children}
    </div>
  );
}
