import {
  WEDDING_MAIN,
  UI,
  tr,
  type Lang,
  type ServiceContent,
} from "@/lib/vieetjk/content";
import {
  bookingHref,
  albumsForCategories,
  itemsForList,
  itemForMatches,
  type VjkData,
} from "@/lib/vieetjk/data";
import { Gallery, PriceTiers, WeddingPricing, InfoGrid, ProcessSteps, WhyUs, type WeddingGroup } from "./parts";

function Header({ service, lang, book }: { service: ServiceContent; lang: Lang; book: string }) {
  return (
    <section className={`vjk-shead ${service.variant}`}>
      <div className="vjk-wrap">
        <div className="vjk-crumb">
          <a href="/">{tr(lang, UI.navHome)}</a> &nbsp;/&nbsp; {tr(lang, service.title)}
        </div>
        <span className="vjk-eyebrow" style={{ display: "block", marginTop: 18 }}>{tr(lang, service.tagline)}</span>
        <h1 className="vjk-serif">{tr(lang, service.title)}</h1>
        <p>{tr(lang, service.intro)}</p>
        <div className="vjk-btnrow" style={{ marginTop: 28 }}>
          <a href={book} className="vjk-cta">{tr(lang, UI.bookThis)}</a>
          <a href="#bang-gia" className="vjk-cta vjk-cta-ghost">{tr(lang, UI.viewPricing)}</a>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ maxWidth: 620, marginBottom: 40 }}>
      <span className="vjk-eyebrow">{eyebrow}</span>
      <h2 className="vjk-h2" style={{ marginTop: 12 }}>{title}</h2>
    </div>
  );
}

// `service` nhận vào nhưng khối CTA dùng chữ chung cho mọi dịch vụ — giữ trong
// chữ ký để chỗ gọi không phải đổi, đặt tên "_" cho rõ là cố ý bỏ trống.
function Cta({ service: _service, lang, book }: { service: ServiceContent; lang: Lang; book: string }) {
  return (
    <section className="vjk-section tight">
      <div className="vjk-wrap">
        <div className="vjk-band">
          <h2 className="vjk-serif">{tr(lang, UI.ctaHomeTitle)}</h2>
          <p>{tr(lang, UI.ctaHomeSub)}</p>
          <div className="vjk-btnrow">
            <a href={book} className="vjk-cta">{tr(lang, UI.bookNow)}</a>
            <a href="/#lien-he" className="vjk-cta vjk-cta-ghost">{tr(lang, UI.contactInfo)}</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function VieetjkService({
  service,
  data,
  lang,
}: {
  service: ServiceContent;
  data: VjkData;
  lang: Lang;
}) {
  const book = bookingHref(data.bookingToken, service.bookingListKey) || "/#lien-he";
  const albums = albumsForCategories(data.albums, service.categories);
  const galleryTitle = tr(lang, service.title).toLowerCase();

  // ── WEDDING ──────────────────────────────────────────────────────────────
  if (service.variant === "wedding") {
    const fullBase = data.bookingToken ? `/gia/${data.bookingToken}` : null;
    const groups: WeddingGroup[] = [
      { title: tr(lang, UI.wedding), key: "cuoi" },
      { title: tr(lang, UI.engagement), key: "dinh-hon" },
    ].map((g) => {
      const items = itemsForList(data.priceByList, g.key);
      return {
        title: g.title,
        cards: WEDDING_MAIN.map((p) => {
          const it = itemForMatches(items, p.match);
          const bookHref = data.bookingToken
            ? `/book/${data.bookingToken}?list=${g.key}${it ? `&pkg=${encodeURIComponent(it.name)}` : ""}`
            : "/#lien-he";
          return {
            name: tr(lang, p.label),
            note: tr(lang, p.note),
            price: it?.price ?? null,
            detail: it?.description ?? "",
            bookHref,
            fullHref: fullBase ? `${fullBase}?list=${g.key}` : null,
          };
        }),
      };
    });

    return (
      <>
        <Header service={service} lang={lang} book={book} />
        <section className="vjk-section">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.ourWork)} title={`${lang === "vi" ? "Một số dự án" : "Selected work"} · ${galleryTitle}`} />
            <Gallery albums={albums} lang={lang} />
          </div>
        </section>
        <section className="vjk-section alt" id="bang-gia">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.pricing)} title={lang === "vi" ? "Các gói chính" : "Main packages"} />
            <WeddingPricing groups={groups} lang={lang} />
            {service.priceNote && <div className="vjk-note">{tr(lang, service.priceNote)}</div>}
          </div>
        </section>
        <Cta service={service} lang={lang} book={book} />
      </>
    );
  }

  // ── EVENT ────────────────────────────────────────────────────────────────
  if (service.variant === "event") {
    return (
      <>
        <Header service={service} lang={lang} book={book} />
        {service.infoItems && (
          <section className="vjk-section">
            <div className="vjk-wrap">
              <SectionHead eyebrow={tr(lang, UI.services)} title={tr(lang, UI.eventTypesTitle)} />
              <InfoGrid items={service.infoItems} lang={lang} />
            </div>
          </section>
        )}
        <section className="vjk-section alt">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.ourWork)} title={`${lang === "vi" ? "Sự kiện đã thực hiện" : "Events we've covered"}`} />
            <Gallery albums={albums} lang={lang} />
          </div>
        </section>
        {service.process && (
          <section className="vjk-section">
            <div className="vjk-wrap">
              <SectionHead eyebrow={tr(lang, UI.services)} title={tr(lang, UI.processTitle)} />
              <ProcessSteps steps={service.process} lang={lang} />
            </div>
          </section>
        )}
        <section className="vjk-section alt" id="bang-gia">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.pricing)} title={lang === "vi" ? "Chi phí tham khảo" : "Indicative pricing"} />
            <PriceTiers tiers={service.priceTiers ?? []} lang={lang} />
            {service.priceNote && <div className="vjk-note">{tr(lang, service.priceNote)}</div>}
          </div>
        </section>
        <Cta service={service} lang={lang} book={book} />
      </>
    );
  }

  // ── BUSINESS ─────────────────────────────────────────────────────────────
  return (
    <>
      <Header service={service} lang={lang} book={book} />
      {service.infoItems && (
        <section className="vjk-section">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.services)} title={tr(lang, UI.bizServicesTitle)} />
            <InfoGrid items={service.infoItems} lang={lang} />
          </div>
        </section>
      )}
      <section className="vjk-section alt">
        <div className="vjk-wrap">
          <SectionHead eyebrow={tr(lang, UI.ourWork)} title={lang === "vi" ? "Dự án doanh nghiệp" : "Business projects"} />
          <Gallery albums={albums} lang={lang} />
        </div>
      </section>
      {service.whyUs && (
        <section className="vjk-section">
          <div className="vjk-wrap">
            <SectionHead eyebrow={tr(lang, UI.services)} title={tr(lang, UI.whyUsTitle)} />
            <WhyUs items={service.whyUs} lang={lang} />
          </div>
        </section>
      )}
      <section className="vjk-section alt" id="bang-gia">
        <div className="vjk-wrap">
          <SectionHead eyebrow={tr(lang, UI.pricing)} title={lang === "vi" ? "Chi phí tham khảo" : "Indicative pricing"} />
          <PriceTiers tiers={service.priceTiers ?? []} lang={lang} />
          {service.priceNote && <div className="vjk-note">{tr(lang, service.priceNote)}</div>}
        </div>
      </section>
      <Cta service={service} lang={lang} book={book} />
    </>
  );
}
