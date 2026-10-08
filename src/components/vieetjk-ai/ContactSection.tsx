import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { COMPANY } from "@/lib/vieetjk-ai/content";
import ContactForm from "./ContactForm";

/** Khối "Liên hệ" — có ở cuối mọi trang (anchor #contact). */
export default function ContactSection({ defaultService = "" }: { defaultService?: string }) {
  const rows = [
    { icon: MapPin, k: "Address", v: COMPANY.address.full, href: COMPANY.mapLink, external: true },
    { icon: Phone, k: "Hotline", v: COMPANY.phone, href: COMPANY.phoneHref },
    { icon: MessageCircle, k: "Zalo", v: COMPANY.phone, href: COMPANY.zalo, external: true },
    { icon: Mail, k: "Email", v: COMPANY.email, href: `mailto:${COMPANY.email}` },
    { icon: Clock, k: "Business hours", v: COMPANY.hours, href: null },
  ];

  return (
    <section id="contact" className="va-section alt">
      <div className="va-wrap">
        <div className="va-head center">
          <span className="va-eyebrow">Contact</span>
          <h2 className="va-h2">
            Start your project <span className="va-grad-text">today</span>
          </h2>
          <p className="va-lead">
            Consultation and discovery are completely free. Tell us about your challenge — even if it&apos;s just an
            idea.
          </p>
        </div>

        <div className="va-contact">
          <div className="va-info">
            {rows.map(({ icon: Icon, k, v, href, external }) => {
              const inner = (
                <>
                  <span className="va-ico">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="va-info-k">{k}</span>
                    <span className="va-info-v" style={{ display: "block" }}>
                      {v}
                    </span>
                  </span>
                </>
              );
              return href ? (
                <a
                  key={k}
                  href={href}
                  className="va-info-row"
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {inner}
                </a>
              ) : (
                <div key={k} className="va-info-row">
                  {inner}
                </div>
              );
            })}
            <div className="va-map">
              <iframe
                src={COMPANY.mapEmbed}
                title={`Map: ${COMPANY.address.full}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
          <ContactForm defaultService={defaultService} />
        </div>
      </div>
    </section>
  );
}
