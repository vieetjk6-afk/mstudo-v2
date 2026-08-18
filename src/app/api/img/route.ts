import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Not force-dynamic: the response is content-addressed by (id, w) and cacheable.
// The runtime is still dynamic because we read query params, but dropping
// force-dynamic lets Vercel's CDN honour the Cache-Control below.
export const runtime = "nodejs";

// A real browser UA — some Google endpoints are picky about non-browser UAs.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// A Drive file's image at a given width never changes, so cache hard. The
// s-maxage lets Vercel's edge/CDN serve repeats WITHOUT re-hitting this function
// — a CDN hit does not count against Fast Origin Transfer.
const CACHE_OK = "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400, immutable";
const CACHE_ERR = "public, max-age=0, s-maxage=60"; // don't pin failures for long

// Optional durable offload: set DRIVE_IMG_CACHE_BUCKET to a PUBLIC Supabase
// Storage bucket. Cached images then 302-redirect straight to Supabase's CDN,
// so Vercel serves ~0 image bytes. Unset → plain proxy (still edge-cached).
//
// NOTE ON SUPABASE QUOTAS: every byte the bucket serves is billed as Supabase
// EGRESS, and every cached object counts against FILE STORAGE (1 GB free).
// So the bucket is only worth using for objects that are SMALL and read MANY
// times — i.e. gallery thumbnails. The two knobs below keep the fat, read-once
// bytes (full-res originals, download-sized renders) OUT of Supabase entirely;
// those stream from Google through Vercel instead, where bandwidth is far
// cheaper. See docs/supabase-usage.md.
const BUCKET = process.env.DRIVE_IMG_CACHE_BUCKET || "";
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Full-resolution originals (?orig=1) are the single heaviest thing this route
// serves — one ZIP of a wedding can push hundreds of MB into the bucket and the
// same amount straight back out as egress. Default OFF; opt in with =1.
const CACHE_ORIGINALS = process.env.DRIVE_IMG_CACHE_ORIGINALS === "1";
// Only persist renders at or below this width. Thumbnails (w≤1024) are reused
// by every viewer of an album; w=2000/2560 renders are fetched once for a
// download and would otherwise sit in the bucket forever.
const CACHE_MAX_WIDTH = Number(process.env.DRIVE_IMG_CACHE_MAX_WIDTH || "1024");

function cacheKey(id: string, width: number) { return `${id}_w${width}.jpg`; }
function publicUrl(key: string) { return `${SUPA_URL}/storage/v1/object/public/${BUCKET}/${key}`; }

/** Fetch the image bytes from Google, trying several endpoints in turn. */
async function fetchFromGoogle(id: string, width: number): Promise<Response | null> {
  const thumb = `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
  const lh3 = `https://lh3.googleusercontent.com/d/${id}=w${width}`;
  const dl = `https://drive.usercontent.google.com/download?id=${id}&export=view`;
  // Thumbnail endpoint renders both images and video posters; lh3 gives the
  // best quality for larger requests.
  const sources = width <= 1024 ? [thumb, lh3, dl] : [lh3, thumb, dl, `https://drive.google.com/uc?export=download&id=${id}`];

  for (const url of sources) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      const res = await fetch(url, { cache: "no-store", redirect: "follow", headers: { "User-Agent": UA }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.startsWith("image/")) {
        const len = Number(res.headers.get("content-length") || "0");
        if (len && len < 100) continue; // tiny = placeholder, try next source
        return res;
      }
    } catch { /* try next source */ }
  }
  return null;
}

/**
 * Fetch the ORIGINAL full-resolution file (no downscale) — used by the album
 * designer's print export so quality is preserved. Longer timeout for big files.
 */
async function fetchOriginal(id: string): Promise<Response | null> {
  const sources = [
    `https://lh3.googleusercontent.com/d/${id}=s0`, // s0 = original size
    `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    `https://drive.google.com/uc?export=download&id=${id}`,
  ];
  for (const url of sources) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(url, { cache: "no-store", redirect: "follow", headers: { "User-Agent": UA }, signal: ctrl.signal }).finally(() => clearTimeout(timer));
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.startsWith("image/")) return res;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Proxy a Google Drive image so it embeds reliably (no hotlink/referrer issues)
 * and can be fetched cross-origin for ZIP download. Streams the bytes and lets
 * the CDN cache them; optionally offloads serving to Supabase Storage.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 });
  }

  // ── Lượt xem thường hay lượt ĐỌC BYTE? ───────────────────────────────────
  // Chỉ ba nhóm dưới đây cần byte đi qua Vercel (cùng miền thì canvas mới
  // không bị "tainted", fetch mới đọc được):
  //   • raw=1        — chính app đánh dấu: ZIP, watermark, xuất album.
  //   • mode = cors  — <img crossOrigin> / fetch có CORS.
  //   • dest ≠ image — fetch()/XHR (Sec-Fetch-Dest: "empty").
  // Mọi thứ còn lại là ẢNH HIỂN THỊ → 302 thẳng sang CDN của Google.
  //
  // Trước đây điều kiện viết ngược: CHỈ chuyển hướng khi dest === "image", nên
  // client KHÔNG gửi Sec-Fetch-* (Safari iOS ≤ 16.3, webview trong Zalo /
  // Facebook, bot đọc link) rơi hết vào đường proxy — mỗi thumbnail ~90 KB đi
  // qua Vercel. Đảo lại: thiếu header thì coi là lượt xem, còn ba nhóm đọc byte
  // vẫn nhận đúng byte vì chúng tự nhận diện được (raw=1 là chốt chặn cuối cho
  // trình duyệt cũ không gửi Sec-Fetch-*).
  const dest = req.headers.get("sec-fetch-dest");
  const mode = req.headers.get("sec-fetch-mode");
  const wantsBytes =
    searchParams.get("raw") === "1" || mode === "cors" || (dest !== null && dest !== "image");
  // IMG_CDN_REDIRECT=0 vẫn tắt được tối ưu này (xem docs/bien-moi-truong.md).
  const canRedirect = process.env.IMG_CDN_REDIRECT !== "0" && !wantsBytes;

  // ── Direct-from-Drive download (dl=1) ─────────────────────────────────────
  // Hand the browser straight to Google for "save the original": Drive serves
  // the file, so ZERO bytes cross Vercel or Supabase — originals average ~11 MB
  // each, so this is the whole ballgame for download-heavy albums.
  //
  // Only valid when the download is the UNTOUCHED original. A watermarked save
  // needs the pixels in a canvas, and Drive sends no CORS headers, so those
  // still take the proxy path below. Callers decide; see lib/download.ts.
  if (searchParams.get("dl") === "1") {
    return NextResponse.redirect(
      `https://drive.usercontent.google.com/download?id=${id}&export=download`,
      { status: 302, headers: { "Cache-Control": CACHE_OK } },
    );
  }

  // Original-quality mode (album export, ZIP/download of originals): serve the
  // full-resolution file as-is, no width clamp, no re-encode.
  if (searchParams.get("orig") === "1") {
    // Ảnh gốc đem HIỂN THỊ (logo, ảnh thiệp, ảnh vừa tải lên) không cần byte
    // đi qua Vercel — mỗi tấm cỡ chục MB. Chỉ lượt đọc byte (xuất album in)
    // mới xuống đường proxy bên dưới.
    if (canRedirect) {
      return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${id}=s0`, {
        status: 302,
        headers: { "Cache-Control": CACHE_OK },
      });
    }
    // Durable offload: originals are the HEAVIEST bytes (full-res ZIP/download),
    // and browsers can't fetch them cross-origin from Google (no CORS), so they
    // otherwise stream through Vercel every time. Caching them shifts that load
    // onto Supabase — which is exactly the wrong trade on the free plan, where
    // storage (1 GB) and egress (5 GB) are the scarce budgets and Vercel's are
    // not. Hence opt-in only: DRIVE_IMG_CACHE_ORIGINALS=1.
    if (BUCKET && SUPA_URL && CACHE_ORIGINALS) {
      const key = `${id}_orig`;
      const pub = publicUrl(key);
      try {
        const head = await fetch(pub, { method: "HEAD" });
        if (head.ok) return new NextResponse(null, { status: 302, headers: { Location: pub, "Cache-Control": CACHE_OK } });
      } catch { /* fall through to proxy + cache */ }
      const res = await fetchOriginal(id);
      if (!res || !res.body) return NextResponse.json({ error: "fetch_failed" }, { status: 502, headers: { "Cache-Control": CACHE_ERR } });
      const ct = res.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await res.arrayBuffer());
      createAdminClient().storage.from(BUCKET).upload(key, buf, { contentType: ct, upsert: true, cacheControl: "31536000" }).catch(() => {});
      return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": CACHE_OK } });
    }
    const res = await fetchOriginal(id);
    if (!res || !res.body) return NextResponse.json({ error: "fetch_failed" }, { status: 502, headers: { "Cache-Control": CACHE_ERR } });
    return new NextResponse(res.body, { headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": CACHE_OK } });
  }

  // Clamp width: never proxy anything huge (caps origin transfer per request).
  // 2560 keeps the "download original" path (w=2400) working.
  const width = Math.min(Math.max(Number(searchParams.get("w")) || 500, 16), 2560);

  // ── Display CDN redirect (mặc định BẬT; tắt bằng IMG_CDN_REDIRECT=0) ─────
  // Ảnh chỉ để HIỂN THỊ thì 302 thẳng sang CDN của Google — Vercel phục vụ gần
  // 0 byte. Đây là khoản cắt băng thông lớn nhất của cả hệ thống vì một album
  // kéo hàng trăm thumbnail. Google phục vụ miễn phí nên chạy cả khi có bucket
  // Supabase (byte hiển thị không đụng — và không tính tiền — Supabase).
  // Lượt đọc byte đã bị loại ở `wantsBytes` phía trên và đi tiếp xuống dưới:
  // canvas watermark cần cùng miền, chuyển sang Google là tainted canvas.
  if (canRedirect) {
    const target = width <= 1024
      ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
      : `https://lh3.googleusercontent.com/d/${id}=w${width}`;
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": CACHE_OK } });
  }

  // ── Durable offload path ────────────────────────────────────────────────
  // Thumbnail widths only: a w=2560 watermark render or a w=2000 ZIP frame is
  // read once, so caching it buys nothing and costs both storage and egress.
  // Wider requests skip the bucket entirely (no HEAD probe either) and take the
  // plain-proxy path below.
  if (BUCKET && SUPA_URL && width <= CACHE_MAX_WIDTH) {
    const key = cacheKey(id, width);
    const pub = publicUrl(key);
    try {
      // HEAD is bodyless → negligible transfer. Cache hit → bounce to the CDN.
      const head = await fetch(pub, { method: "HEAD" });
      if (head.ok) {
        return new NextResponse(null, { status: 302, headers: { Location: pub, "Cache-Control": CACHE_OK } });
      }
    } catch { /* fall through to proxy + cache */ }

    const res = await fetchFromGoogle(id, width);
    if (!res) return NextResponse.json({ error: "fetch_failed", hint: "Ảnh có thể chưa được chia sẻ công khai trên Drive." }, { status: 502, headers: { "Cache-Control": CACHE_ERR } });
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    // Best-effort cache for next time (upsert so concurrent misses are fine).
    createAdminClient().storage.from(BUCKET).upload(key, buf, { contentType: ct, upsert: true, cacheControl: "31536000" }).catch(() => {});
    return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": CACHE_OK } });
  }

  // ── Plain proxy path (edge-cached) ───────────────────────────────────────
  const res = await fetchFromGoogle(id, width);
  if (!res || !res.body) {
    return NextResponse.json({ error: "fetch_failed", hint: "Ảnh có thể chưa được chia sẻ công khai trên Drive." }, { status: 502, headers: { "Cache-Control": CACHE_ERR } });
  }
  // Stream the body straight through — no arrayBuffer() buffering in the function.
  return new NextResponse(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": CACHE_OK },
  });
}
