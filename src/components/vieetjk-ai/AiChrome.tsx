import { Facebook, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { COMPANY, SERVICES } from "@/lib/vieetjk-ai/content";
import { VaMark } from "./icons";
import MobileNav, { type NavItem } from "./MobileNav";
import { VA_CSS } from "./styles";

function Logo() {
  return (
    <a href="/" className="va-logo" aria-label={`${COMPANY.legalName} — Trang chủ`}>
      <VaMark size={36} />
      <span className="va-logo-text">
        <span className="va-logo-name">
          {COMPANY.shortName} <span className="va-grad-text">{COMPANY.brandSuffix}</span>
        </span>
        <span className="va-logo-sub">Giải pháp công nghệ</span>
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
    { href: "/#gioi-thieu", label: "Giới thiệu" },
    { href: "/#dich-vu", label: "Dịch vụ", active: !!active && active !== "ai-agent" },
    { href: "/ai-agent", label: "AI Agent", active: active === "ai-agent" },
    { href: "/#san-pham", label: "Sản phẩm" },
    { href: "/#quy-trinh", label: "Quy trình" },
    { href: "#lien-he", label: "Liên hệ" },
  ];
  const cta: NavItem = { href: "#lien-he", label: "Nhận tư vấn miễn phí" };
  const year = new Date().getFullYear();

  return (
    <div className="va-root">
      <style dangerouslySetInnerHTML={{ __html: VA_CSS }} />

      <header className="va-header">
        <div className="va-wrap va-headin">
          <Logo />
          <nav className="va-nav" aria-label="Menu chính">
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
              Nhận tư vấn
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
                {COMPANY.legalName} — phát triển ứng dụng, giải pháp AI, AI Agent và SEO cho doanh nghiệp Việt. Thành
                lập ngày {COMPANY.foundedLabel}.
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
              <h4>Dịch vụ</h4>
              <ul className="va-foot-links">
                {SERVICES.map((s) => (
                  <li key={s.slug}>
                    <a href={`/${s.slug}`}>{s.name}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Công ty</h4>
              <ul className="va-foot-links">
                <li><a href="/#gioi-thieu">Về Vieetjk</a></li>
                <li><a href="/#san-pham">Sản phẩm</a></li>
                <li><a href="/#linh-vuc">Lĩnh vực phục vụ</a></li>
                <li><a href="/#quy-trinh">Quy trình hợp tác</a></li>
                <li><a href="/#hoi-dap">Câu hỏi thường gặp</a></li>
              </ul>
            </div>
            <div>
              <h4>Liên hệ</h4>
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
              © {year} {COMPANY.legalName}. Bảo lưu mọi quyền.
            </span>
            <span>ai.vieetjk.com · Thành lập {COMPANY.foundedLabel}</span>
          </div>
        </div>
      </footer>

      <a href={COMPANY.zalo} target="_blank" rel="noopener noreferrer" className="va-float" aria-label="Chat Zalo với Vieetjk">
        <MessageCircle size={18} />
        <span>Chat Zalo</span>
      </a>
    </div>
  );
}
