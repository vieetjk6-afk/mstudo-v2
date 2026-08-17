import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DRIVE_CACHE_ERR,
  DRIVE_CACHE_OK,
  fetchDriveImage,
  fetchDriveOriginal,
} from "@/lib/drive-image";

// Not force-dynamic: the response is content-addressed by (id, w) and cacheable.
// The runtime is still dynamic because we read query params, but dropping
// force-dynamic lets Vercel's CDN honour the Cache-Control below.
export const runtime = "nodejs";

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
      { status: 302, headers: { "Cache-Control": DRIVE_CACHE_OK } },
    );
  }

  // Original-quality mode (album export, ZIP/download of originals): serve the
  // full-resolution file as-is, no width clamp, no re-encode.
  if (searchParams.get("orig") === "1") {
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
        if (head.ok) return new NextResponse(null, { status: 302, headers: { Location: pub, "Cache-Control": DRIVE_CACHE_OK } });
      } catch { /* fall through to proxy + cache */ }
      const res = await fetchDriveOriginal(id);
      if (!res || !res.body) return NextResponse.json({ error: "fetch_failed" }, { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } });
      const ct = res.headers.get("content-type") || "image/jpeg";
      const buf = Buffer.from(await res.arrayBuffer());
      createAdminClient().storage.from(BUCKET).upload(key, buf, { contentType: ct, upsert: true, cacheControl: "31536000" }).catch(() => {});
      return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": DRIVE_CACHE_OK } });
    }
    const res = await fetchDriveOriginal(id);
    if (!res || !res.body) return NextResponse.json({ error: "fetch_failed" }, { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } });
    return new NextResponse(res.body, { headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": DRIVE_CACHE_OK } });
  }

  // Clamp width: never proxy anything huge (caps origin transfer per request).
  // 2560 keeps the "download original" path (w=2400) working.
  const width = Math.min(Math.max(Number(searchParams.get("w")) || 500, 16), 2560);

  // ── Display CDN redirect (default ON; opt-out with IMG_CDN_REDIRECT=0) ────
  // For PLAIN <img> DISPLAY loads, 302-redirect straight to Google's CDN so
  // Vercel serves ~0 image bytes — the single biggest cut to Fast Origin
  // Transfer + Active CPU, since a gallery loads hundreds of thumbnails.
  // Google serves these for free, so this runs even when a Supabase bucket is
  // configured (display bytes never touch — nor bill — Supabase).
  //
  // Guard on Sec-Fetch-Mode ≠ "cors": a crossOrigin <img> used for canvas
  // watermarking (ZIP / single download) is also Sec-Fetch-Dest "image" but is
  // mode "cors" — it must NOT go to Google (no CORS there → tainted canvas →
  // toBlob() throws). Those, plus fetch()/ZIP (Dest ≠ "image"), fall through to
  // the same-origin proxy / Supabase cache below so byte reads keep working.
  // The on-screen watermark is a CSS overlay, so the display source is moot.
  const dest = req.headers.get("sec-fetch-dest");
  const mode = req.headers.get("sec-fetch-mode");
  if (process.env.IMG_CDN_REDIRECT !== "0" && dest === "image" && mode !== "cors") {
    const target = width <= 1024
      ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`
      : `https://lh3.googleusercontent.com/d/${id}=w${width}`;
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": DRIVE_CACHE_OK } });
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
        return new NextResponse(null, { status: 302, headers: { Location: pub, "Cache-Control": DRIVE_CACHE_OK } });
      }
    } catch { /* fall through to proxy + cache */ }

    const res = await fetchDriveImage(id, width);
    if (!res) return NextResponse.json({ error: "fetch_failed", hint: "Ảnh có thể chưa được chia sẻ công khai trên Drive." }, { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } });
    const ct = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    // Best-effort cache for next time (upsert so concurrent misses are fine).
    createAdminClient().storage.from(BUCKET).upload(key, buf, { contentType: ct, upsert: true, cacheControl: "31536000" }).catch(() => {});
    return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": DRIVE_CACHE_OK } });
  }

  // ── Plain proxy path (edge-cached) ───────────────────────────────────────
  const res = await fetchDriveImage(id, width);
  if (!res || !res.body) {
    return NextResponse.json({ error: "fetch_failed", hint: "Ảnh có thể chưa được chia sẻ công khai trên Drive." }, { status: 502, headers: { "Cache-Control": DRIVE_CACHE_ERR } });
  }
  // Stream the body straight through — no arrayBuffer() buffering in the function.
  return new NextResponse(res.body, {
    headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": DRIVE_CACHE_OK },
  });
}
