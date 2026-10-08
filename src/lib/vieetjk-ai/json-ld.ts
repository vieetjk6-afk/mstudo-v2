// Dữ liệu có cấu trúc (schema.org) cho ai.vieetjk.com — giúp Google & các công
// cụ tìm kiếm AI hiểu đúng công ty, dịch vụ và câu hỏi thường gặp.
import { AI_ORIGIN, COMPANY, SERVICES, type QA, type Service } from "./content";

const ORG_ID = `${AI_ORIGIN}/#organization`;

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": ORG_ID,
    name: COMPANY.legalName,
    alternateName: [`${COMPANY.shortName} ${COMPANY.brandSuffix}`, COMPANY.nativeName],
    url: `${AI_ORIGIN}/`,
    logo: `${AI_ORIGIN}/vieetjk-ai-icon.png`,
    image: `${AI_ORIGIN}/vieetjk-ai-og.png`,
    foundingDate: COMPANY.founded,
    telephone: "+84974374744",
    email: COMPANY.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: COMPANY.address.locality,
      addressRegion: COMPANY.address.region,
      addressCountry: "VN",
    },
    areaServed: [{ "@type": "Country", name: "Vietnam" }, "Worldwide"],
    sameAs: [COMPANY.facebook],
    knowsAbout: ["Mobile app development", "Web development", "Artificial intelligence", "AI agents", "SEO", "Digital transformation"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Technology services",
      itemListElement: SERVICES.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, url: `${AI_ORIGIN}/${s.slug}` },
      })),
    },
  };
}

export function serviceLd(s: Service) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.title,
    description: s.seoDescription,
    url: `${AI_ORIGIN}/${s.slug}`,
    serviceType: s.name,
    provider: { "@id": ORG_ID, "@type": "ProfessionalService", name: COMPANY.legalName },
    areaServed: [{ "@type": "Country", name: "Vietnam" }, "Worldwide"],
  };
}

export function faqLd(items: QA[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

export function breadcrumbLd(s: Service) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${AI_ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: s.name, item: `${AI_ORIGIN}/${s.slug}` },
    ],
  };
}

/** Chuỗi JSON an toàn để nhét vào <script type="application/ld+json">. */
export function ldJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
