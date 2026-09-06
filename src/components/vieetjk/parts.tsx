import type { VjkAlbum, VjkFeedback } from "@/lib/vieetjk/data";
import { UI, tr, type Lang, type PriceTier, type InfoItem } from "@/lib/vieetjk/content";

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Lưới ảnh (masonry) từ album; click mở album công khai /album/<slug>. */
export function Gallery({ albums, lang, emptyHint }: { albums: VjkAlbum[]; lang: Lang; emptyHint?: string }) {
  if (!albums.length) {
    return <div className="vjk-empty">{emptyHint || tr(lang, UI.galleryEmpty)}</div>;
  }
  return (
    <div className="vjk-gal">
      {albums.map((a) => (
        <a key={a.id} href={`/album/${a.slug}`} className="vjk-gal-item" title={a.title}>
          {a.cover_url ? (
            <img src={a.cover_url} alt={a.title} loading="lazy" />
          ) : (
            <div className="vjk-scard-ph" style={{ aspectRatio: "4 / 3" }} />
          )}
          <span className="vjk-gal-cap">{a.title}</span>
        </a>
      ))}
    </div>
  );
}

// ── Bảng giá cưới: slider ô gói (đám cưới / đính hôn riêng hàng) ─────────────
export type WeddingCard = {
  name: string;
  note: string;
  price: number | null;
  detail: string;
  bookHref: string;
  fullHref: string | null;
};
export type WeddingGroup = { title: string; cards: WeddingCard[] };

export function WeddingPricing({ groups, lang }: { groups: WeddingGroup[]; lang: Lang }) {
  return (
    <div>
      {groups.map((g) => (
        <div className="vjk-wgroup" key={g.title}>
          <div className="vjk-wgroup-h">{g.title}</div>
          <div className="vjk-slide">
            {g.cards.map((c, i) => (
              <div className="vjk-wpkg" key={`${c.name}-${i}`}>
                <div className="wp-top">
                  <div className="wp-name">{c.name}</div>
                  <div className="wp-note">{c.note}</div>
                  <div className="wp-price">{c.price != null ? fmt(c.price) : tr(lang, UI.contactPrice)}</div>
                </div>
                <a className="wp-book" href={c.bookHref}>{tr(lang, UI.book)}</a>
                <div className="wp-sep" />
                <div className="wp-detail">
                  {c.detail ? (
                    <>
                      <div className="wp-dt">{tr(lang, UI.includes)}</div>
                      <ul className="wp-dl">
                        {c.detail.split("\n").map((s) => s.trim()).filter(Boolean).map((line, li) => (
                          <li key={li}>{line}</li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <span style={{ color: "var(--ink3)", fontSize: 13 }}>—</span>
                  )}
                </div>
                {c.fullHref && (
                  <div className="wp-more">
                    <a href={c.fullHref}>{tr(lang, UI.viewFullPrice)} <Arrow /></a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Bảng giá "báo giá riêng" dạng thẻ (sự kiện / doanh nghiệp). */
export function PriceTiers({ tiers, lang }: { tiers: PriceTier[]; lang: Lang }) {
  return (
    <div className="vjk-tiers">
      {tiers.map((t) => (
        <div className={`vjk-tier${t.featured ? " feat" : ""}`} key={tr(lang, t.name)}>
          {t.featured && <span className="badge">{lang === "vi" ? "Phổ biến" : "Popular"}</span>}
          <div>
            <div className="tn">{tr(lang, t.name)}</div>
            <div className="tp">{tr(lang, t.price)}</div>
          </div>
          <ul>
            {t.items.map((it) => (
              <li key={tr(lang, it)}>{tr(lang, it)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Lưới thẻ giới thiệu (loại sự kiện / dịch vụ doanh nghiệp). */
export function InfoGrid({ items, lang }: { items: InfoItem[]; lang: Lang }) {
  return (
    <div className="vjk-info">
      {items.map((it) => (
        <div className="vjk-infocard" key={tr(lang, it.label)}>
          <h4>{tr(lang, it.label)}</h4>
          <p>{tr(lang, it.desc)}</p>
        </div>
      ))}
    </div>
  );
}

/** Quy trình đánh số (đúng nghĩa là một trình tự). */
export function ProcessSteps({ steps, lang }: { steps: InfoItem[]; lang: Lang }) {
  return (
    <div className="vjk-steps">
      {steps.map((s) => (
        <div className="vjk-step" key={tr(lang, s.label)}>
          <h4>{tr(lang, s.label)}</h4>
          <p>{tr(lang, s.desc)}</p>
        </div>
      ))}
    </div>
  );
}

/** Dải "vì sao chọn" (doanh nghiệp). */
export function WhyUs({ items, lang }: { items: InfoItem[]; lang: Lang }) {
  return (
    <div className="vjk-why">
      {items.map((it) => (
        <div key={tr(lang, it.label)}>
          <div className="n">{tr(lang, it.label)}</div>
          <p>{tr(lang, it.desc)}</p>
        </div>
      ))}
    </div>
  );
}

/** Đánh giá khách hàng. */
export function Testimonials({ items }: { items: VjkFeedback[] }) {
  return (
    <div className="vjk-reviews">
      {items.map((f) => {
        const r = Math.max(0, Math.min(5, f.rating ?? 5));
        return (
          <div className="vjk-review" key={f.id}>
            <div className="stars" aria-label={`${r}/5`}>{"★".repeat(r)}{"☆".repeat(5 - r)}</div>
            <div className="rc">“{f.content}”</div>
            {f.client_name && <div className="rn">— {f.client_name}</div>}
          </div>
        );
      })}
    </div>
  );
}
