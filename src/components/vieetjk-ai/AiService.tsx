import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { AGENT_SLUG, SERVICES, type Service } from "@/lib/vieetjk-ai/content";
import { breadcrumbLd, faqLd, ldJson, serviceLd } from "@/lib/vieetjk-ai/json-ld";
import { SERVICE_ICONS } from "./icons";
import { AgentConsole, AgentPanel } from "./AgentBlocks";
import ContactSection from "./ContactSection";

/** Trang chi tiết một dịch vụ: /app-development, /ai-agents, /seo… */
export default function AiService({ service: s }: { service: Service }) {
  const Icon = SERVICE_ICONS[s.icon];
  const isAgent = s.slug === AGENT_SLUG;
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
            <a href="/">Home</a>
            <ChevronRight size={14} />
            <a href="/#services">Services</a>
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
                <a href="#contact" className="va-btn va-btn-primary">
                  Get a free quote <ArrowRight size={17} />
                </a>
                <a href="#solutions" className="va-btn va-btn-ghost">
                  See solutions
                </a>
              </div>
            </div>
            {isAgent ? (
              <AgentConsole />
            ) : (
              <div className="va-hl">
                <h2>What you get</h2>
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
      <section id="solutions" className="va-section alt">
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Solutions</span>
            <h2 className="va-h2">What we can build for you</h2>
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
            <span className="va-eyebrow">Process</span>
            <h2 className="va-h2">Step-by-step delivery, early results</h2>
          </div>
          <ol className="va-timeline">
            {s.steps.map((st, i) => (
              <li key={st.title} className="va-step">
                <span className="va-step-n va-grad-text">Step 0{i + 1}</span>
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
            <span className="va-eyebrow">Technology</span>
            <h2 className="va-h2" style={{ fontSize: "clamp(24px,3vw,32px)" }}>
              Tools & platforms we use
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
            <span className="va-eyebrow">FAQ</span>
            <h2 className="va-h2">{s.name}: frequently asked questions</h2>
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
            <span className="va-eyebrow">Explore more</span>
            <h2 className="va-h2" style={{ fontSize: "clamp(24px,3vw,32px)" }}>
              Other Vieetjk services
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
