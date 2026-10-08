import { ArrowRight, ChevronDown, ExternalLink, Layers, MapPin, Sparkles } from "lucide-react";
import {
  ABOUT,
  COMMITMENTS,
  COMPANY,
  FAQ,
  HERO,
  INDUSTRIES,
  PROCESS,
  PRODUCTS,
  SERVICES,
  STATS,
  TECH_GROUPS,
} from "@/lib/vieetjk-ai/content";
import { faqLd, ldJson, organizationLd } from "@/lib/vieetjk-ai/json-ld";
import { COMMIT_ICONS, INDUSTRY_ICONS, SERVICE_ICONS } from "./icons";
import { AgentConsole, AgentPanel } from "./AgentBlocks";
import ContactSection from "./ContactSection";

export default function AiHome() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(organizationLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(faqLd(FAQ)) }} />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="va-hero">
        <span className="va-glow g1" />
        <span className="va-glow g2" />
        <div className="va-wrap va-hero-grid">
          <div>
            <span className="va-badge">
              <span className="va-badge-dot">AI</span>
              {HERO.eyebrow}
            </span>
            <h1>
              {HERO.title.split("\n")[0]}
              {"\n"}
              <span className="va-grad-text">{HERO.title.split("\n")[1]}</span>
            </h1>
            <p className="va-hero-sub">{HERO.sub}</p>
            <div className="va-btnrow">
              <a href="#lien-he" className="va-btn va-btn-primary">
                Nhận tư vấn miễn phí <ArrowRight size={17} />
              </a>
              <a href="#dich-vu" className="va-btn va-btn-ghost">
                Xem dịch vụ
              </a>
            </div>
            <div className="va-stats">
              {STATS.map((s) => (
                <div key={s.label} className="va-stat">
                  <div className="va-stat-v">{s.value}</div>
                  <div className="va-stat-l">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <AgentConsole />
        </div>
      </section>

      {/* ── Giới thiệu ───────────────────────────────────────── */}
      <section id="gioi-thieu" className="va-section alt">
        <div className="va-wrap">
          <div className="va-about">
            <div className="va-about-copy">
              <span className="va-eyebrow">Về chúng tôi</span>
              <h2 className="va-h2">{ABOUT.title}</h2>
              <div style={{ marginTop: 20 }}>
                {ABOUT.paragraphs.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
            </div>
            <div className="va-founded">
              <div className="va-founded-in">
                <div className="va-founded-label">Ngày thành lập</div>
                <div className="va-founded-date va-grad-text">{COMPANY.foundedLabel}</div>
                <div className="va-founded-rows">
                  <div className="va-founded-row">
                    <Sparkles size={17} />
                    <span>
                      <b style={{ color: "var(--ink)" }}>{COMPANY.legalName}</b>
                      <br />
                      {COMPANY.englishName}
                    </span>
                  </div>
                  <div className="va-founded-row">
                    <MapPin size={17} />
                    <span>Trụ sở: {COMPANY.address.full}</span>
                  </div>
                  <div className="va-founded-row">
                    <Layers size={17} />
                    <span>Lĩnh vực: phát triển ứng dụng, giải pháp AI, AI Agent, SEO & chuyển đổi số</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="va-pillars">
            {ABOUT.pillars.map((p) => (
              <div key={p.title} className="va-pillar">
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dịch vụ ─────────────────────────────────────────── */}
      <section id="dich-vu" className="va-section">
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Dịch vụ</span>
            <h2 className="va-h2">
              Một đối tác cho <span className="va-grad-text">mọi nhu cầu công nghệ</span>
            </h2>
            <p className="va-lead">
              Từ ứng dụng đầu tiên của doanh nghiệp tới hệ thống AI Agent tự vận hành — chúng tôi đồng hành trọn vòng
              đời sản phẩm.
            </p>
          </div>
          <div className="va-grid c3">
            {SERVICES.map((s, i) => {
              const Icon = SERVICE_ICONS[s.icon];
              return (
                <a key={s.slug} href={`/${s.slug}`} className="va-card">
                  <span className="va-svc-num">0{i + 1}</span>
                  <span className="va-ico">
                    <Icon size={22} />
                  </span>
                  <h3>{s.name}</h3>
                  <p>{s.short}</p>
                  <span className="va-link">
                    Xem chi tiết <ArrowRight size={15} />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI Agent ────────────────────────────────────────── */}
      <section id="ai-agent" className="va-section tight">
        <div className="va-wrap">
          <AgentPanel />
        </div>
      </section>

      {/* ── Sản phẩm ────────────────────────────────────────── */}
      <section id="san-pham" className="va-section">
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Sản phẩm</span>
            <h2 className="va-h2">Sản phẩm do Vieetjk phát triển & đang vận hành</h2>
            <p className="va-lead">
              Chúng tôi làm sản phẩm cho chính mình trước — mỗi ngày phục vụ người dùng thật. Đó là cách chúng tôi kiểm
              chứng công nghệ trước khi mang đến cho khách hàng.
            </p>
          </div>
          <div className="va-grid c4">
            {PRODUCTS.map((p) => {
              const body = (
                <>
                  <span className="va-tag">{p.tag}</span>
                  <h3>{p.name}</h3>
                  <p>{p.text}</p>
                  {p.href && (
                    <span className="va-link">
                      {p.href.replace(/^https?:\/\//, "")} <ExternalLink size={14} />
                    </span>
                  )}
                </>
              );
              return p.href ? (
                <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="va-card va-prod">
                  {body}
                </a>
              ) : (
                <div key={p.name} className="va-card va-prod">
                  {body}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Lĩnh vực ────────────────────────────────────────── */}
      <section id="linh-vuc" className="va-section alt">
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Lĩnh vực phục vụ</span>
            <h2 className="va-h2">Giải pháp cho từng ngành nghề</h2>
            <p className="va-lead">Hiểu đặc thù ngành giúp chúng tôi đi thẳng vào vấn đề và rút ngắn thời gian triển khai.</p>
          </div>
          <div className="va-grid c3">
            {INDUSTRIES.map((it) => {
              const Icon = INDUSTRY_ICONS[it.key];
              return (
                <div key={it.key} className="va-card hover">
                  <span className="va-ico sm">
                    <Icon size={19} />
                  </span>
                  <h3>{it.name}</h3>
                  <p>{it.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Quy trình ───────────────────────────────────────── */}
      <section id="quy-trinh" className="va-section">
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Quy trình</span>
            <h2 className="va-h2">Hợp tác rõ ràng, minh bạch từng bước</h2>
          </div>
          <ol className="va-steps">
            {PROCESS.map((s, i) => (
              <li key={s.title} className="va-step">
                <span className="va-step-n va-grad-text">Bước 0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Công nghệ ───────────────────────────────────────── */}
      <section id="cong-nghe" className="va-section alt tight">
        <div className="va-wrap">
          <div className="va-head">
            <span className="va-eyebrow">Công nghệ</span>
            <h2 className="va-h2">Công nghệ hiện đại, đã được kiểm chứng</h2>
          </div>
          <div className="va-tech">
            {TECH_GROUPS.map((g) => (
              <div key={g.name} className="va-tech-g">
                <h3>{g.name}</h3>
                <div className="va-chips">
                  {g.items.map((t) => (
                    <span key={t} className="va-chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vì sao chọn ─────────────────────────────────────── */}
      <section className="va-section">
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Vì sao chọn Vieetjk</span>
            <h2 className="va-h2">Cam kết của chúng tôi</h2>
          </div>
          <div className="va-grid c3">
            {COMMITMENTS.map((c, i) => {
              const Icon = COMMIT_ICONS[i];
              return (
                <div key={c.title} className="va-card va-commit">
                  <span className="va-ico sm">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Hỏi đáp ─────────────────────────────────────────── */}
      <section id="hoi-dap" className="va-section">
        <div className="va-wrap">
          <div className="va-head center">
            <span className="va-eyebrow">Hỏi đáp</span>
            <h2 className="va-h2">Câu hỏi thường gặp</h2>
          </div>
          <div className="va-faq">
            {FAQ.map((f) => (
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

      <ContactSection />
    </>
  );
}
