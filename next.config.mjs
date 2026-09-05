/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Tree-shake per-icon imports so navigating studio pages ships less JS.
    optimizePackageImports: ["lucide-react"],
    // zca-js (kênh Zalo cá nhân) là gói Node-only ESM (tough-cookie, ws, http.Agent…).
    // Đánh dấu external để webpack KHÔNG bundle và @vercel/nft trace đúng gói này vào
    // serverless function (import ở runtime từ node_modules). Là optionalDependency
    // nên build không chết nếu vắng gói.
    // Ba gói khuôn mặt cũng để external: chúng nạp file .wasm và trọng số bằng
    // đường dẫn TÍNH LÚC CHẠY (fs), thứ webpack không bundle được. Để external
    // thì chúng ở lại node_modules và được @vercel/nft trace vào function.
    serverComponentsExternalPackages: [
      "zca-js",
      "@vladmandic/face-api",
      "@tensorflow/tfjs",
      "@tensorflow/tfjs-backend-wasm",
    ],
    /**
     * File KHÔNG PHẢI JavaScript mà máy chủ đọc lúc chạy — nft không thấy chúng
     * vì chẳng có `require` nào trỏ tới, nên phải khai báo tay. Thiếu khai báo
     * này thì `next build` vẫn xanh và chỉ vỡ trên production, đúng một câu
     * "model not found" / "failed to load wasm".
     *
     *   • model/*  : trọng số 3 mạng (~12 MB) — @/lib/face-node đọc bằng fs.
     *   • *.wasm   : nền tính toán của TensorFlow trên Node.
     */
    outputFileTracingIncludes: {
      "/api/cron/face-scan": [
        "./node_modules/@vladmandic/face-api/model/**",
        "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
      ],
      "/api/albums/[id]/face-scan": [
        "./node_modules/@vladmandic/face-api/model/**",
        "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
      ],
      "/api/albums/[id]/face-thu": [
        "./node_modules/@vladmandic/face-api/model/**",
        "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
      ],
      "/api/album/[slug]/face-match": [
        "./node_modules/@vladmandic/face-api/model/**",
        "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
      ],
      // Route phục vụ nội dung file SQL cho bảng "chưa bật được" — nó đọc file
      // bằng fs lúc chạy, nên file phải đi kèm vào function.
      // "bu-thieu" ghép từ chính các file migration, nên cần cả cây supabase/.
      "/api/setup-sql/[ten]": ["./supabase/*.sql", "./supabase/migrations/*.sql", "./supabase/kiem-tra.json"],
      // Bản kê bảng/cột cho /api/db-status — đọc bằng fs lúc chạy.
      "/api/db-status": ["./supabase/kiem-tra.json"],
    },
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
    //
    // MẶC ĐỊNH TẮT trên production — bật bằng CSP_REPORT_ONLY=1 khi thực sự ngồi
    // đọc console ở staging. Lý do: report-only KHÔNG chặn gì cả, mà không có
    // `report-uri` thì trình duyệt chỉ ghi ra console của từng khách — không ai
    // đọc. Đổi lại nó tốn ~1,1 KB header trên MỌI response, kể cả cú 302 rỗng
    // của /api/img: một gallery 300 ảnh phải cõng thêm ~330 KB header thuần cho
    // một chính sách không chặn gì. Trả tiền băng thông cho một thứ không ai
    // xem là khoản lỗ ròng, nên nó phải là lựa chọn có ý thức.
    const cspReportOnly = process.env.CSP_REPORT_ONLY === "1";
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
        // ── Hai cửa PHỤC VỤ BYTE, không phải tài liệu ─────────────────────────
        // /api/img và /api/file trả ảnh, byte thô, hoặc một cú 302 RỖNG sang CDN
        // của Google. Một trang gallery gọi chúng vài trăm lần cho mỗi lượt xem.
        //
        // Các header dưới đây bị BỎ ở đây vì chúng chỉ có nghĩa với TÀI LIỆU
        // (trình duyệt không áp CSP, X-Frame-Options, Permissions-Policy hay COOP
        // lên một tấm ảnh — chính sách áp cho ảnh đến từ trang nhúng nó):
        //   CSP · CSP-Report-Only · X-Frame-Options · COOP · Permissions-Policy ·
        //   Referrer-Policy · X-DNS-Prefetch-Control
        //
        // Đo thực tế trước khi sửa: 2.118 byte header cho một cú 302 không có
        // thân. Một album 300 ảnh = ~620 KB header thuần, mỗi lượt xem, cho các
        // chính sách không bảo vệ được gì ở đây. Sau khi bỏ còn ~370 byte.
        //
        // GIỮ LẠI hai cái THỰC SỰ có tác dụng trên byte:
        //   • nosniff — route này chuyển tiếp content-type của Google; đây đúng
        //     là chỗ cần chặn trình duyệt tự đoán kiểu nội dung.
        //   • HSTS    — áp cho cả origin, phải có mặt trên mọi response.
        source: "/api/:path(img|file)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Mọi thứ CÒN LẠI — trừ hai cửa phục vụ byte ở trên (Next áp TẤT CẢ luật
        // khớp, nên phải loại trừ ngay trong mẫu đường dẫn chứ không phải trông
        // vào thứ tự).
        source: "/:path((?!api/img$|api/file$).*)",
        headers: [
          // Allow the Google Identity Services / Picker popup to work
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // H-4: Security headers
          { key: "Content-Security-Policy", value: csp },
          // Bản siết chặt chạy thử (không chặn) — bật bằng CSP_REPORT_ONLY=1,
          // xem ghi chú ở trên để enforce.
          ...(cspReportOnly ? [{ key: "Content-Security-Policy-Report-Only", value: cspStrict }] : []),
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
