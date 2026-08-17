/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Bản build "standalone" gói sẵn một server.js tối giản cùng ĐÚNG những gói
  // node_modules thực sự dùng tới (~150MB thay vì ~800MB). Dùng khi tự chạy
  // trên VPS: build ở GitHub Actions rồi rsync sang máy chủ, không cần cài
  // node_modules trên VPS — quan trọng với VPS RAM thấp vì `npm ci` + `next
  // build` là hai thứ ngốn RAM nhất.
  //
  // Chỉ bật khi BUILD_STANDALONE=1 để build trên Vercel không đổi hành vi
  // (giữ nguyên đường lùi nếu cần quay lại Vercel).
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" } : {}),
  experimental: {
    // Tree-shake per-icon imports so navigating studio pages ships less JS.
    optimizePackageImports: ["lucide-react"],
    // zca-js (kênh Zalo cá nhân) là gói Node-only ESM (tough-cookie, ws, http.Agent…).
    // Đánh dấu external để webpack KHÔNG bundle và @vercel/nft trace đúng gói này vào
    // serverless function (import ở runtime từ node_modules). Là optionalDependency
    // nên build không chết nếu vắng gói.
    serverComponentsExternalPackages: ["zca-js"],
    // Next 14.2 defaults dynamic route Router-Cache reuse to 0s, so going back
    // to a page just visited refetches the whole thing from the server. Reuse
    // dynamic segments for 30s (instant back/forward) and prefetched static
    // shells for 3 min, while still revalidating reasonably often.
    staleTimes: { dynamic: 30, static: 180 },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  async headers() {
    // Content-Security-Policy. Deliberately scoped to script-src + a few
    // structural directives: this blocks injected external <script> (the main
    // XSS vector) and base-tag / plugin / clickjacking abuse, WITHOUT
    // restricting img/connect/frame/style — so the Google Picker, Supabase
    // calls, Drive images and VietQR/YouTube/Vimeo embeds can't break.
    // 'unsafe-inline'/'unsafe-eval' are kept because Next ships an inline
    // bootstrap and the Google Picker (gapi) relies on eval.
    const csp = [
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    // ── CSP siết chặt — CHẠY THỬ ở chế độ Report-Only trước ──────────────────
    // Bổ sung các directive mà `csp` ở trên cố ý bỏ ngỏ (default/connect/frame/
    // style/font/media/worker), dựng allowlist từ mọi host client THỰC dùng
    // (quét toàn repo): Google Picker/Drive/OAuth, Supabase (+wss realtime),
    // Cloudflare Turnstile, nhúng YouTube/Vimeo, xem trước video Drive.
    // img/media để `https:` vì studio dán URL ảnh/nhạc tuỳ ý (logo, bìa, nhạc thiệp).
    //
    // Vì CSP hỏng ÂM THẦM (chặn ngầm Picker/QR/nhạc/bản đồ) và không test được
    // runtime ở đây, ta phát ở header *Report-Only*: trình duyệt CHỈ báo vi phạm
    // ra console, KHÔNG chặn gì. Sau khi kiểm thử staging thấy sạch → đổi key
    // "Content-Security-Policy-Report-Only" thành "Content-Security-Policy" và
    // xoá biến `csp` cũ ở trên để enforce bản chặt này.
    const cspStrict = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Ảnh/nhạc đến từ nguồn tuỳ studio nhập → cho phép mọi https + data/blob.
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.google.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com",
      "frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com https://challenges.cloudflare.com https://*.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        // Asset tĩnh trong public/ (logo, favicon, ảnh thương hiệu). KHÔNG dùng
        // 'immutable' vì các tệp này không băm-nội-dung — nếu thay ở cùng URL,
        // immutable sẽ khiến trình duyệt/CDN phục vụ bản cũ tới 1 năm. Dùng
        // max-age vừa phải + stale-while-revalidate: bỏ phần lớn round-trip
        // revalidation nhưng bản thay mới lan trong ~1 giờ. KHÔNG khớp sw.js
        // (.js) / offline.html (.html) nên service worker vẫn tự cập nhật.
        source: "/:file*.(svg|png|jpg|jpeg|webp|avif|ico|gif|woff2)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          // Allow the Google Identity Services / Picker popup to work
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // H-4: Security headers
          { key: "Content-Security-Policy", value: csp },
          // Bản siết chặt chạy thử (không chặn) — xem ghi chú ở trên để enforce.
          { key: "Content-Security-Policy-Report-Only", value: cspStrict },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
