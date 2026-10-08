import { isMainHost, requestHost, tenantSiteForHost } from "@/lib/seo-host";
import { AI_ORIGIN, isVieetjkAiHost } from "@/lib/vieetjk-ai/content";

export const dynamic = "force-dynamic";

/* robots.txt phục vụ THEO HOST:
   • website studio đã xuất bản → cho lập chỉ mục, trỏ tới sitemap của chính nó;
   • studio chưa xuất bản → chặn hết (không để bản nháp lọt lên Google);
   • host chính (mstudo.com) → cho lập chỉ mục trang giới thiệu, chặn khu vực
     riêng tư (dashboard, api, link chia sẻ theo token). */

function body(lines: string[]): Response {
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Đổi không thường xuyên → cho CDN giữ 1 giờ.
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}

export async function GET(req: Request) {
  const host = requestHost(req);

  // ai.vieetjk.com — trang công ty code tay, không có dòng `sites` để tra.
  if (isVieetjkAiHost(host)) {
    return body(["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${AI_ORIGIN}/sitemap.xml`]);
  }

  if (!isMainHost(host)) {
    const { site, failed } = await tenantSiteForHost(host);
    if (!site && !failed) {
      // Chắc chắn không có site nào ở host này (hoặc chưa xuất bản) → chặn thu thập.
      return body(["User-agent: *", "Disallow: /"]);
    }
    // failed = không tra được (DB lỗi). KHÔNG trả "Disallow: /" trong trường hợp
    // này: một lần chớp nháy có thể làm Google rút trang studio khỏi tìm kiếm.
    return body([
      "User-agent: *",
      "Allow: /",
      // Link riêng tư của khách (album, hợp đồng, form…) không nên vào Google.
      "Disallow: /a/",
      "Disallow: /c/",
      "Disallow: /q/",
      "Disallow: /form/",
      "Disallow: /api/",
      "",
      `Sitemap: https://${host}/sitemap.xml`,
    ]);
  }

  return body([
    "User-agent: *",
    "Allow: /",
    "Disallow: /dashboard",
    "Disallow: /api/",
    "Disallow: /login",
    "Disallow: /auth",
    "Disallow: /a/",
    "Disallow: /c/",
    "Disallow: /q/",
    "Disallow: /gia/",
    "Disallow: /book/",
    "Disallow: /form/",
    "Disallow: /site-preview",
    "",
    `Sitemap: https://${host}/sitemap.xml`,
  ]);
}
