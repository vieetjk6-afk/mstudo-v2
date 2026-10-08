import { Facebook, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { AGENT_SLUG, COMPANY, SERVICES } from "@/lib/vieetjk-ai/content";
import { VaMark } from "./icons";
import MobileNav, { type NavItem } from "./MobileNav";
import { VA_CSS } from "./styles";

function Logo() {
  return (
    <a href="/" className="va-logo" aria-label={`${COMPANY.legalName} — Home`}>
      <VaMark size={36} />
      <span className="va-logo-text">
        <span className="va-logo-name">
          {COMPANY.shortName} <span className="va-grad-text">{COMPANY.brandSuffix}</span>
        </span>
        <span className="va-logo-sub">Technology Solutions</span>
      </span>
    </a>
  );
}

/**
 * Khung trang ai.vieetjk.com: header dính, menu điện thoại, footer, nút Zalo
 * nổi. `active` = slug dịch vụ đang xem ("" ở trang chủ).
 */
export default function AiChrome({ children, active = "" }: { children: React.ReactNode; active?: string }) {
  const nav: NavItem[] = [
    { href: "/#about", label: "About" },
    { href: "/#services", label: "Services", active: !!active && active !== AGENT_SLUG },
    { href: `/${AGENT_SLUG}`, label: "AI Agents", active: active === AGENT_SLUG },
    { href: "/#products", label: "Products" },
    { href: "/#process", label: "Process" },
    { href: "#contact", label: "Contact" },
  ];
  const cta: NavItem = { href: "#contact", label: "Get a free consultation" };
  const year = new Date().getFullYear();

  return (
    <div className="va-root" lang="en">
      <style dangerouslySetInnerHTML={{ __html: VA_CSS }} />

      <header className="va-header">
        <div className="va-wrap va-headin">
          <Logo />
          <nav className="va-nav" aria-label="Main menu">
            {nav.map((it) => (
              <a key={it.href} href={it.href} className={it.active ? "active" : undefined}>
                {it.label}
              </a>
            ))}
          </nav>
          <div className="va-head-cta">
            <a href={COMPANY.phoneHref} className="va-btn va-btn-ghost va-btn-sm">
              <Phone size={15} /> {COMPANY.phone}
            </a>
            <a href={cta.href} className="va-btn va-btn-primary va-btn-sm">
              Get in touch
            </a>
            <MobileNav items={nav} cta={cta} />
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="va-footer">
        <div className="va-wrap">
          <div className="va-foot-grid">
            <div>
              <Logo />
              <p className="va-foot-about">
                {COMPANY.legalName} ({COMPANY.nativeName}) — app development, AI solutions, AI agents and SEO for
                growing businesses. Founded {COMPANY.foundedLabel}.
              </p>
              <div className="va-social">
                <a href={COMPANY.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                  <Facebook size={17} />
                </a>
                <a href={COMPANY.zalo} target="_blank" rel="noopener noreferrer" aria-label="Zalo">
                  <MessageCircle size={17} />
                </a>
                <a href={`mailto:${COMPANY.email}`} aria-label="Email">
                  <Mail size={17} />
                </a>
              </div>
            </div>
            <div>
              <h4>Services</h4>
              <ul className="va-foot-links">
                {SERVICES.map((s) => (
                  <li key={s.slug}>
                    <a href={`/${s.slug}`}>{s.name}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul className="va-foot-links">
                <li><a href="/#about">About Vieetjk</a></li>
                <li><a href="/#products">Products</a></li>
                <li><a href="/#industries">Industries</a></li>
                <li><a href="/#process">How we work</a></li>
                <li><a href="/#faq">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul className="va-foot-links">
                <li style={{ display: "flex", gap: 10 }}>
                  <MapPin size={16} style={{ flexShrink: 0, marginTop: 4 }} /> {COMPANY.address.full}
                </li>
                <li>
                  <a href={COMPANY.phoneHref} style={{ display: "flex", gap: 10 }}>
                    <Phone size={16} style={{ flexShrink: 0, marginTop: 4 }} /> {COMPANY.phone}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${COMPANY.email}`} style={{ display: "flex", gap: 10 }}>
                    <Mail size={16} style={{ flexShrink: 0, marginTop: 4 }} /> {COMPANY.email}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="va-foot-bottom">
            <span>
              © {year} {COMPANY.legalName}. All rights reserved.
            </span>
            <span>ai.vieetjk.com · Founded {COMPANY.foundedLabel}</span>
          </div>
        </div>
      </footer>

      <a href={COMPANY.zalo} target="_blank" rel="noopener noreferrer" className="va-float" aria-label="Chat with Vieetjk on Zalo">
        <MessageCircle size={18} />
        <span>Chat on Zalo</span>
      </a>
    </div>
  );
}
