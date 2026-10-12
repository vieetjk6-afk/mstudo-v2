/* Kiểm thử MÁY MEDIA Ở NHÀ: chọn địa chỉ byte ảnh + hàng rào host của proxy.
 *
 * Vì sao đáng test: cả hai đều hỏng ÂM THẦM.
 *
 *   • Phía trình duyệt (src/lib/media-origin.ts) — đổi nhầm một URL CÓ cookie/
 *     phân quyền sang khác miền thì lượt đó hỏng mà không ai biết vì sao; đổi
 *     thiếu thì byte vẫn chảy qua Vercel như chưa làm gì. Và quan trọng nhất:
 *     máy ở nhà tắt thì phải LÙI về cùng miền, không được hỏng.
 *   • Phía proxy (src/lib/media-host.ts + next.config.mjs) — media.mstudo.com là
 *     một *.MAIN_HOST, lọt xuống nhánh tenant là thành "trang studio tên media";
 *     và máy ở nhà không được trả bảng điều khiển/API ra Internet. Hai lớp chặn
 *     (proxy cho trang, rewrite cho /api/*) phải dùng CÙNG một danh sách.
 *
 * Nạp thẳng code thật: src/lib/media-origin.ts, src/lib/media-host.ts,
 * next.config.mjs, src/proxy.ts (chỉ đọc chuỗi matcher), và bộ khớp đường dẫn
 * của chính Next.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import {
  normalizeMediaOrigin,
  mediaBytePath,
  mediaCandidates,
  withMediaFirst,
  fetchMediaBytes,
} from "../../src/lib/media-origin.ts";
import { mediaHostAllows, mediaHostFrom, mediaGate } from "../../src/lib/media-host.ts";
import { subdomainError } from "../../src/lib/hosts.ts";

const ROOT = resolve(import.meta.dirname, "../..");
const require = createRequire(import.meta.url);

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `\n    nhận: ${JSON.stringify(got)}\n    cần : ${JSON.stringify(want)}`}`);
};

const M = "https://media.mstudo.com";
const PAGE = "https://mstudo.com";

/* ── normalizeMediaOrigin ────────────────────────────────────────────────── */
check("trống → tắt", normalizeMediaOrigin(""), "");
check("undefined → tắt", normalizeMediaOrigin(undefined), "");
check("bỏ / cuối + khoảng trắng", normalizeMediaOrigin("  https://media.mstudo.com/ \n"), M);
check("bỏ đường dẫn thừa", normalizeMediaOrigin("https://media.mstudo.com/api/img"), M);
check("thiếu scheme → tắt (không đoán)", normalizeMediaOrigin("media.mstudo.com"), "");
check("scheme lạ → tắt", normalizeMediaOrigin("javascript:alert(1)"), "");

/* ── mediaBytePath: CHỈ /api/img cùng miền có raw=1 ──────────────────────── */
check("raw=1 tương đối → đổi", mediaBytePath("/api/img?id=abc&w=2560&raw=1"), "/api/img?id=abc&w=2560&raw=1");
check("orig=1&raw=1 (xuất album) → đổi", mediaBytePath("/api/img?id=abc&orig=1&raw=1"), "/api/img?id=abc&orig=1&raw=1");
check("ảnh hiển thị (không raw) → giữ", mediaBytePath("/api/img?id=abc&w=400"), null);
check("orig=1 hiển thị (302 sang Google) → giữ", mediaBytePath("/api/img?id=abc&orig=1"), null);
check("dl=1 (302 sang Drive) → giữ", mediaBytePath("/api/img?id=abc&dl=1&raw=1"), null);
check("route khác → giữ", mediaBytePath("/api/upload?raw=1"), null);
check("/api/file → giữ (chỉ 302, không byte)", mediaBytePath("/api/file?id=abc&raw=1"), null);
check("//host (protocol-relative) → giữ", mediaBytePath("//evil.com/api/img?id=a&raw=1", PAGE), null);
check("tuyệt đối cùng miền → đổi", mediaBytePath(`${PAGE}/api/img?id=a&w=2560&raw=1`, PAGE), "/api/img?id=a&w=2560&raw=1");
check("tuyệt đối khác miền → giữ", mediaBytePath("https://khac.com/api/img?id=a&raw=1", PAGE), null);
check("tuyệt đối mà không biết origin trang → giữ", mediaBytePath(`${PAGE}/api/img?id=a&raw=1`), null);
check("chuỗi rỗng", mediaBytePath(""), null);

/* ── mediaCandidates: máy media trước, cùng miền sau ─────────────────────── */
const RAW = "/api/img?id=abc&w=640&raw=1";
check("có máy media → [media, cùng miền]", mediaCandidates(RAW, M, PAGE), [`${M}${RAW}`, RAW]);
check("không có máy media → y như cũ", mediaCandidates(RAW, "", PAGE), [RAW]);
check("máy media sai dạng → y như cũ", mediaCandidates(RAW, "media.mstudo.com", PAGE), [RAW]);
check("đang chạy NGAY trên máy media → không tự gọi mình hai lần", mediaCandidates(RAW, M, M), [RAW]);
check("tên miền riêng của studio vẫn dùng được máy media", mediaCandidates(RAW, M, "https://studio-a.vn"), [`${M}${RAW}`, RAW]);
check("ảnh hiển thị không đổi", mediaCandidates("/api/img?id=abc&w=400", M, PAGE), ["/api/img?id=abc&w=400"]);

/* ── withMediaFirst (ZoomHiRes) ──────────────────────────────────────────── */
const zoom = ["/api/img?id=a&orig=1", "/api/img?id=a&w=4096", "/api/img?id=a&w=2560&raw=1"];
check("chèn bản media NGAY TRƯỚC raw=1", withMediaFirst(zoom, M), [zoom[0], zoom[1], `${M}${zoom[2]}`, zoom[2]]);
check("không có máy media → danh sách giữ nguyên", withMediaFirst(zoom, ""), zoom);

/* ── fetchMediaBytes: máy media hỏng thì LÙI về cùng miền ───────────────── */
{
  process.env.NEXT_PUBLIC_MEDIA_ORIGIN = M;
  globalThis.location = { origin: PAGE };
  const calls = [];
  let mediaMode = "ok";
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), credentials: init?.credentials });
    if (String(url).startsWith(M)) {
      if (mediaMode === "ok") return new Response("MEDIA", { status: 200, headers: { "content-type": "image/jpeg" } });
      if (mediaMode === "502") return new Response("{}", { status: 502 });
      if (mediaMode === "530") return new Response("tunnel down", { status: 530 });
      throw new TypeError("Failed to fetch");
    }
    return new Response("CUNG-MIEN", { status: 200, headers: { "content-type": "image/jpeg" } });
  };

  let r = await fetchMediaBytes(RAW);
  check("máy media sống → lấy byte từ máy media", await r.text(), "MEDIA");
  check("…không gửi cookie sang máy media", calls[0].credentials, "omit");
  check("…giữ content-type", r.headers.get("content-type"), "image/jpeg");

  calls.length = 0;
  r = await fetchMediaBytes("/api/img?id=abc&w=400");
  check("URL không thuộc diện → fetch thường, không chạm máy media", calls.map((c) => c.url), ["/api/img?id=abc&w=400"]);

  calls.length = 0;
  mediaMode = "502";
  r = await fetchMediaBytes(RAW);
  check("502 (Google không trả ảnh) → lùi cùng miền", await r.text(), "CUNG-MIEN");
  calls.length = 0;
  r = await fetchMediaBytes(RAW);
  check("…502 KHÔNG làm máy media bị nghỉ — lượt sau vẫn hỏi nó trước", calls.map((c) => c.url), [`${M}${RAW}`, RAW]);

  calls.length = 0;
  mediaMode = "throw";
  r = await fetchMediaBytes(RAW);
  check("mất mạng tới máy media → lùi cùng miền", await r.text(), "CUNG-MIEN");
  calls.length = 0;
  mediaMode = "ok";
  r = await fetchMediaBytes(RAW);
  check("…sau đó NGHỈ hỏi máy media (không bắt mỗi ảnh chờ lại)", calls.map((c) => c.url), [RAW]);
}

/* ── media-host: host nào, được phục vụ gì ──────────────────────────────── */
check("MEDIA_HOST đặt thẳng", mediaHostFrom("Media.MStudo.com", ""), "media.mstudo.com");
check("MEDIA_HOST lỡ dán cả https:// và /", mediaHostFrom("https://media.mstudo.com/", ""), "media.mstudo.com");
check("suy ra từ NEXT_PUBLIC_MEDIA_ORIGIN", mediaHostFrom("", "https://media.mstudo.com"), "media.mstudo.com");
check("không cấu hình gì → rỗng", mediaHostFrom(undefined, undefined), "");
check("origin sai dạng → rỗng", mediaHostFrom("", "media.mstudo.com"), "");

const ALLOWED = ["/api/img", "/api/file", "/api/version", "/api/inbox/ingest", "/api/cron/face-scan", "/api/cron/cleanup-proofs"];
const BLOCKED = [
  "/", "/dashboard", "/dashboard/studio", "/login", "/auth/callback", "/a/abc", "/album/x", "/site/media",
  "/api/cron", "/api/cron/", "/api/imgx", "/api/img/x", "/api/inbox/webhook/meta", "/api/upload",
  "/api/admin/backup", "/api/face-status", "/robots.txt", "/sitemap.xml",
];
for (const p of ALLOWED) check(`máy media CHO ${p}`, mediaHostAllows(p), true);
for (const p of BLOCKED) check(`máy media CHẶN ${p}`, mediaHostAllows(p), false);

// Studio không được giành tên miền phụ "media" — nó là máy chủ của nền tảng.
check("tên miền phụ 'media' bị giữ cho hệ thống", subdomainError("media") !== null, true);

const gate = (host, pathname, extra = {}) => mediaGate({ host, pathname, mediaHost: "media.mstudo.com", mediaOnly: false, ...extra });
check("Vercel, host chính → pass (proxy chạy như cũ)", gate("mstudo.com", "/dashboard"), "pass");
check("tenant <sub>.mstudo.com → pass", gate("studio-a.mstudo.com", "/"), "pass");
check("tên miền riêng → pass", gate("studio-a.vn", "/"), "pass");
check("máy media, trang chủ → block (không thành /site/media)", gate("media.mstudo.com", "/"), "block");
check("máy media có cổng, chữ hoa → vẫn nhận ra", gate("MEDIA.mstudo.com:443", "/dashboard"), "block");
check("máy media, /api/img → allow", gate("media.mstudo.com", "/api/img"), "allow");
check("MEDIA_HOST trống → không chặn gì", mediaGate({ host: "media.mstudo.com", pathname: "/", mediaHost: "", mediaOnly: false }), "pass");
check("MEDIA_ONLY=1 → MỌI host là máy media (lỡ thêm hostname thứ hai vào tunnel)", gate("app:3000", "/dashboard", { mediaOnly: true }), "block");
check("MEDIA_ONLY=1, /api/version → allow", gate("127.0.0.1", "/api/version", { mediaOnly: true }), "allow");

/* ── Proxy KHÔNG chạy trên /api/* → lớp chặn /api/* phải nằm ở next.config ── */
{
  const { getMiddlewareMatchers } = require("next/dist/build/analysis/get-page-static-info.js");
  const src = readFileSync(resolve(ROOT, "src/proxy.ts"), "utf8");
  const lit = src.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)?.[1];
  const matchers = getMiddlewareMatchers([JSON.parse(lit)], {});
  const runs = (p) => matchers.some((m) => new RegExp(m.regexp).test(p));
  check("proxy chạy trên / (nên chặn được trang chủ máy media)", runs("/"), true);
  check("proxy chạy trên /dashboard/studio", runs("/dashboard/studio"), true);
  check("proxy KHÔNG chạy trên /api/upload (lý do có lớp rewrite)", runs("/api/upload"), false);
}

/* ── next.config.mjs: bản Vercel không đổi, bản máy media chặn đúng danh sách ── */
{
  const { buildCustomRoute } = require("next/dist/lib/build-custom-route.js");
  const cfgUrl = new URL("../../next.config.mjs", import.meta.url).href;

  delete process.env.BUILD_STANDALONE;
  delete process.env.MEDIA_ONLY;
  const vercel = (await import(`${cfgUrl}?vercel`)).default;
  check("Vercel: KHÔNG output standalone", vercel.output, undefined);
  check("Vercel: KHÔNG rewrites", typeof vercel.rewrites, "undefined");
  const vh = await vercel.headers();
  check("Vercel: KHÔNG CORS trên /api/img", vh.some((h) => h.headers.some((x) => x.key === "Access-Control-Allow-Origin")), false);

  process.env.BUILD_STANDALONE = "1";
  const standaloneOnly = (await import(`${cfgUrl}?standalone`)).default;
  check("BUILD_STANDALONE=1 → output standalone", standaloneOnly.output, "standalone");
  check("…không kèm MEDIA_ONLY thì không chặn gì", typeof standaloneOnly.rewrites, "undefined");

  process.env.MEDIA_ONLY = "1";
  const media = (await import(`${cfgUrl}?media`)).default;
  check("máy media: output standalone", media.output, "standalone");
  const rw = await media.rewrites();
  const blockers = rw.beforeFiles.map((r) => buildCustomRoute("rewrite", r));
  const blocked = (p) => blockers.some((r) => new RegExp(r.regex).test(p));
  // So TỪNG đường dẫn /api/* với hàm của proxy — hai danh sách không được lệch.
  for (const p of [...ALLOWED, ...BLOCKED.filter((x) => x.startsWith("/api/"))]) {
    check(`rewrite khớp media-host cho ${p}`, !blocked(p), mediaHostAllows(p));
  }
  check("rewrite chặn /robots.txt", blocked("/robots.txt"), true);
  check("rewrite chặn /sitemap.xml", blocked("/sitemap.xml"), true);
  check("rewrite không đụng /_next/static", blocked("/_next/static/chunks/a.js"), false);
  check("đích chặn là /api/media-chan", [...new Set(rw.beforeFiles.map((r) => r.destination))], ["/api/media-chan"]);
  const mh = await media.headers();
  const img = mh.find((h) => h.source === "/api/img");
  check("máy media: CORS * trên /api/img", img?.headers.find((x) => x.key === "Access-Control-Allow-Origin")?.value, "*");
  delete process.env.BUILD_STANDALONE;
  delete process.env.MEDIA_ONLY;
}

console.log(fail ? `\n${fail} kiểm thử HỎNG` : "\nTất cả kiểm thử đạt");
process.exit(fail ? 1 : 0);
