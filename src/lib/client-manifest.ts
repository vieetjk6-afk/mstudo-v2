/**
 * MANIFEST RIÊNG CHO TỪNG TRANG KHÁCH — để album chọn ảnh và cổng hợp đồng cài
 * được lên màn hình chính như một app.
 *
 * Vì sao không dùng chung `/manifest.webmanifest` của app: manifest gốc trỏ
 * `start_url` vào `/dashboard/studio` (khu quản lý của studio) và mang thương
 * hiệu mstudo. Khách cài về sẽ được một icon mstudo mở ra trang đăng nhập — vô
 * nghĩa. Mỗi album / mỗi hợp đồng cần một app riêng: tên album, logo studio, và
 * mở đúng trang của khách.
 *
 * Hai điểm cố ý:
 *  - `id` riêng cho từng album/hợp đồng. Trình duyệt phân biệt app bằng `id`
 *    (không phải bằng scope), nên khách cài hai album của hai studio khác nhau
 *    thì được hai icon, không phải một icon ghi đè lên icon kia.
 *  - `scope: "/"`. Album chọn ảnh CHUYỂN sang `/album/<slug>` khi studio giao
 *    ảnh (xem redirect ở a/[slug]/page.tsx), và cổng hợp đồng dẫn qua
 *    `/c/<token>`, trang thiệp, trang love story… Thu scope về đúng một đường
 *    dẫn thì mọi cú bấm sau đó bật ra trình duyệt ngoài, app coi như đứt.
 */

export type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: "any" | "maskable";
};

export type ClientManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  background_color: string;
  theme_color: string;
  lang: string;
  icons: ManifestIcon[];
};

/** Nhãn ngắn cho icon màn hình chính: điện thoại chỉ hiện được ~12 ký tự. */
export function shortLabel(s: string, max = 12): string {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  // Cắt ở khoảng trắng gần nhất để không chặt ngang một chữ.
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp >= max - 5 ? cut.slice(0, sp) : cut).trim() || t.slice(0, max);
}

/**
 * Danh sách icon. Logo studio (nếu có) đứng trước để khách thấy thương hiệu
 * studio trên màn hình chính — đó là toàn bộ điểm của white-label.
 *
 * `/logo-mark.svg` LUÔN được thêm vào cuối, và đây không phải cho đẹp: điều kiện
 * "cài được" của Chrome đòi ít nhất một icon ≥192px, mà logo studio là ảnh do
 * studio tải lên nên không biết kích thước thật. Nếu nó nhỏ hơn khai báo, hoặc
 * tải lỗi, thì SVG (sizes "any") vẫn giữ cho nút "Thêm vào màn hình chính" hiện
 * ra. Thiếu dòng này, studio nào để logo 64px là mất luôn tính năng cài app.
 */
export function manifestIcons(logoUrl: string | null | undefined): ManifestIcon[] {
  const icons: ManifestIcon[] = [];
  if (logoUrl && /^https?:\/\/|^\//.test(logoUrl)) {
    icons.push({ src: logoUrl, sizes: "192x192", purpose: "any" });
    icons.push({ src: logoUrl, sizes: "512x512", purpose: "any" });
  }
  icons.push({ src: "/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" });
  icons.push({ src: "/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" });
  return icons;
}

export function buildClientManifest(o: {
  /** Khoá phân biệt app, thường là đường dẫn của trang khách. */
  id: string;
  name: string;
  shortName?: string;
  description: string;
  startUrl: string;
  logoUrl?: string | null;
  /** Trang album khách là nền sáng ấm; cổng hợp đồng dùng cùng bảng màu. */
  themeColor?: string;
  backgroundColor?: string;
}): ClientManifest {
  return {
    id: o.id,
    name: o.name.trim() || "Album ảnh",
    short_name: shortLabel(o.shortName || o.name),
    description: o.description,
    start_url: o.startUrl,
    scope: "/",
    display: "standalone",
    // Khách xem ảnh dọc lẫn ngang; khoá hướng là tự làm khó người dùng.
    orientation: "any",
    background_color: o.backgroundColor || "#faf8f5",
    theme_color: o.themeColor || "#b8893a",
    lang: "vi",
    icons: manifestIcons(o.logoUrl),
  };
}

/** Phản hồi HTTP cho một route manifest. */
export function manifestResponse(m: ClientManifest): Response {
  return new Response(JSON.stringify(m, null, 2), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Đổi tên album là đổi tên app: đừng để bản cũ đóng đinh nhiều ngày.
      "cache-control": "public, max-age=300, s-maxage=300",
      // Trang của MỘT khách — không cho lập chỉ mục.
      "x-robots-tag": "noindex",
    },
  });
}
