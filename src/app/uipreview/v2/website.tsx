/* Màn xem trước GIAO DIỆN MỚI của nhóm "website" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import { PreviewV2 } from "./shell";
import WebsiteHubV2 from "@/app/dashboard/site/WebsiteHubV2";
import CanvasBuilder from "@/app/dashboard/site/builder/CanvasBuilder";
import { SITE_BLOCK_LABEL, type Site, type SiteBlock } from "@/lib/types";
import { SITE_TEMPLATES, personalizeBlocks, EMPTY_INTAKE } from "@/lib/site-templates";

/* ── Website: một trang đã dựng từ mẫu "Sang trọng", có SEO, đã xuất bản ─── */
const tpl = SITE_TEMPLATES[0];
const site: Site = {
  id: "s1", owner_id: "o", subdomain: "maistudio", custom_domain: null, custom_domain_verified: false, template: "classic",
  theme: tpl.theme, seo: { title: "Mai Studio — Ảnh cưới & phóng sự Đà Lạt", description: "Studio ảnh cưới fine-art tại Đà Lạt: pre-wedding, phóng sự ngày cưới, album thủ công." },
  published: true, created_at: "2026-01-02T03:00:00Z", updated_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
};
const siteBlocks: SiteBlock[] = personalizeBlocks(tpl.blocks, EMPTY_INTAKE).map((b, i) => ({
  id: `b${i + 1}`, site_id: "s1", type: b.type, position: i, visible: i !== 5, config: b.config, created_at: "2026-01-02T03:00:00Z",
}));
const draftSite: Site = { ...site, subdomain: null, published: false, seo: {}, updated_at: new Date().toISOString() };

const hubProps = {
  stats: { today: 18, week: 146, month: 612 },
  greeting: "Chào anh/chị! Mai Studio có thể tư vấn gói chụp nào cho mình ạ?",
  instructions:
    "- Cọc 30% để giữ lịch, phần còn lại thanh toán ngày chụp\n- Giao ảnh chỉnh sửa sau 15–20 ngày\n- Luôn xưng em, gọi khách là anh/chị\n- Không báo giá album in khi khách chưa hỏi\n- Gợi ý khách để lại số điện thoại để được gọi lại\n- Chụp ngoại cảnh Đà Lạt phụ thu 1.500.000đ\n- Cuối tuần kín lịch tới tháng 12",
  canPublish: true,
  canCustomDomain: true,
  mainHost: "mstudo.com",
};

const siteViews = {
  today: 18, week: 146, month: 612,
  daily: Array.from({ length: 30 }, (_, i) => ({
    day: new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    views: [8, 14, 22, 19, 25, 12, 9, 17, 28, 31, 22, 18, 14, 26, 33, 21, 19, 24, 15, 11, 20, 27, 30, 23, 16, 22, 29, 25, 19, 18][i],
  })),
};

export const SCREENS_WEBSITE: Record<string, { title: string; render: () => React.ReactNode; bare?: boolean }> = {
  "v2-website": {
    title: "Giao diện mới — Website & chatbox",
    render: () => (
      <PreviewV2 path="/dashboard/site">
        <WebsiteHubV2
          site={site}
          blocks={siteBlocks.map((b) => ({ id: b.id, type: b.type, label: SITE_BLOCK_LABEL[b.type], visible: b.visible }))}
          {...hubProps}
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-website-nhap": {
    title: "Giao diện mới — Website (chưa xuất bản, chưa có khối)",
    render: () => (
      <PreviewV2 path="/dashboard/site">
        <WebsiteHubV2 site={draftSite} blocks={[]} {...hubProps} stats={{ today: 0, week: 0, month: 0 }} greeting="" instructions="" canCustomDomain={false} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-trinh-dung": {
    title: "Giao diện mới — Trình dựng website",
    render: () => (
      <PreviewV2 path="/dashboard/site/builder">
        <CanvasBuilder
          site={site}
          initialBlocks={siteBlocks}
          albums={[]}
          pricelist={[]}
          priceLists={[]}
          priceLabels={{}}
          siteViews={siteViews}
          canPublish
          canCustomDomain
          mainHost="mstudo.com"
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-trinh-dung-trong": {
    title: "Giao diện mới — Trình dựng website (trang trống, nháp)",
    render: () => (
      <PreviewV2 path="/dashboard/site/builder">
        <CanvasBuilder site={draftSite} initialBlocks={[]} albums={[]} canPublish canCustomDomain={false} mainHost="mstudo.com" />
      </PreviewV2>
    ),
    bare: true,
  },
};
