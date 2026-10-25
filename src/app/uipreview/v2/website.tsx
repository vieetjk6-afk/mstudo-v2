/* Màn xem trước GIAO DIỆN MỚI của nhóm "website" — mỗi nhóm một file để làm song
 * song không đụng nhau. Đăng ký sẵn trong ../screens.tsx. Bọc màn trong
 * <PreviewV2 path="/dashboard/..."> (xem ./shell.tsx). */
import { MessageCircle } from "lucide-react";
import * as f from "../fixtures";
import { PreviewV2 } from "./shell";
import WebsiteHubV2 from "@/app/dashboard/site/WebsiteHubV2";
import CanvasBuilder from "@/app/dashboard/site/builder/CanvasBuilder";
import InboxView from "@/app/dashboard/studio/inbox/InboxView";
import ChannelsManager from "@/app/dashboard/studio/inbox/ket-noi/ChannelsManager";
import StudioDriveV2 from "@/app/dashboard/studio/drive-sync/StudioDriveV2";
import DesktopPanelV2 from "@/app/dashboard/studio/desktop/DesktopPanelV2";
import GoogleCalendarConnect from "@/app/dashboard/connections/GoogleCalendarConnect";
import IntegrationGateV2 from "@/app/dashboard/connections/IntegrationGateV2";
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

/* ── Giả lời API cho màn xem trước ─────────────────────────────────────────
   Drive / Desktop tự gọi API lúc mở (không nhận prop) — ở bản dev chưa đăng nhập
   thì API trả lỗi và màn chỉ hiện trạng thái "chưa cấu hình". Một đoạn script
   chạy TRƯỚC khi React gắn hiệu ứng sẽ trả dữ liệu giả cho đúng vài đường dẫn,
   còn lại đi tiếp như thường. Chỉ có trong màn xem trước. */
function MockApi({ routes }: { routes: Record<string, unknown> }) {
  const js = `(function(){var R=${JSON.stringify(routes)};var of=window.fetch;window.fetch=function(u,o){try{var url=new URL(typeof u==="string"?u:u.url,location.href);var m=((o&&o.method)||"GET").toUpperCase();var k=R[m+" "+url.pathname]!==undefined?m+" "+url.pathname:(R[url.pathname]!==undefined&&m==="GET"?url.pathname:null);if(k){return Promise.resolve(new Response(JSON.stringify(R[k]),{status:200,headers:{"Content-Type":"application/json"}}));}}catch(e){}return of.apply(this,arguments);};})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

const driveTemplate = {
  photo: [
    { name: "JPG Goc", role: "selection", excluded: false },
    { name: "Raw", role: null, excluded: true },
    { name: "File ChinhSua", role: "delivery", excluded: false },
  ],
  video: [
    { name: "Video goc", role: null, excluded: true },
    { name: "Video dung", role: null, excluded: false },
  ],
};
const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const devices = [
  { id: "d1", name: "PC Hậu kỳ — Tầng 2", app_version: "1.8.4", last_sync_at: ago(0.3), revoked_at: null, created_at: ago(900) },
  { id: "d2", name: "Laptop Mr Lee", app_version: "1.8.2", last_sync_at: ago(27), revoked_at: null, created_at: ago(400) },
];

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
  "v2-hop-thu": {
    title: "Giao diện mới — Hộp thư hợp nhất",
    render: () => (
      <PreviewV2 path="/dashboard/studio/inbox">
        <InboxView
          conversations={f.inboxConversations}
          firstMessages={f.inboxMessages}
          staff={{ u1: "Phạm Thu Hà", u2: "Trần Hoài Nam" }}
          channels={f.inboxChannels}
          meId="u2"
          ownerId="o1"
          canManageChannels
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-hop-thu-trong": {
    title: "Giao diện mới — Hộp thư (chưa có tin)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/inbox">
        <InboxView conversations={[]} firstMessages={[]} staff={{}} channels={[]} meId="u2" ownerId="o1" canManageChannels />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-hop-thu-sap-ra-mat": {
    title: "Giao diện mới — Hộp thư (Sắp ra mắt)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/inbox">
        <IntegrationGateV2
          kind="soon"
          icon={MessageCircle}
          title="Hộp thư hợp nhất"
          hint="Khách nhắn từ Zalo, Facebook, Instagram, TikTok hay chatbox website sẽ đổ chung về một chỗ; trợ lý AI trả lời trước, nhân viên bấm một nút là tiếp quản. Bọn mình đang hoàn thiện và sẽ báo khi sẵn sàng."
        />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-noi-kenh": {
    title: "Giao diện mới — Nối mạng xã hội vào hộp thư",
    render: () => (
      <PreviewV2 path="/dashboard/studio/inbox/ket-noi">
        <ChannelsManager channels={f.inboxChannels} zaloReady zaloChannel="oa" metaOAuthReady />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-noi-kenh-moi": {
    title: "Giao diện mới — Nối kênh (chưa nối gì, chưa có Meta App)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/inbox/ket-noi">
        <ChannelsManager channels={f.inboxChannels.filter((c) => c.platform === "website")} zaloReady={false} zaloChannel={null} metaOAuthReady={false} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dong-bo-drive": {
    title: "Giao diện mới — Đồng bộ Google Drive (đã kết nối)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/drive-sync">
        <MockApi
          routes={{
            "/api/studio/drive/status": { configured: true, connected: true, rootFolderName: "MStudo", rootCreated: true, template: driveTemplate },
            "/api/desktop/devices": { devices, limit: 2, migrated: true },
          }}
        />
        <StudioDriveV2 />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-dong-bo-drive-chua": {
    title: "Giao diện mới — Đồng bộ Google Drive (chưa kết nối)",
    render: () => (
      <PreviewV2 path="/dashboard/studio/drive-sync">
        <MockApi
          routes={{
            "/api/studio/drive/status": { configured: true, connected: false, rootFolderName: "MStudo", rootCreated: false, template: driveTemplate },
            "/api/desktop/devices": { devices: [], limit: 2, migrated: true },
          }}
        />
        <StudioDriveV2 />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-may-tinh": {
    title: "Giao diện mới — MStudo Desktop",
    render: () => (
      <PreviewV2 path="/dashboard/studio/desktop">
        <MockApi
          routes={{
            "/api/desktop/devices": { devices, limit: 2, migrated: true },
            "POST /api/desktop/devices": { token: "msd_7f3a9c2e41b84d0f9a6e5c1b2d3f4a5b6c7d8e9f" },
            "/api/desktop/whoami": { account: { name: "Mai Studio", email: "mrlee@studio.vn" } },
          }}
        />
        <DesktopPanelV2 />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-ket-noi-lich": {
    title: "Giao diện mới — Kết nối Google Calendar",
    render: () => (
      <PreviewV2 path="/dashboard/connections">
        <GoogleCalendarConnect connected={false} gcalStatus={null} gcalMsg={null} />
      </PreviewV2>
    ),
    bare: true,
  },
  "v2-ket-noi-lich-xong": {
    title: "Giao diện mới — Kết nối Google Calendar (vừa nối xong)",
    render: () => (
      <PreviewV2 path="/dashboard/connections">
        <GoogleCalendarConnect connected gcalStatus="connected" gcalMsg={null} />
      </PreviewV2>
    ),
    bare: true,
  },
};
