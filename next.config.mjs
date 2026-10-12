/**
 * MÁY CHỦ Ở NHÀ (deploy/home-server/) — dựng CÙNG mã nguồn này thành một server
 * Node độc lập trong Docker. Hai cờ, CHỈ đặt trong Dockerfile ở nhà; Vercel
 * không đặt cờ nào nên bản dựng Vercel giữ nguyên từng byte cấu hình như trước.
 *
 *   BUILD_STANDALONE=1 → `output: "standalone"`: .next/standalone/ chứa server.js
 *     + đúng phần node_modules được trace (kể cả các file khai ở
 *     outputFileTracingIncludes bên dưới — trọng số face-api, .wasm, supabase/*.sql).
 *     public/ và .next/static KHÔNG tự vào đó: Dockerfile chép tay, đúng như tài
 *     liệu output.md của Next yêu cầu.
 *   MEDIA_ONLY=1 (đi kèm cờ trên) → bản dựng là "máy media": chỉ phục vụ những
 *     route trong MEDIA_API_ALLOW, gửi CORS cho /api/img, gắn noindex. Xem
 *     src/lib/media-host.ts (cùng danh sách, phía proxy) và HUONG-DAN.md.
 */
const STANDALONE = process.env.BUILD_STANDALONE === "1";
const MEDIA_SERVER = STANDALONE && process.env.MEDIA_ONLY === "1";
/**
 * /api/* mà máy media được phục vụ — PHẢI khớp MEDIA_EXACT_PATHS/MEDIA_PREFIX_PATHS
 * ở src/lib/media-host.ts (desktop/test/media-origin.mjs so hai bên). Proxy không
 * chạy trên /api/* (matcher bỏ qua cho nhẹ), nên lớp chặn /api/* nằm ở đây, dưới
 * dạng rewrite "beforeFiles" sang /api/media-chan (luôn trả 404).
 */
export const MEDIA_API_ALLOW = "img$|file$|version$|inbox/ingest$|cron/.+|media-chan$";
/** Origin máy media (nếu có) — để CSP siết chặt (report-only) cho phép fetch tới. */
const MEDIA_ORIGIN = (() => {
  try {
    const v = (process.env.NEXT_PUBLIC_MEDIA_ORIGIN || "").trim();
    return v ? new URL(v).origin : "";
  } catch {
    return "";
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(STANDALONE ? { output: "standalone" } : {}),
  /**
   * Next 15 chuyển ba khoá dưới đây RA KHỎI `experimental`. Đổi tên/đổi chỗ mà
   * quên thì `next build` VẪN XANH và chỉ vỡ trên production — đúng kiểu hỏng
   * mà hai ghi chú dài phía dưới đã trả giá để học.
   */
  // Trước là experimental.serverComponentsExternalPackages.
  serverExternalPackages: [
    "zca-js",
    "@vladmandic/face-api",
    "@tensorflow/tfjs",
    "@tensorflow/tfjs-backend-wasm",
  ],
  // Trước là experimental.outputFileTracingIncludes.
  //
  // DÙNG `*` CHỨ KHÔNG PHẢI `[id]` / `[slug]` — đo mới biết. Khai theo tên
  // đoạn động (`/api/album/[slug]/face-match`) thì Next KHÔNG khớp, và manifest
  // trace của route đó ra 0 file trọng số; đổi sang `*` thì ra đủ 14 file. Kiểm
  // lại bằng:
  //   node -e "console.log(require('./.next/server/app/api/album/[slug]/face-match/route.js.nft.json').files.filter(x=>/face-api.model/.test(x)).length)"
  // Phải ra 14. Ra 0 nghĩa là production sẽ báo "model not found" — mà `next
  // build` vẫn xanh, nên không có cách nào khác để biết ngoài việc đo.
  outputFileTracingIncludes: {
    "/api/cron/face-scan": [
      "./node_modules/@vladmandic/face-api/model/**",
      "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
    ],
    "/api/albums/*/face-scan": [
      "./node_modules/@vladmandic/face-api/model/**",
      "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
    ],
    "/api/albums/*/face-thu": [
      "./node_modules/@vladmandic/face-api/model/**",
      "./node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm",
    ],
    "/api/album/*/face-match": [
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
  reactStrictMode: true,
  // Bot đọc link-preview phải nhận metadata (og:title/og:image) NGAY TRONG <head>.
  // Trang khách (/a, /album, /c, /portal) có loading.tsx nên Next stream metadata
  // vào <body> cho trình duyệt thường — bot nào không chạy JS sẽ mất ảnh xem trước.
  // Danh sách mặc định của Next KHÔNG có Zalo (kênh gửi link chính của studio), nên
  // khai lại: mặc định của Next + Zalo, Telegram, Viber, Pinterest, Line…
  // (Khai htmlLimitedBots là THAY danh sách mặc định, nên phải chép lại phần đó.)
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Facebot|meta-externalagent|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight|Zalo|TelegramBot|Viber|Pinterest|Embedly|Iframely|Line\/|kakaotalk-scrap/i,
  experimental: {
    // Tree-shake per-icon imports so navigating studio pages ships less JS.
    optimizePackageImports: ["lucide-react"],
    // staleTimes: Router Cache phía trình duyệt — vẫn nằm trong experimental ở Next 16.
    staleTimes: { dynamic: 30, static: 180 },
    // zca-js (kênh Zalo cá nhân) là gói Node-only ESM (tough-cookie, ws, http.Agent…).
    // Đánh dấu external để webpack KHÔNG bundle và @vercel/nft trace đúng gói này vào
    // serverless function (import ở runtime từ node_modules). Là optionalDependency
    // nên build không chết nếu vắng gói.
    // Ba gói khuôn mặt cũng để external: chúng nạp file .wasm và trọng số bằng
    // đường dẫn TÍNH LÚC CHẠY (fs), thứ webpack không bundle được. Để external
    // thì chúng ở lại node_modules và được @vercel/nft trace vào function.
    /**
     * File KHÔNG PHẢI JavaScript mà máy chủ đọc lúc chạy — nft không thấy chúng
     * vì chẳng có `require` nào trỏ tới, nên phải khai báo tay. Thiếu khai báo
     * này thì `next build` vẫn xanh và chỉ vỡ trên production, đúng một câu
     * "model not found" / "failed to load wasm".
     *
     *   • model/*  : trọng số 3 mạng (~12 MB) — @/lib/face-node đọc bằng fs.
     *   • *.wasm   : nền tính toán của TensorFlow trên Node.
     */
    // Next 14.2 defaults dynamic route Router-Cache reuse to 0s, so going back
    // to a page just visited refetches the whole thing from the server. Reuse
    // dynamic segments for 30s (instant back/forward) and prefetched static
    // shells for 3 min, while still revalidating reasonably often.
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
    // www.youtube.com: IFrame API cho nhạc nền thiệp dán link YouTube
    // (src/app/thiep/[slug]/MusicPlayer.tsx) — thiếu là nút nhạc im lặng.
    const csp = [
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com https://www.youtube.com",
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com https://www.youtube.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Ảnh/nhạc đến từ nguồn tuỳ studio nhập → cho phép mọi https + data/blob.
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      `connect-src 'self'${MEDIA_ORIGIN ? ` ${MEDIA_ORIGIN}` : ""} https://*.supabase.co wss://*.supabase.co https://*.google.com https://*.googleapis.com https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com`,
      "frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://drive.google.com https://docs.google.com https://accounts.google.com https://content.googleapis.com https://challenges.cloudflare.com https://*.google.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; ");
    // ── Máy media ở nhà (MEDIA_SERVER) ─────────────────────────────────────
    // CORS cho /api/img: trang trên mstudo.com / <studio>.mstudo.com / tên miền
    // riêng của studio gọi fetch()/canvas crossOrigin sang media.mstudo.com.
    // `*` chứ không phải danh sách origin, vì:
    //   • /api/img không đọc cookie, không phân quyền — chỉ tải ảnh Drive CÔNG
    //     KHAI theo id; ai cũng gọi được nó bằng curl. CORS chỉ quyết định trình
    //     duyệt có cho JS đọc byte hay không, không phải ai được lấy byte.
    //   • tên miền riêng của studio là danh sách động (trong DB) — liệt kê không xuể.
    //   • echo Origin thì phải `Vary: Origin`, mà cache của Cloudflare bỏ qua Vary
    //     → studio A nhận bản cache mang origin của studio B → CORS hỏng.
    // Request không gửi credentials (crossOrigin="anonymous", credentials:"omit")
    // nên `*` hợp lệ. GET đơn giản không preflight; OPTIONS do Next tự trả.
    const mediaHeaders = MEDIA_SERVER
      ? [
          {
            source: "/api/img",
            headers: [
              { key: "Access-Control-Allow-Origin", value: "*" },
              { key: "Access-Control-Allow-Methods", value: "GET, HEAD, OPTIONS" },
              { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
            ],
          },
          {
            // Máy media không phải một trang để Google lập chỉ mục.
            source: "/:path*",
            headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
          },
        ]
      : [];
    return [
      ...mediaHeaders,
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
        // ── MỌI route /api/* (JSON, byte ảnh, cú 302 rỗng…) — KHÔNG phải tài liệu
        // Trước đây chỉ /api/img và /api/file được miễn; mọi JSON khác vẫn cõng
        // nguyên bộ header của TÀI LIỆU (~1,5–2 KB / response). Các header đó chỉ
        // có nghĩa với trang HTML mà trình duyệt hiển thị (trình duyệt không áp
        // CSP, X-Frame-Options, Permissions-Policy hay COOP lên một response
        // JSON/ảnh — chính sách áp theo TRANG gọi nó):
        //   CSP · CSP-Report-Only · X-Frame-Options · COOP · Permissions-Policy ·
        //   Referrer-Policy · X-DNS-Prefetch-Control
        // Một album/portal/desktop gọi API hàng trăm lần → bỏ đi là bớt thẳng
        // Fast Origin Transfer.
        //
        // Đo thực tế với /api/img trước khi sửa: 2.118 byte header cho một cú 302
        // không có thân; sau khi bỏ còn ~370 byte.
        //
        // GIỮ LẠI hai cái THỰC SỰ có tác dụng:
        //   • nosniff — /api/img, /api/file chuyển tiếp content-type của Google;
        //     JSON cũng không được để trình duyệt tự đoán kiểu.
        //   • HSTS    — áp cho cả origin, phải có mặt trên mọi response.
        source: "/api/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Mọi thứ CÒN LẠI (trang/tài liệu) — trừ /api/* ở trên. Next áp TẤT CẢ
        // luật khớp, nên phải loại trừ ngay trong mẫu đường dẫn chứ không phải
        // trông vào thứ tự; nếu không nosniff/HSTS sẽ bị gửi HAI lần.
        source: "/:path((?!api/).*)",
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
  ...(MEDIA_SERVER
    ? {
        async rewrites() {
          return {
            // beforeFiles: chạy TRƯỚC khi khớp route, nên route bị chặn không
            // bao giờ được gọi. /robots.txt, /sitemap.xml là route handler đọc
            // Host (không qua proxy vì matcher bỏ qua .txt/.xml) — chặn luôn.
            beforeFiles: [
              { source: `/api/:rest((?!${MEDIA_API_ALLOW}).*)`, destination: "/api/media-chan" },
              { source: "/robots.txt", destination: "/api/media-chan" },
              { source: "/sitemap.xml", destination: "/api/media-chan" },
            ],
            afterFiles: [],
            fallback: [],
          };
        },
      }
    : {}),
};

export default nextConfig;
