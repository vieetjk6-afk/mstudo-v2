import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { COMPANY } from "@/lib/vieetjk-ai/content";
import ContactForm from "./ContactForm";

/** Khối "Liên hệ" — có ở cuối mọi trang (anchor #lien-he). */
export default function ContactSection({ defaultService = "" }: { defaultService?: string }) {
  const rows = [
    { icon: MapPin, k: "Địa chỉ", v: COMPANY.address.full, href: COMPANY.mapLink, external: true },
    { icon: Phone, k: "Hotline", v: COMPANY.phone, href: COMPANY.phoneHref },
    { icon: MessageCircle, k: "Zalo", v: COMPANY.phone, href: COMPANY.zalo, external: true },
    { icon: Mail, k: "Email", v: COMPANY.email, href: `mailto:${COMPANY.email}` },
    { icon: Clock, k: "Giờ làm việc", v: COMPANY.hours, href: null },
  ];

  return (
    <section id="lien-he" className="va-section alt">
      <div className="va-wrap">
        <div className="va-head center">
          <span className="va-eyebrow">Liên hệ</span>
          <h2 className="va-h2">
            Bắt đầu dự án của bạn <span className="va-grad-text">ngay hôm nay</span>
          </h2>
          <p className="va-lead">
            Tư vấn và khảo sát hoàn toàn miễn phí. Hãy kể cho chúng tôi nghe về bài toán của bạn — dù chỉ mới là một ý
            tưởng.
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
                title={`Bản đồ: ${COMPANY.address.full}`}
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
