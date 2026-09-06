import { ABOUT, BRAND, SERVICES, UI, tr, type Lang } from "@/lib/vieetjk/content";
import { albumsForCategories, type VjkData } from "@/lib/vieetjk/data";
import { Gallery, Testimonials } from "./parts";
import BookingButton from "./BookingButton";
import FeedbackBox from "./FeedbackBox";

function Arrow() {
  return (
    <svg className="arw" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function VieetjkHome({ data, lang }: { data: VjkData; lang: Lang }) {
  const featured = data.albums.slice(0, 9);

  return (
    <>
      {/* Hero */}
      <section className="vjk-hero">
        <div className="vjk-wrap vjk-hero-in">
          <span className="vjk-eyebrow">{tr(lang, BRAND.tagline)}</span>
          <h1 className="vjk-serif">{tr(lang, BRAND.heroTitle)}</h1>
          <p>{tr(lang, BRAND.heroSub)}</p>
          <div className="vjk-btnrow">
            <BookingButton token={data.bookingToken} lang={lang} />
            <a href="#tac-pham" className="vjk-cta vjk-cta-ghost">{tr(lang, UI.ourWork)}</a>
          </div>
        </div>
      </section>

      {/* Khối 3 dịch vụ (có ảnh) — đã bỏ dòng tiêu đề, giữ khối */}
      <section className="vjk-section" id="dich-vu">
        <div className="vjk-wrap">
          <div className="vjk-grid3">
            {SERVICES.map((s) => {
              const cover = albumsForCategories(data.albums, s.categories)[0]?.cover_url ?? null;
              return (
                <a key={s.slug} href={`/${s.slug}`} className="vjk-scard">
                  <div className="vjk-scard-media">
                    {cover ? (
                      <img src={cover} alt={tr(lang, s.title)} loading="lazy" />
                    ) : (
                      <div className="vjk-scard-ph">{lang === "vi" ? "Đang cập nhật" : "Coming soon"}</div>
                    )}
                  </div>
                  <div className="vjk-scard-body">
                    <span className="tag">{tr(lang, s.tagline)}</span>
                    <h3 className="vjk-serif">{tr(lang, s.title)}</h3>
                    <p>{tr(lang, s.cardDesc)}</p>
                    <span className="vjk-scard-link">{tr(lang, UI.viewService)} <Arrow /></span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* Về tjk media */}
      <section className="vjk-section alt">
        <div className="vjk-wrap vjk-about">
          <div>
            <span className="vjk-eyebrow">{tr(lang, UI.aboutHeading)}</span>
            <h2 className="vjk-h2" style={{ marginTop: 12 }}>{tr(lang, UI.aboutTitle)}</h2>
            <p className="vjk-lead" style={{ marginTop: 16 }}>{tr(lang, ABOUT.body)}</p>
          </div>
          <div className="vjk-stats">
            {ABOUT.stats.map((st) => (
              <div className="vjk-stat" key={st.value}>
                <div className="n vjk-serif">{st.value}</div>
                <div className="l">{tr(lang, st.label)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio nổi bật */}
      <section className="vjk-section" id="tac-pham">
        <div className="vjk-wrap">
          <div style={{ maxWidth: 620, marginBottom: 40 }}>
            <span className="vjk-eyebrow">{tr(lang, UI.ourWork)}</span>
            <h2 className="vjk-h2" style={{ marginTop: 12 }}>{tr(lang, UI.homeWorkTitle)}</h2>
          </div>
          <Gallery albums={featured} lang={lang} />
        </div>
      </section>

      {/* Đánh giá khách hàng */}
      {data.feedback.length > 0 && (
        <section className="vjk-section alt">
          <div className="vjk-wrap">
            <div style={{ maxWidth: 620, marginBottom: 40 }}>
              <span className="vjk-eyebrow">{tr(lang, UI.reviewsEyebrow)}</span>
              <h2 className="vjk-h2" style={{ marginTop: 12 }}>{tr(lang, UI.reviewsTitle)}</h2>
            </div>
            <Testimonials items={data.feedback} />
          </div>
        </section>
      )}

      {/* Liên hệ & góp ý */}
      <section className="vjk-section" id="gop-y">
        <div className="vjk-wrap">
          <div style={{ maxWidth: 620, marginBottom: 32 }}>
            <span className="vjk-eyebrow">{tr(lang, UI.feedbackEyebrow)}</span>
            <h2 className="vjk-h2" style={{ marginTop: 12 }}>{tr(lang, UI.feedbackTitle)}</h2>
            <p className="vjk-lead" style={{ marginTop: 14 }}>{tr(lang, UI.feedbackLead)}</p>
          </div>
          <FeedbackBox lang={lang} />
        </div>
      </section>

      {/* CTA */}
      <section className="vjk-section tight">
        <div className="vjk-wrap">
          <div className="vjk-band">
            <h2 className="vjk-serif">{tr(lang, UI.ctaHomeTitle)}</h2>
            <p>{tr(lang, UI.ctaHomeSub)}</p>
            <div className="vjk-btnrow" style={{ justifyContent: "center" }}>
              <BookingButton token={data.bookingToken} lang={lang} />
              <a href="#lien-he" className="vjk-cta vjk-cta-ghost">{tr(lang, UI.contactInfo)}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
