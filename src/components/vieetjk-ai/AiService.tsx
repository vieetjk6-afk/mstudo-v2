import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { SERVICES, type Service } from "@/lib/vieetjk-ai/content";
import { breadcrumbLd, faqLd, ldJson, serviceLd } from "@/lib/vieetjk-ai/json-ld";
import { SERVICE_ICONS } from "./icons";
import { AgentConsole, AgentPanel } from "./AgentBlocks";
import ContactSection from "./ContactSection";

/** Trang chi tiết một dịch vụ: /phat-trien-ung-dung, /ai-agent, /seo… */
export default function AiService({ service: s }: { service: Service }) {
  const Icon = SERVICE_ICONS[s.icon];
  const isAgent = s.slug === "ai-agent";
  const others = SERVICES.filter((o) => o.slug !== s.slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(serviceLd(s)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(breadcrumbLd(s)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(faqLd(s.faq)) }} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="va-svc-hero">
        <span className="va-glow g1" />
        <div className="va-wrap" style={{ position: "relative", zIndex: 1 }}>
          <nav className="va-crumbs" aria-label="Breadcrumb">
            <a href="/">Trang chủ</a>
            <ChevronRight size={14} />
            <a href="/#dich-vu">Dịch vụ</a>
            <ChevronRight size={14} />
            <span style={{ color: "var(--ink2)" }}>{s.name}</span>
          </nav>
          <div className="va-svc-grid">
            <div>
              <span className="va-eyebrow">
                <Icon size={15} /> {s.name}
              </span>
              <h1>{s.title}</h1>
              <p className="va-lead">{s.intro}</p>
              {isAgent && (
                <ul className="va-uses" style={{ marginTop: 24 }}>
                  {s.highlights.map((h) => (
                    <li key={h} className="va-check">
                      <Check size={17} /> {h}
                    </li>
                  ))}
                </ul>
              )}
              <div className="va-btnrow">
                <a href="#lien-he" className="va-btn va-btn-primary">
                  Nhận tư vấn & báo giá <ArrowRight size={17} />
                </a>
                <a href="#tinh-nang" className="va-btn va-btn-ghost">
                  Xem giải pháp
                </a>
              </div>
            </div>
            {isAgent ? (
              <AgentConsole />
            ) : (
              <div className="va-hl">
                <h2>Bạn nhận được</h2>
                <ul>
                  {s.highlights.map((h) => (
                    <li key={h} className="va-check">
                      <Check size={17} /> {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Giải pháp ───────────────────────────────────────── */}
      <section id="tinh-nang" className="va-section alt">
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Giải pháp</span>
            <h2 className="va-h2">Chúng tôi có thể làm gì cho bạn</h2>
          </div>
          <div className="va-grid c3">
            {s.features.map((f, i) => (
              <div key={f.title} className="va-card hover">
                <span className="va-svc-num">0{i + 1}</span>
                <span className="va-ico sm">
                  <Icon size={19} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isAgent && (
        <section className="va-section tight">
          <div className="va-wrap">
            <AgentPanel showLearnMore={false} />
          </div>
        </section>
      )}

      {/* ── Quy trình ───────────────────────────────────────── */}
      <section className={`va-section${isAgent ? " alt" : ""}`}>
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Quy trình</span>
            <h2 className="va-h2">Triển khai từng bước, thấy kết quả sớm</h2>
          </div>
          <ol className="va-timeline">
            {s.steps.map((st, i) => (
              <li key={st.title} className="va-step">
                <span className="va-step-n va-grad-text">Bước 0{i + 1}</span>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
                <span className="va-step-time">⏱ {st.time}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Công nghệ ───────────────────────────────────────── */}
      <section className={`va-section tight${isAgent ? "" : " alt"}`}>
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Công nghệ</span>
            <h2 className="va-h2" style={{ fontSize: "clamp(24px,3vw,32px)" }}>
              Công cụ & nền tảng chúng tôi sử dụng
            </h2>
          </div>
          <div className="va-chips" style={{ marginTop: 26 }}>
            {s.tech.map((t) => (
              <span key={t} className="va-chip">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Hỏi đáp ─────────────────────────────────────────── */}
      <section className={`va-section${isAgent ? " alt" : ""}`}>
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Hỏi đáp</span>
            <h2 className="va-h2">Câu hỏi thường gặp về {s.name}</h2>
          </div>
          <div className="va-faq">
            {s.faq.map((f) => (
              <details key={f.q}>
                <summary>
                  {f.q}
                  <ChevronDown size={18} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dịch vụ khác ────────────────────────────────────── */}
      <section className="va-section tight">
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Khám phá thêm</span>
            <h2 className="va-h2" style={{ fontSize: "clamp(24px,3vw,32px)" }}>
              Dịch vụ khác của Vieetjk
            </h2>
          </div>
          <div className="va-others">
            {others.map((o) => {
              const OIcon = SERVICE_ICONS[o.icon];
              return (
                <a key={o.slug} href={`/${o.slug}`} className="va-other">
                  <span className="va-ico sm">
                    <OIcon size={18} />
                  </span>
                  {o.name}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <ContactSection defaultService={s.name} />
    </>
  );
}
